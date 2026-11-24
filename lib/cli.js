import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { loadDotEnv } from './env.js';
import { configPath } from './fsx.js';
import { SOURCE_URL } from './meta.js';
import { loadNodeSqlite } from './runtime.js';

const USER_ENV_PATH = configPath('.env');
const require = createRequire(import.meta.url);
export const VERSION = require('../package.json').version;

// Provider modules are imported lazily so --help, --demo, and single-provider runs don't load the whole provider fleet.
export const PROVIDERS = [
  { id: 'claude', envKeys: true, make: (env) => import('../providers/claude.js').then((m) => m.createClaudeProvider(env)), hint: 'No Claude Code credentials found. Run `claude` and /login, or set CLAUDE_CODE_OAUTH_TOKEN / CLAUDE_TOKEN_1.' },
  { id: 'codex', make: (env) => import('../providers/codex.js').then((m) => m.createCodexProvider(env)), hint: 'No Codex credentials found (~/.codex/auth.json or CODEX_HOME). Run `codex` to log in first.' },
  { id: 'gemini', make: (env) => import('../providers/gemini.js').then((m) => m.createGeminiProvider(env)), hint: 'No Gemini credentials found (~/.gemini/oauth_creds.json). Run `gemini` and sign in first.' },
  { id: 'kimi', envKeys: true, make: (env) => import('../providers/kimi.js').then((m) => m.createKimiProvider(env)), hint: 'No Kimi Code credentials found (~/.kimi-code/credentials/kimi-code.json). Run `kimi` and /login, or set KIMI_CODE_API_KEY_1 / KIMI_CODE_API_KEY.' },
  { id: 'copilot', envKeys: true, make: (env) => import('../providers/copilot.js').then((m) => m.createCopilotProvider(env)), hint: 'No GitHub token found. Run `gh auth login`, sign in to Copilot in your editor, or set COPILOT_TOKEN / GH_TOKEN / GITHUB_TOKEN.' },
  { id: 'grok', envKeys: true, make: (env) => import('../providers/grok.js').then((m) => m.createGrokProvider(env)), hint: 'No Grok credentials found (~/.grok/auth.json). Run `grok login` first, or set GROK_TOKEN.' },
  { id: 'antigravity', make: (env) => import('../providers/antigravity.js').then((m) => m.createAntigravityProvider(env)), hint: 'No Antigravity login found. Run `agy` and sign in, or start Antigravity IDE and sign in.' },
  { id: 'opencode', requiresNodeSqlite: true, make: (env) => import('../providers/opencode.js').then((m) => m.createOpencodeProvider(env)), hint: 'No OpenCode data found (~/.local/share/opencode). Log in with OpenCode or use it locally first.' },
  { id: 'zai', envKeys: true, make: (env) => import('../providers/zai.js').then((m) => m.createZaiProvider(env)), hint: 'No z.ai keys found. Set ZAI_API_KEY_1 (or ZAI_KEY_1 / GLM_API_KEY_1), or log in to Claude Code with a profile pointing at api.z.ai.' },
];

export function manualKeysHint() {
  return `Manual keys go in ${USER_ENV_PATH} (read from any directory) or ./.env (wins on conflicts); .env.example in the tokensleft package lists every variable.`;
}

export async function resolveProviderSupport(entries, loadSqlite = loadNodeSqlite) {
  if (!entries.some((entry) => entry.requiresNodeSqlite)) {
    return { supported: entries, skipped: [] };
  }

  if (await loadSqlite()) {
    return { supported: entries, skipped: [] };
  }

  return {
    supported: entries.filter((entry) => !entry.requiresNodeSqlite),
    skipped: entries.filter((entry) => entry.requiresNodeSqlite),
  };
}

function sqliteUnavailableMessage(entries) {
  const names = entries.map((entry) => entry.id === 'opencode' ? 'OpenCode' : 'Antigravity');
  const label = names.length === 1 ? names[0] : names.join(' and ');
  return `${label} ${names.length === 1 ? 'requires' : 'require'} node:sqlite and ${names.length === 1 ? 'was' : 'were'} skipped on this Node.js runtime. Use Node.js 22.13 or newer to enable ${names.length === 1 ? 'this provider' : 'these providers'}.`;
}

// User-facing errors: bin/tokensleft.js prints only the message for these and
// keeps the full stack for everything else.
function fail(message) {
  const error = new Error(message);
  error.friendly = true;
  return error;
}

// Manual keys: ~/.tokensleft/.env first (works from any directory, e.g. via
// `npx tokensleft`), then ./.env on top (project-local overrides), both over
// process.env. The cwd .env may belong to an unrelated project, so say when
// it is being read.
async function loadEnv() {
  if (existsSync('.env')) {
    console.error(`tokensleft: reading manual keys from ${resolve('.env')}`);
  }

  return loadDotEnv('.env', await loadDotEnv(USER_ENV_PATH));
}

export function usage() {
  return [
    'tokensleft — AI subscription quotas for agents',
    '',
    'Usage: tokensleft [providers...] [options]',
    '',
    `Providers (default: all detected): ${PROVIDERS.map((entry) => entry.id).join(' ')}`,
    'Alias: agy = antigravity (prefers the CLI system-keyring login)',
    '',
    'Options:',
    '  --demo            realistic random data — no credentials, no network',
    '  --json            print structured JSON instead of natural-language text',
    '  --once            accepted for compatibility; each run is one snapshot',
    '  --read-only       never refresh or persist credential updates',
    '  -h, --help        show this help',
    '  -v, --version     show the installed version',
    '',
    'Keys are auto-discovered from logged-in CLIs.',
    manualKeysHint(),
    '',
    `Source: ${SOURCE_URL}`,
  ].join('\n');
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.version) {
    console.log(VERSION);
    return;
  }

  const selected = args.providers.length > 0
    ? PROVIDERS.filter((entry) => args.providers.includes(entry.id))
    : PROVIDERS;
  let providers;
  let skippedProviders = [];
  if (args.demo) {
    const { makeDemoProviders } = await import('./demo.js');
    // With no explicit provider list, use the curated live-shaped demo rather
    // than pretending every supported integration is installed at once.
    providers = makeDemoProviders(args.providers.length > 0
      ? selected.map((entry) => entry.id)
      : undefined);
  } else {
    const env = providerEnvironment(await loadEnv(), args.readOnly);
    const support = await resolveProviderSupport(selected);
    skippedProviders = support.skipped;
    providers = (await Promise.all(support.supported.map((entry) => entry.make(env)))).filter(Boolean);
  }

  if (providers.length === 0) {
    if (selected.length === 1) {
      const provider = selected[0];
      const unavailable = skippedProviders.length === 1;
      output({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        providers: [{
          id: provider.id,
          status: unavailable ? 'unsupported' : 'not_detected',
          plan: null,
          limits: [],
          info: [],
          error: {
            code: unavailable ? 'UNSUPPORTED_RUNTIME' : 'NOT_DETECTED',
            message: unavailable ? sqliteUnavailableMessage(skippedProviders) : provider.hint,
          },
        }],
      }, 2, args.json);
      return;
    }

    output({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      providers: [],
      error: {
        code: 'NO_PROVIDERS',
        message: `No providers detected. Log in to a supported CLI first. ${manualKeysHint()}${skippedProviders.length ? ` ${sqliteUnavailableMessage(skippedProviders)}` : ''}`,
      },
    }, 2, args.json);
    return;
  }

  const snapshots = await Promise.all(providers.map(async (provider) => {
    try {
      return normalizeProviderSnapshot(provider.id, await provider.fetch());
    } catch (error) {
      return normalizeProviderSnapshot(provider.id, { ok: false, status: 'ERR', error: error.message });
    }
  }));
  const unsupported = skippedProviders.map((provider) => ({
    id: provider.id,
    status: 'unsupported',
    plan: null,
    limits: [],
    info: [],
    error: { code: 'UNSUPPORTED_RUNTIME', message: sqliteUnavailableMessage([provider]) },
  }));
  output({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    providers: [...snapshots, ...unsupported],
  }, 0, args.json);
}

const PROVIDER_NAMES = Object.freeze({
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  kimi: 'Kimi Code',
  copilot: 'GitHub Copilot',
  grok: 'Grok',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
  zai: 'z.ai',
});

export function formatNaturalLanguage(payload) {
  if (payload.providers.length === 0) {
    return payload.error?.message || 'No providers were detected.';
  }

  return payload.providers.map((provider) => {
    const name = PROVIDER_NAMES[provider.id] || provider.id;
    const status = provider.status.replaceAll('_', ' ');
    let sentence = `${name}: ${status}`;

    if (provider.plan) {
      sentence += ` on ${provider.plan}`;
    }

    if (provider.limits.length > 0) {
      const limits = provider.limits.map((limit) => {
        const remaining = Number.isFinite(limit.remainingPercent)
          ? `${Math.round(limit.remainingPercent)}% remaining`
          : 'remaining percentage unknown';
        const reset = limit.resetAt ? `, resets at ${limit.resetAt}` : '';
        return `${limit.label}: ${remaining}${reset}`;
      });
      sentence += ` — ${limits.join('; ')}`;
    }

    if (provider.info.length > 0) {
      sentence += `${provider.limits.length > 0 ? '; ' : ' — '}${provider.info.map(({ label, value }) => `${label}: ${value}`).join('; ')}`;
    }

    if (provider.error?.message) {
      sentence += `${provider.limits.length > 0 || provider.info.length > 0 ? '; ' : ' — '}${provider.error.message}`;
    }

    return `${sentence}.`;
  }).join('\n');
}

function output(payload, exitCode = 0, json = false) {
  console.log(json ? JSON.stringify(payload) : formatNaturalLanguage(payload));
  if (exitCode) process.exitCode = exitCode;
}

export function normalizeProviderSnapshot(id, snapshot) {
  const accounts = Array.isArray(snapshot.results) ? snapshot.results : null;
  const items = accounts
    ? accounts.flatMap((account) => Array.isArray(account.items) ? account.items : [])
    : Array.isArray(snapshot.items) ? snapshot.items : [];
  const successfulAccounts = accounts?.filter((account) => account.ok) || [];
  const failedAccounts = accounts?.filter((account) => !account.ok && account.status !== 'DUP') || [];
  const limits = items.filter((item) => item.kind === 'usage').map((item) => ({
    id: item.key,
    label: item.label,
    remainingPercent: Number.isFinite(item.percent) ? Math.max(0, Math.min(100, 100 - item.percent)) : null,
    resetAt: item.resetAt instanceof Date ? item.resetAt.toISOString() : item.resetAt || null,
  }));
  const info = items.filter((item) => item.kind === 'info').map((item) => ({ label: item.label, value: item.value }));
  const result = {
    id,
    status: (accounts ? successfulAccounts.length > 0 : snapshot.ok) ? (limits.length ? 'available' : 'unavailable') : 'error',
    plan: snapshot.plan || successfulAccounts[0]?.plan || null,
    limits,
    info,
  };

  if (snapshot.ok === false) {
    result.error = { code: String(snapshot.status || 'PROVIDER_ERROR'), message: snapshot.error || 'Provider request failed' };
  } else if (accounts && successfulAccounts.length === 0 && failedAccounts.length > 0) {
    result.error = {
      code: String(failedAccounts[0].status || 'PROVIDER_ERROR'),
      message: failedAccounts.map((account) => `${account.name}: ${account.error || 'Provider request failed'}`).join('; '),
    };
  }

  return result;
}

export function parseArgs(argv) {
  const args = {
    providers: [],
    json: false,
    once: false,
    demo: false,
    help: false,
    version: false,
    readOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] === 'agy' ? 'antigravity' : argv[index];

    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--once') {
      args.once = true;
    } else if (arg === '--demo') {
      args.demo = true;
    } else if (arg === '--read-only') {
      args.readOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--version' || arg === '-v') {
      args.version = true;
    } else if (arg.startsWith('-')) {
      throw fail(`Unknown option: ${arg}\n\n${usage()}`);
    } else if (PROVIDERS.some((entry) => entry.id === arg)) {
      if (!args.providers.includes(arg)) {
        args.providers.push(arg);
      }
    } else {
      throw fail(`Unknown provider: ${arg}\n\n${usage()}`);
    }
  }

  return args;
}

export function providerEnvironment(env, readOnly = false) {
  return readOnly ? { ...env, TOKENSLEFT_READ_ONLY: '1' } : env;
}
