# sls-office: Context & Ubiquitous Language

The shared vocabulary for this codebase. Use these terms exactly and avoid the listed synonyms so
code, docs, and conversation stay aligned. The canonical engineering guide is [`CLAUDE.md`](CLAUDE.md).

## Domain language

Sharpen each entry as the matching module lands.

**Office**: the whole dashboard, the lab rendered as an animated pixel-art scene.
_Avoid_: app, game, view.

**Engine**: the rendering and animation core (render loop, sprites, timing). Theme- and
lab-agnostic.
_Avoid_: renderer (for the whole engine), framework.

**Theme**: a swappable visual skin (palette, sprite sheets, layout) that the engine consumes as data.
_Avoid_: skin, style, template.

**Simulator**: the source of synthetic lab activity that drives the Office when no live data is wired up.
_Avoid_: mock, fake, demo mode.

**Snapshot**: the versioned JSON the collector writes and the Engine's only input.
_Avoid_: state, payload, status feed.

**SnapshotSource**: where the page gets Snapshots (live HTTP, fixture; Simulator later).
_Avoid_: provider, loader, data layer.

**Station**: a place a role lives in a Theme's layout (compute, data, deploy, ci, host, offsite,
vault, break spots).
_Avoid_: desk, room, slot.

**Scene**: a scripted sequence the Engine plays for a lab event (deploy, rollback, vault run, pod
spawn).
_Avoid_: animation, cutscene, effect.

**Mood**: a character's state derived from CPU, memory and health: break, working, stressed,
swamped, fainted, absent. The tracer bullet uses only absent, break, working and stressed.
_Avoid_: status, state, emotion.

## Versioning (trunk-based)

Work off `main`; Conventional Commits + Keep a Changelog; bump version + tag at release;
`package.json` version == latest tag; no per-PR bumps.
