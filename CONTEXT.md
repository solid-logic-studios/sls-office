# sls-office — Context & Ubiquitous Language

The shared vocabulary for this codebase. Use these terms exactly and avoid the listed synonyms so
code, docs, and conversation stay aligned. The canonical engineering guide is [`CLAUDE.md`](CLAUDE.md).

## Domain language

Seeded from the project description; sharpen each entry as the matching module lands.

**Office**: the whole dashboard, the lab rendered as an animated pixel-art scene.
_Avoid_: app, game, view.

**Engine**: the rendering and animation core (render loop, sprites, timing). Theme- and
lab-agnostic.
_Avoid_: renderer (for the whole engine), framework.

**Theme**: a swappable visual skin (palette, sprite sheets, layout) that the engine consumes as data.
_Avoid_: skin, style, template.

**Simulator**: the source of synthetic lab activity that drives the Office when no live data is wired up.
_Avoid_: mock, fake, demo mode.

## Versioning (trunk-based)

Work off `main`; Conventional Commits + Keep a Changelog; bump version + tag at release;
`package.json` version == latest tag; no per-PR bumps.
