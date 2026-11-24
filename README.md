# TokensLeft

Chanatun Kohsuwan's headless, agent-oriented fork of [TokensLeft](https://github.com/tokensleft/tokensleft), originally created by the TokensLeft contributors. The fork uses Apache-2.0; the original MIT license and attribution remain in [LICENSE-MIT](LICENSE-MIT).

TokensLeft checks AI subscription quotas and returns compact JSON for orchestrators. It has no interactive TUI, service, analytics, or telemetry.

## Install

Requires Node.js 20.18.1 or newer. OpenCode and Antigravity IDE database support require Node.js 22.13 or newer.

```sh
npm install --global --prefix "$HOME/.local" github:chanatundev/tokensleft
export PATH="$HOME/.local/bin:$PATH"
tokensleft --read-only
```

The CLI discovers credentials from supported tools already logged in on that machine. It sends quota requests directly to the relevant providers.

## Agent interface

Every invocation prints one compact JSON document to stdout. By default it checks all detected providers. Pass provider IDs to check only selected services:

```sh
tokensleft --read-only
tokensleft codex claude --read-only
```

Each result includes a provider ID, status, plan when available, quota limits with `remainingPercent` and `resetAt`, and concise informational notes. Local token histories and spend estimates are omitted. Provider errors are included in the result so an orchestrator can choose another agent.

Statuses are `available`, `unavailable`, `not_detected`, `unsupported`, and `error`. An unavailable quota is distinct from zero remaining. When no selected provider can return a snapshot, the CLI exits with status 2.

```json
{"schemaVersion":1,"generatedAt":"2026-11-24T00:00:00Z","providers":[{"id":"codex","status":"available","plan":"plus","limits":[{"id":"codex:weekly","label":"Weekly","remainingPercent":46,"resetAt":"2026-11-27T01:30:05Z"}],"info":[]}]}
```

Options:

- `--read-only` prevents token refreshes and credential writes.
- `--demo` prints realistic sample data without credentials or network access.
- `--help` lists provider IDs and usage.
- `--version` prints the installed version.
- `--json` and `--once` remain accepted for compatibility; JSON and one-shot output are already the defaults.

Antigravity can also be selected as `agy`.

## Credentials and privacy

TokensLeft reads existing local CLI logins or manually configured keys in `~/.tokensleft/.env` or `./.env`; see [.env.example](.env.example). Provider-specific credential paths and options are documented in the provider code and help output. On Linux, Antigravity CLI keyring access requires `secret-tool` from `libsecret-tools` and an unlocked keyring.

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
