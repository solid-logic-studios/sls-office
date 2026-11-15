# Agents Guide: sls-office

Vendor-neutral guide for AI coding tools (opencode, Copilot, …) and contributors.
**The canonical, fuller guide is [`CLAUDE.md`](CLAUDE.md)**: read it for commands, architecture,
and any repo-specific traps. This file mirrors the principles and golden paths; the domain glossary
is in [`CONTEXT.md`](CONTEXT.md).

## Engineering Principles

Apply in this order of precedence:

- **SOLID**: single-responsibility modules; depend on abstractions.
- **DRY**: reuse existing helpers and patterns before writing new ones; extract shared logic when a
  second consumer appears, not before.
- **Conventional OOP**: clear responsibilities; data-driven dispatch over sprawling conditionals.
- **Use the language's strengths**: generics, interfaces, discriminated unions, where they buy
  real safety or reuse, not as decoration. Strong typing; avoid `any`/`unknown`.
- **YAGNI / KISS**: build what the issue needs now; no abstraction or config surface for its own sake.
- **Surface improvements**: raise or file out-of-scope issues rather than silently expanding the change.

## Golden Paths

Only the tracer bullet exists so far. As the engine, themes and simulator land, record the common
recipes here (for example "add a theme"), plus any change that must touch several places at once.

- **Change the Snapshot contract:** edit the types in `src/contract/snapshot.ts` (the single
  source), update the fixtures, and follow the `v` bump rule in
  [ADR 0002](docs/adr/0002-snapshot-contract-and-static-image.md). The JSON Schema is generated.

- **Add a script or gate:** add it to `package.json`, then to CI, the verify bar below and
  `.claude/skills/ticket/SKILL.md` in the same PR.

## Verify before opening a PR

`pnpm format:check && pnpm typecheck && pnpm test && pnpm build`

## Release & workflow

Trunk-based release model; Conventional Commits; a CHANGELOG `[Unreleased]` bullet per
user-facing PR. After a PR, run `/code-review --comment` and the `uncle-bob` agent; fix the obvious
findings, escalate the rest to the orchestrator. Details in [`CLAUDE.md`](CLAUDE.md).
