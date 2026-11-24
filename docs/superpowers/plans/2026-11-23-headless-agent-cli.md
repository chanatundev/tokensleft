# Headless agent CLI plan

## Goal

Remove TokensLeft's interactive terminal dashboard and make a stable, compact JSON snapshot the default output for agent orchestration. Preserve provider adapters, credential discovery, safe refresh behavior, provider selection, and demo mode.

## Files

- `lib/cli.js`: turn the runner into a one-shot JSON interface; normalize provider snapshots, statuses, quota remaining percentages, resets, and errors.
- `bin/tokensleft.js`: keep process/error handling for the headless command.
- `providers/*.js`, `lib/provider.js`, and auth helpers: retain quota collection and auth handling.
- `lib/tui.js`, dashboard/render-only modules, `blessed` dependency, and UI-specific tests: remove after references are migrated.
- `test/cli.test.js` and provider tests: define the machine-readable contract and error cases.
- `README.md`, `package.json`, and lockfile: document the default JSON workflow and remove UI metadata/dependency.

## Tasks

1. Add failing CLI tests for default JSON output, normalized remaining quota, provider errors, and no detected providers.
2. Implement the JSON serializer/runner; remove interactive and plain dashboard branches and dashboard polling/history initialization.
3. Remove TUI, terminal render helpers/tests, and `blessed`; keep shared numerical/date helpers used by providers.
4. Update README and package metadata for headless, agent-oriented operation.
5. Run the CLI tests and full suite; publish the fork update and install it on Nitro.

## Acceptance

- A single invocation prints parseable JSON to stdout and no terminal UI.
- Output includes schema version, generation timestamp, per-provider status/plan, quota remaining percentages and reset times where available, and structured errors when unavailable.
- No local token/spend history appears by default.
- Interactive dashboard and Blessed are removed.
