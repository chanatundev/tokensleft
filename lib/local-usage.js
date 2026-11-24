import { open, stat } from 'node:fs/promises';
// Shared machinery for aggregating token usage from local provider logs.

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Canonical usage event: { t, id?, model, input, output, cacheRead,
// cacheWrite, cost } — `input` excludes cached tokens, `cost` is USD or null
// when the model's pricing is unknown.

export function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    messages: 0,
    cost: 0,
    hasCost: false,
    hasUnknownCost: false,
  };
}

function addUsage(target, event) {
  target.input += event.input || 0;
  target.output += event.output || 0;
  target.cacheRead += event.cacheRead || 0;
  target.cacheWrite += event.cacheWrite || 0;
  target.messages += 1;

  if (Number.isFinite(event.cost)) {
    target.hasCost = true;
    target.cost += event.cost;
  } else {
    target.hasUnknownCost = true;
  }
}

// Buckets canonical events into per-model today / 7d / 30d / all-time totals
// ("all" being whatever logs still exist on disk), deduping by event id
// (when present) across files.
export function aggregateUsageEvents(eventLists, { now = Date.now(), toUsage = (event) => event } = {}) {
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const weekStart = now - WEEK_MS;
  const monthStart = now - MONTH_MS;
  const perModel = new Map();
  const seen = new Set();

  for (const events of eventLists) {
    for (const raw of events) {
      if (raw.id) {
        if (seen.has(raw.id)) {
          continue;
        }

        seen.add(raw.id);
      }

      const event = toUsage(raw);
      const model = event.model || 'unknown';
      let bucket = perModel.get(model);

      if (!bucket) {
        bucket = { model, today: emptyUsage(), week: emptyUsage(), month: emptyUsage(), all: emptyUsage() };
        perModel.set(model, bucket);
      }

      addUsage(bucket.all, event);

      if (raw.t >= monthStart) {
        addUsage(bucket.month, event);
      }

      if (raw.t >= weekStart) {
        addUsage(bucket.week, event);
      }

      if (raw.t >= todayStart) {
        addUsage(bucket.today, event);
      }
    }
  }

  return [...perModel.values()].sort((a, b) => (b.all.cost - a.all.cost) || (b.all.output - a.all.output));
}

// Generic incremental scanner. `listFiles()` returns the candidate log paths
// (throwing a user-facing Error when the log directory is missing);
// `refreshFile(filePath, info, cached)` brings one file's `cached.events` up
// to date. Every log on disk counts — the first scan parses full history for
// the all-time window, later scans only touch appended data — and files
// deleted from disk drop out of the cache.
export function createLocalUsageScanner({ listFiles, refreshFile, initState = () => null, toUsage }) {
  const fileCache = new Map(); // path -> { offset, events, state, ... }

  return {
    async scan(now = Date.now()) {
      const seenFiles = new Set();
      let paths;

      try {
        paths = await listFiles();
      } catch (error) {
        if (fileCache.size > 0) {
          return {
            ok: true,
            partial: true,
            failedFiles: [{ path: '', error: error.message }],
            files: fileCache.size,
            models: aggregateUsageEvents([...fileCache.values()].map((cached) => cached.events), { now, toUsage }),
          };
        }

        return { ok: false, error: error.message, models: [] };
      }

      let files = 0;
      const failedFiles = [];

      for (const filePath of paths) {
        seenFiles.add(filePath);
        let info;

        try {
          info = await stat(filePath);
        } catch (error) {
          failedFiles.push({ path: filePath, error: error.message });
          continue;
        }

        files += 1;
        const previous = fileCache.get(filePath);

        // An append-only log that has not grown since the last scan has
        // nothing new to parse: keep the cached entry as is instead of deep
        // copying every event of every file on every refresh.
        if (previous && previous.offset > 0 && previous.offset === info.size) {
          continue;
        }

        let working;

        // new file, or a file that shrank (rotated/rewritten) — (re)parse fully
        if (!previous || previous.offset > info.size) {
          working = { offset: 0, events: [], state: initState() };
        } else {
          // Refresh transactionally: a partial read/parse failure must not
          // corrupt the last-known-good offset, parser state, or events.
          working = structuredClone(previous);
        }

        try {
          await refreshFile(filePath, info, working);
          fileCache.set(filePath, working);
        } catch (error) {
          failedFiles.push({ path: filePath, error: error.message });
        }
      }

      for (const filePath of fileCache.keys()) {
        if (!seenFiles.has(filePath)) {
          fileCache.delete(filePath);
        }
      }

      const eventLists = [...fileCache.values()].map((cached) => cached.events);
      return {
        ok: true,
        files,
        partial: failedFiles.length > 0,
        failedFiles,
        models: aggregateUsageEvents(eventLists, { now, toUsage }),
      };
    },
  };
}

const MAX_SLICE_BYTES = 64 * 1024 * 1024;

// refreshFile implementation for append-only JSONL logs: remembers the byte
// offset of the last complete line and only parses what was appended, in
// slices of at most MAX_SLICE_BYTES so a huge backlog never means a
// file-sized allocation. `parseChunk(text, state)` returns
// { events, remainder } and may carry parser state (current model, running
// totals) across chunks via `state`.
export function jsonlRefresher(parseChunk) {
  const readSlice = async (filePath, position, length) => {
    const handle = await open(filePath, 'r');

    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await handle.close();
    }
  };

  return async (filePath, info, cached) => {
    while (cached.offset < info.size) {
      const length = Math.min(info.size - cached.offset, MAX_SLICE_BYTES);
      const text = await readSlice(filePath, cached.offset, length);
      const { events, remainder } = parseChunk(text, cached.state);
      const consumed = Buffer.byteLength(text, 'utf8') - Buffer.byteLength(remainder, 'utf8');
      cached.events.push(...events);

      if (consumed > 0) {
        cached.offset += consumed;
        continue;
      }

      if (length < MAX_SLICE_BYTES) {
        break; // partial trailing line — completed once more data is appended
      }

      // A single line larger than the slice cap can't be a usage record —
      // skip the slice; the mid-line tail parses as garbage and is dropped.
      cached.offset += length;
    }
  };
}
