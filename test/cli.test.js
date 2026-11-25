import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SOURCE_URL } from '../lib/meta.js';
import {
  normalizeProviderSnapshot,
  formatNaturalLanguage,
  PROVIDERS,
  parseArgs,
  providerEnvironment,
  resolveProviderSupport,
  runCli,
  usage,
  VERSION,
} from '../lib/cli.js';

const EXPECTED_IDS = ['claude', 'codex', 'gemini', 'kimi', 'copilot', 'grok', 'antigravity', 'opencode', 'zai'];

test('PROVIDERS registry lists all nine providers', () => {
  assert.deepEqual(PROVIDERS.map((entry) => entry.id), EXPECTED_IDS);

  for (const entry of PROVIDERS) {
    assert.equal(typeof entry.make, 'function', `${entry.id} has a factory`);
    assert.ok(entry.hint, `${entry.id} has a not-detected hint`);
  }

  assert.deepEqual(
    PROVIDERS.filter((entry) => entry.requiresNodeSqlite).map((entry) => entry.id),
    ['opencode'],
  );
});

test('resolveProviderSupport skips only SQLite-backed providers when node:sqlite is unavailable', async () => {
  const unavailable = await resolveProviderSupport(PROVIDERS, async () => null);
  assert.deepEqual(unavailable.supported.map((entry) => entry.id), ['claude', 'codex', 'gemini', 'kimi', 'copilot', 'grok', 'antigravity', 'zai']);
  assert.deepEqual(unavailable.skipped.map((entry) => entry.id), ['opencode']);

  const available = await resolveProviderSupport(PROVIDERS, async () => ({ DatabaseSync() {} }));
  assert.deepEqual(available.supported, PROVIDERS);
  assert.deepEqual(available.skipped, []);
});

test('resolveProviderSupport does not probe SQLite for unrelated providers', async () => {
  let probed = false;
  const selected = PROVIDERS.filter((entry) => entry.id === 'claude');
  const support = await resolveProviderSupport(selected, async () => {
    probed = true;
    return null;
  });

  assert.equal(probed, false);
  assert.deepEqual(support.supported, selected);
});

test('parseArgs accepts provider positionals, dedupes, and combines with flags', () => {
  const args = parseArgs(['claude', 'zai', 'claude', '--demo', '--read-only', '--json']);

  assert.deepEqual(args.providers, ['claude', 'zai']);
  assert.equal(args.demo, true);
  assert.equal(args.readOnly, true);
  assert.equal(args.json, true);
});

test('parseArgs rejects unknown providers and unknown options', () => {
  assert.throws(() => parseArgs(['chatgpt']), /Unknown provider: chatgpt/);
  assert.throws(() => parseArgs(['--verbose']), /Unknown option: --verbose/);
});

test('agy selects Antigravity without creating a duplicate provider', () => {
  assert.deepEqual(parseArgs(['agy', 'antigravity', '--read-only']).providers, ['antigravity']);
});

test('normalizes provider snapshots into compact remaining-quota data', () => {
  assert.deepEqual(normalizeProviderSnapshot('codex', {
    ok: true,
    plan: 'plus',
    items: [
      { kind: 'usage', key: 'codex:week', label: 'Weekly', percent: 54, resetAt: '2026-11-27T01:30:05Z' },
      { kind: 'info', key: 'codex:credits', label: 'Credits', value: 'included' },
    ],
    local: { huge: 'usage history must not be emitted' },
  }), {
    id: 'codex',
    status: 'available',
    plan: 'plus',
    limits: [{ id: 'codex:week', label: 'Weekly', remainingPercent: 46, resetAt: '2026-11-27T01:30:05Z' }],
    info: [{ label: 'Credits', value: 'included' }],
  });
});

test('normalizes unavailable quota and provider errors without usage details', () => {
  assert.deepEqual(normalizeProviderSnapshot('grok', {
    ok: true,
    plan: 'SuperGrok',
    items: [{ kind: 'info', label: 'Credits', value: 'monthly quota unavailable' }],
    local: { tokens: 123456 },
  }), {
    id: 'grok',
    status: 'unavailable',
    plan: 'SuperGrok',
    limits: [],
    info: [{ label: 'Credits', value: 'monthly quota unavailable' }],
  });

  assert.deepEqual(normalizeProviderSnapshot('claude', { ok: false, status: 'CRED', error: 'login expired', local: { tokens: 1 } }), {
    id: 'claude',
    status: 'error',
    plan: null,
    limits: [],
    info: [],
    error: { code: 'CRED', message: 'login expired' },
  });
});

test('normalizes multi-account provider quota items', () => {
  assert.deepEqual(normalizeProviderSnapshot('claude', {
    results: [{
      name: 'system', ok: true, plan: 'Pro',
      items: [{ kind: 'usage', key: 'claude:system:weekly', label: 'Weekly all', percent: 19, resetAt: '2026-11-27T00:00:00Z' }],
    }],
    local: { tokens: 987654321 },
  }), {
    id: 'claude', status: 'available', plan: 'Pro',
    limits: [{ id: 'claude:system:weekly', label: 'Weekly all', remainingPercent: 81, resetAt: '2026-11-27T00:00:00Z' }],
    info: [],
  });
});

test('natural-language output distinguishes unavailable, errors, and unknown percentages', () => {
  const output = formatNaturalLanguage({ providers: [
    { id: 'grok', status: 'unavailable', plan: 'SuperGrok', limits: [], info: [{ label: 'Credits', value: 'monthly quota unavailable' }] },
    { id: 'claude', status: 'error', plan: null, limits: [], info: [], error: { code: 'CRED', message: 'login expired' } },
    { id: 'codex', status: 'available', plan: null, limits: [{ id: 'a', label: 'Weekly', remainingPercent: null, resetAt: null }], info: [] },
  ] });

  assert.match(output, /Grok: unavailable on SuperGrok — Credits: monthly quota unavailable\./);
  assert.match(output, /Claude Code: error — login expired\./);
  assert.match(output, /Codex: available — Weekly: remaining percentage unknown\./);
});

test('natural-language quota lines include pace when the provider reports it', () => {
  const output = formatNaturalLanguage({ providers: [{
    id: 'codex', status: 'available', plan: 'plus',
    limits: [
      { id: 'fast', label: 'Weekly', remainingPercent: 46, paceDelta: 18, resetAt: '2026-11-27T00:00:00Z' },
      { id: 'slow', label: 'Session', remainingPercent: 82, paceDelta: -12, resetAt: null },
      { id: 'steady', label: 'Monthly', remainingPercent: 63, paceDelta: 1, resetAt: null },
    ],
    info: [],
  }] });

  assert.match(output, /Weekly: 46% remaining, 18 percentage points ahead of usage pace, resets at/);
  assert.match(output, /Session: 82% remaining, 12 percentage points behind usage pace/);
  assert.match(output, /Monthly: 63% remaining, on pace/);
});

test('parseArgs recognizes help', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--help']).help, true);
});

test('parseArgs recognizes version and read-only mode', () => {
  assert.equal(parseArgs(['-v']).version, true);
  assert.equal(parseArgs(['--version']).version, true);
  assert.equal(parseArgs(['--read-only']).readOnly, true);
  assert.deepEqual(
    providerEnvironment({ TOKEN: 'value' }, true),
    { TOKEN: 'value', TOKENSLEFT_READ_ONLY: '1' },
  );
});

test('--version prints the installed package version without loading providers', async () => {
  const output = [];
  const realLog = console.log;
  console.log = (value) => output.push(String(value));

  try {
    await runCli(['--version']);
  } finally {
    console.log = realLog;
  }

  assert.deepEqual(output, [VERSION]);
});

test('CLI defaults to concise natural-language provider sentences', async () => {
  const output = [];
  const realLog = console.log;
  console.log = (value) => output.push(String(value));

  try {
    await runCli(['--demo', 'codex']);
  } finally {
    console.log = realLog;
  }

  assert.equal(output.length, 1);
  assert.match(output[0], /^Codex: available on plus — Weekly: \d+% remaining/);
  assert.match(output[0], /remaining/);
  assert.doesNotMatch(output[0], /^\{/);
});

test('--json preserves the structured JSON provider schema', async () => {
  const output = [];
  const realLog = console.log;
  console.log = (value) => output.push(String(value));

  try {
    await runCli(['--demo', 'codex', '--json']);
  } finally {
    console.log = realLog;
  }

  const payload = JSON.parse(output[0]);
  assert.equal(payload.providers[0].id, 'codex');
  assert.ok(payload.providers.every((provider) => provider.limits.every((limit) => !('paceDelta' in limit))));
});

test('usage lists every provider id', () => {
  const text = usage();

  for (const id of EXPECTED_IDS) {
    assert.ok(text.includes(id), `usage mentions ${id}`);
  }

  assert.match(text, /--read-only/);
  assert.match(text, /--json\s+print structured JSON instead of natural-language text/);
  assert.match(text, /--version/);
  assert.ok(text.includes(`Source: ${SOURCE_URL}`));
});
