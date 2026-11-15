# Copilot instructions — sls-office

The canonical engineering guide for this repo is **[`CLAUDE.md`](../CLAUDE.md)**, with a
vendor-neutral mirror in **[`AGENTS.md`](../AGENTS.md)** and the domain glossary in
**[`CONTEXT.md`](../CONTEXT.md)**. Read those first.

TL;DR:

- TypeScript + Vite on Node 24, pnpm only.
- Engine, themes and simulator stay separate: themes are data, the engine knows nothing lab-specific.
- SOLID / DRY / conventional OOP; strong typing, avoid `any`/`unknown`; YAGNI / KISS.
- Verify: `pnpm format:check` (plus typecheck / test / build once those scripts exist).
- Trunk-based off `main`; Conventional Commits; a CHANGELOG `[Unreleased]` bullet per PR.
