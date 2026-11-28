# TokensLeft

Chanatun Kohsuwan's headless, agent-oriented fork of [TokensLeft](https://github.com/tokensleft/tokensleft), originally created by the TokensLeft contributors. The fork uses Apache-2.0; the original MIT license and attribution remain in [LICENSE-MIT](LICENSE-MIT).

TokensLeft checks AI subscription quotas and returns concise natural-language provider sentences by default, with structured JSON available for orchestrators using `--json`. It has no interactive TUI, service, analytics, or telemetry.

## Install

Requires Node.js 20.18.1 or newer. OpenCode and Antigravity IDE database support require Node.js 22.13 or newer.

```sh
npm install --global --prefix "$HOME/.local" github:chanatundev/tokensleft
export PATH="$HOME/.local/bin:$PATH"
tokensleft --read-only
```

The CLI discovers credentials from supported tools already logged in on that machine. It sends quota requests directly to the relevant providers.

## Supported agents

TokensLeft can report quota for these agent CLIs and subscriptions. It reuses the login or key already configured for each tool; exact quota windows depend on the provider and account plan.

| Provider ID | Compatible agent or service | Account / subscription |
| --- | --- | --- |
| `claude` | Claude Code (`claude`) | Claude account limits; also supports z.ai keys configured through Claude Code profiles under `zai`. |
| `codex` | OpenAI Codex CLI (`codex`) | ChatGPT plan limits and Codex reset credits. |
| `gemini` | Gemini CLI (`gemini`) | Google account quota and plan. |
| `kimi` | Kimi Code (`kimi`) | Kimi Coding Plan; API keys can also be configured manually. |
| `copilot` | GitHub Copilot | GitHub Copilot quota via `gh` authentication, editor sign-in, or a configured GitHub token. |
| `grok` | Grok CLI (`grok`) | Grok subscription weekly credits and product breakdown. |
| `antigravity` (`agy`) | Antigravity CLI or IDE | Google account quota for Antigravity; `agy` prefers the CLI login. |
| `opencode` | OpenCode | OpenCode usage and Go quota where available. Requires Node.js 22.13 or newer. |
| `zai` | z.ai / GLM Coding Plan | z.ai API key or a Claude Code profile pointed at z.ai. |

To check a subset, pass provider IDs on the command line, for example `tokensleft codex grok --read-only`. A detected provider can still report an unavailable quota when the provider does not expose one for that account.

## Agent interface

By default, TokensLeft prints concise natural-language sentences for detected providers. Use `--json` when an orchestrator needs structured output. It checks all detected providers unless you pass provider IDs:

```sh
tokensleft --read-only
tokensleft codex claude --read-only
```

The default output is one concise sentence per provider, including status, plan, remaining quota, reset time, and any error or unavailable explanation. Local token histories and spend estimates are omitted.

### Natural-language output format

Each detected provider gets one line. Optional sections are omitted when the provider does not report that data:

```text
<Provider>: <status>[ on <plan>][ — <quota label>: <percent>% remaining[, <N> percentage points ahead of usage pace|<N> percentage points behind usage pace|on pace][, resets at <timestamp>][; <another quota>...]][; <info label>: <info value>...][; <error message>].
```

Examples:

```text
Codex: available on plus — Weekly: 46% remaining, 8 percentage points ahead of usage pace, resets at 2026-11-27T01:30:05Z.
Grok: unavailable on SuperGrok — Credits: monthly quota unavailable.
Claude Code: error — OAuth token expired. Run Claude Code and sign in again.
```

Statuses are `available`, `unavailable`, `not detected`, `unsupported`, and `error`. Remaining percentages are rounded to whole numbers; missing percentages or reset times are omitted or described as unknown. When the provider reports a usage pace, the line compares quota used with the portion of the quota window elapsed: positive differences say `ahead of usage pace`, negative differences say `behind usage pace`, and differences within 2 percentage points say `on pace`. This prose format is intended to be easy for agents to read, not a strict parsing contract; use `--json` when stable fields are needed.

Statuses are `available`, `unavailable`, `not_detected`, `unsupported`, and `error`. An unavailable quota is distinct from zero remaining. When no selected provider can return a snapshot, the CLI exits with status 2.

Use `--json` to get the structured snapshot described below. Its schema remains stable for orchestrators:

```sh
tokensleft --read-only --json
```

```json
{"schemaVersion":1,"generatedAt":"2026-11-24T00:00:00Z","providers":[{"id":"codex","status":"available","plan":"plus","limits":[{"id":"codex:weekly","label":"Weekly","remainingPercent":46,"resetAt":"2026-11-27T01:30:05Z"}],"info":[]}]}
```

Options:

- `--read-only` prevents token refreshes and credential writes.
- `--demo` prints realistic sample data without credentials or network access.
- `--help` lists provider IDs and usage.
- `--version` prints the installed version.
- `--json` prints structured JSON instead of natural-language sentences.
- `--once` remains accepted for compatibility; each invocation already returns one snapshot.

Antigravity can also be selected as `agy`.

## Credentials and privacy

TokensLeft reads existing local CLI logins or manually configured keys in `~/.tokensleft/.env` or `./.env`; see [.env.example](.env.example). For Antigravity CLI (`agy`), it reads the OAuth login from the system keyring when available, or from `~/.gemini/antigravity-cli/antigravity-oauth-token` on newer `agy` installs. It reads the credential only; `agy` remains responsible for refreshing it. On Linux, keyring access requires `secret-tool` from `libsecret-tools` and an unlocked keyring; the OAuth-file fallback does not require keyring access.

Quota requests go directly to providers or through your configured proxy. TokensLeft has no hosted account or telemetry service. Use `--read-only` when the orchestrator must not refresh or persist credentials.

## Development

```sh
git clone https://github.com/chanatundev/tokensleft.git
cd tokensleft
npm ci
npm test
npm run lint
npm run demo
```

[Security policy](SECURITY.md)
