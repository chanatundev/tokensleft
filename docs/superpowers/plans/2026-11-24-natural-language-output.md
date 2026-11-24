# Natural-language CLI Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make concise natural-language provider sentences the default and preserve structured output behind `--json`.

**Architecture:** Keep provider collection and normalization unchanged. Add a text formatter for the normalized snapshot envelope and select it only when `--json` is absent; retain the existing JSON serializer and exit codes.

**Tech Stack:** Node.js ES modules, node:test.

**Spec:** `docs/superpowers/specs/2026-11-24-natural-language-output-design.md`

## Global Constraints

- One concise sentence per provider by default.
- Include status, known plan, remaining quota, reset, and short error/unavailable information as available.
- Keep secrets, local histories, and estimated spend out of output.
- `--json` keeps the current schema unchanged and provider selection/exit behavior stays unchanged.

## Review Focus

- No detected providers: natural text explains that none were found and preserves exit code 2.
- Provider with only informational quota: describe as unavailable without implying zero remaining.
- Failed multi-account provider: report an error rather than empty availability.
- Missing plan or reset timestamp: omit only the absent field.
- JSON option: exact existing object envelope remains unchanged.

### Task 1: Default text output and JSON opt-in

**Files:** Modify `lib/cli.js`, `test/cli.test.js`, `README.md`; test `test/cli.test.js`.

- [x] Write tests for text output statuses and explicit JSON output.
- [x] Run tests to observe expected failures.
- [x] Implement deterministic sentence formatting and `--json` selection.
- [x] Update help and README examples.
- [x] Run focused tests, lint, and full suite.
