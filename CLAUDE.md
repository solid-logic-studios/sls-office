# CLAUDE.md

This file is the **canonical** guide for anyone — Claude Code, opencode, Copilot, or a human —
working in this repository. [`AGENTS.md`](AGENTS.md) mirrors the principles for other tools and
`.github/copilot-instructions.md` points here. **When a convention changes, edit this file first.**

## Project Overview

SLS Office renders the Solid Logic Studios lab as an animated, themed pixel-art dashboard. It is
built from three parts: an **engine** (rendering and animation), **themes** (swappable visual
skins) and a **simulator** (drives the scene with synthetic lab activity).

The repo is at its starting line: only conventions and tooling exist so far. Update this section,
the Commands and the Architecture as code lands.

- **Stack:** TypeScript + Vite (planned; see [ADR 0001](docs/adr/0001-typescript-vite-pnpm.md))
- **Runtime / package manager:** Node 24 ([`.nvmrc`](.nvmrc)) / pnpm (pinned via `packageManager`)

## Commands

```bash
pnpm install            # install dependencies
pnpm format             # apply Prettier to the repo
pnpm format:check       # Prettier check (CI gate)
```

Add `dev`, `build`, `typecheck` (`tsc --noEmit`) and `test` scripts when the first code lands, then
add each one to CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) and to the verify bar
in [`AGENTS.md`](AGENTS.md) and the `/ticket` skill.

## Architecture

Not yet built. The intended split, to be confirmed by the first ADRs once code exists:

- **Engine** owns the render loop, sprites and animation; it knows nothing about lab specifics.
- **Themes** are data the engine consumes (palettes, sprite sheets, layout), so a new theme should
  never need an engine change.
- **Simulator** produces the lab state the dashboard shows, standing in for live data sources.

## Key Conventions

- Strict TypeScript once `tsconfig.json` lands (`strict: true`); no `any`.
- Prettier is the only formatter; `.claude/` is excluded so vendored agent files stay byte-identical.
- pnpm only: do not commit a `package-lock.json` or `yarn.lock`.

## Coding Principles

SOLID, DRY, conventional OOP. Use the language's power — generics, interfaces, discriminated
unions — where they buy real safety or reuse, **not as decoration**. Strong typing everywhere;
avoid `any`/`unknown` (and other escape hatches) unless fighting the type system genuinely costs
more than it's worth. **YAGNI / KISS:** no abstraction a task doesn't need; restraint over
cleverness. If something is improvable but out of scope, surface it (or file an issue) rather than
silently expanding the change.

## Framework discipline

The frameworks and dependencies here are commitments — **use them properly**: prefer their idioms
over hand-rolling, reference the docs, and stay current with releases (Dependabot opens the PRs).

## Release Hygiene (trunk-based)

- Branch off `main`; every change lands through a PR.
- Conventional Commits; enable the template once with `git config commit.template .gitmessage`.
- A `CHANGELOG.md` `[Unreleased]` bullet in the same PR as any user-facing change.
- Bump `package.json` version and tag `vX.Y.Z` at release only; no per-PR version bumps.

## Workflow

- **Ship a ticket:** `/ticket N` runs the JARVIS loop (issue → a Sonnet "Avenger" builds on a
  branch → PR). The project-local `.claude/skills/ticket/` hardcodes this repo's verify bar.
- **After any PR:** run `/code-review --comment` and the `uncle-bob` craftsmanship agent. Sonnet
  sub-agents auto-fix the **obvious** findings; **non-obvious** ones escalate back to JARVIS (Opus)
  to decide or ask. Iterate until green. You merge — agents don't.
