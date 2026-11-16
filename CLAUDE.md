# CLAUDE.md

This file is the **canonical** guide for anyone (Claude Code, opencode, Copilot, or a human)
working in this repository. [`AGENTS.md`](AGENTS.md) mirrors the principles for other tools and
`.github/copilot-instructions.md` points here. **When a convention changes, edit this file first.**

## Project Overview

SLS Office renders the Solid Logic Studios lab as an animated, themed pixel-art dashboard. It is
built from three parts: an **engine** (rendering and animation), **themes** (swappable visual
skins) and a **simulator** (drives the Office with synthetic lab activity).

It has two contracts: the versioned **Snapshot contract** (what the lab collector writes) and the
**Theme contract** (what a theme gives the engine). The page ships as a static image on GHCR.

- **Stack:** TypeScript (strict) + Vite + Vitest, canvas rendering, no framework (see
  [ADR 0001](docs/adr/0001-typescript-vite-pnpm.md),
  [ADR 0002](docs/adr/0002-snapshot-contract-and-static-image.md) and
  [ADR 0003](docs/adr/0003-engine-and-theme-contract.md))
- **Runtime / package manager:** Node 24 ([`.nvmrc`](.nvmrc)) / pnpm (pinned via `packageManager`)

## Commands

```bash
pnpm install            # install dependencies
pnpm dev                # Vite dev server
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run
pnpm build              # vite build, then writes dist/schema/snapshot.v1.schema.json
pnpm schema             # regenerate the JSON Schema from the Snapshot types
pnpm format             # apply Prettier to the repo
pnpm format:check       # Prettier check (CI gate)
```

## Architecture

- **`src/contract/`** holds the two contracts. `snapshot.ts` is the Snapshot contract: its types are
  the single source of truth, and the JSON Schema is generated from them (never committed) and
  published as a release asset. `theme.ts` is the Theme contract and `painter.ts` the drawing
  surface both sides use.
- **`src/engine/`** is the Engine: the render loop, moods, walking, characters, scenes, bubbles,
  effects, the sprite renderer and tooltips. It imports only from `src/contract/` and itself, draws
  only through the `Painter`, and knows nothing about any Theme (a test enforces the imports).
- **`src/themes/`** holds the Themes: `office/` (the prototype's world) and `boxes/` (a plain test
  theme that proves the contract). A Theme is data and pure drawing functions; it imports only from
  `src/contract/`, so a new Theme never needs an Engine change.
- **`src/simulator/`** is the Simulator, a synthetic lab behind `SnapshotSource`. `?sim` switches the
  page to it and shows the control room.
- **`src/source/`** holds the other `SnapshotSource` adapters (live HTTP, in-memory fixture for
  tests) and the `isSnapshot` guard.
- **`src/page/`** adapts the Engine to the browser: the canvas `Painter`, stage sizing, the poller,
  and the DOM views (tooltip, status strip, log, legend, theme switcher, control room).
  `src/main.ts` is the composition root and the only file that knows which Themes exist.
- **`fixtures/`** holds sample Snapshots used by tests and for trying the image.
- **Image:** busybox `httpd` serving `dist/` plus a mounted `snapshot.json` (see ADR 0002).

## Key Conventions

- Strict TypeScript (`strict: true`); no `any`.
- Prettier is the only formatter; `.claude/` is excluded so vendored agent files stay byte-identical.
- pnpm only: do not commit a `package-lock.json` or `yarn.lock`.

## Coding Principles

SOLID, DRY, conventional OOP. Use the language's power (generics, interfaces, discriminated
unions) where they buy real safety or reuse, **not as decoration**. Strong typing everywhere;
avoid `any`/`unknown` (and other escape hatches) unless fighting the type system genuinely costs
more than it's worth. **YAGNI / KISS:** no abstraction a task doesn't need; restraint over
cleverness. If something is improvable but out of scope, surface it (or file an issue) rather than
silently expanding the change.

## Framework discipline

The frameworks and dependencies here are commitments: **use them properly**. Prefer their idioms
over hand-rolling, reference the docs, and stay current with releases (Dependabot opens the PRs).

## Release Hygiene (trunk-based)

- Branch off `main`; every change lands through a PR.
- Conventional Commits; enable the template once with `git config commit.template .gitmessage`.
- A `CHANGELOG.md` `[Unreleased]` bullet in the same PR as any user-facing change.
- Bump `package.json` version and tag `vX.Y.Z` at release only; no per-PR version bumps.

## Workflow

- **Ship a ticket:** `/ticket N` runs the JARVIS loop (issue, a Sonnet "Avenger" builds on a
  branch, PR). The project-local `.claude/skills/ticket/` hardcodes this repo's verify bar.
- **After any PR:** run `/code-review --comment` and the `uncle-bob` craftsmanship agent. Sonnet
  sub-agents auto-fix the **obvious** findings; **non-obvious** ones escalate back to JARVIS (Opus)
  to decide or ask. Iterate until green. You merge, agents don't.
