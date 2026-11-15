# ADR 0001: TypeScript, Vite and pnpm, trunk-based

- **Status:** Accepted
- **Date:** 16 November 2026

## Context

SLS Office is a new browser dashboard: an animated, themed pixel-art view of the lab, split into an
engine, themes and a simulator. The repo starts empty, so the toolchain and release model need
fixing before the first code so CI, Dependabot and the docs have something real to describe.

## Options considered

- **TypeScript + Vite + pnpm, single package.** Matches the other Solid Logic Studios front ends
  (`website`, `wicked_stickers`); fast dev server, strong typing, one lockfile.
- **TypeScript + Vite + pnpm workspaces.** Separate engine / themes / simulator packages from day
  one; clean boundaries, but versioning and build overhead before there is code to justify it.
- **Plain JavaScript.** Less setup, but loses the type safety a sprite/animation engine benefits from.

## Decision

TypeScript + Vite + pnpm in a single package, Node 24, released trunk-based off `main`. Engine,
themes and simulator start as folders with clear boundaries rather than packages.

## Consequences

- One `package.json`, one CI job, one Dependabot ecosystem (`npm`) plus GitHub Actions.
- Splitting into workspaces later is a deliberate move that needs its own ADR, likely alongside a
  switch to gitflow if the parts start releasing independently.
- Boundaries between engine, themes and simulator are enforced by convention and review, not by
  package lines.
