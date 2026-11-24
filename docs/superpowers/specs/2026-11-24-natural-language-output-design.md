# Natural-language CLI output design

## Goal

Make the default TokensLeft output easy for an orchestrator to read as concise natural language, while retaining the current structured output behind `--json`.

## Output contract

- Without `--json`, print one concise sentence per provider: provider name, status, plan when known, remaining quota and reset when available, and a short error or unavailable explanation when applicable.
- Keep output deterministic and avoid local token histories, secrets, and estimated spend.
- Preserve exit behavior and provider selection.
- With `--json`, emit the existing compact JSON schema unchanged.
- Update help text and README examples to explain that JSON is opt-in.

## Verification

Add tests for available quotas, unavailable quotas, errors, multiple providers, and the `--json` schema; run lint and the full test suite.
