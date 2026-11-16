# sls-office: Context & Ubiquitous Language

The shared vocabulary for this codebase. Use these terms exactly and avoid the listed synonyms so
code, docs, and conversation stay aligned. The canonical engineering guide is [`CLAUDE.md`](CLAUDE.md).

## Domain language

Sharpen each entry as the matching module lands.

**Office**: the whole dashboard, the lab rendered as an animated pixel-art dashboard.
_Avoid_: app, game, view.

**Engine**: the rendering and animation core (render loop, moods, walking, scenes, sprites, bubbles,
tooltips). Theme- and lab-agnostic: it knows the Snapshot vocabulary and nothing else about the lab.
_Avoid_: renderer (for the whole engine), framework.

**Theme**: a swappable visual skin (layout, looks, lines, set dressing) that the Engine consumes as
data and pure drawing functions. It supplies no behaviour.
_Avoid_: skin, style, template.

**Simulator**: the source of synthetic lab activity that drives the Office when no live data is
wired up (`?sim`). Its control room sends it commands.
_Avoid_: mock, fake, demo mode.

**Snapshot**: the versioned JSON the collector writes; the Engine's only input.
_Avoid_: state, payload, status feed.

**SnapshotSource**: where the page gets Snapshots (live HTTP, fixture, Simulator).
_Avoid_: provider, loader, data layer.

**Painter**: the drawing surface the Engine and Themes share (rectangle, text, alpha, clip) in art
pixels. The page adapts it to a canvas.
_Avoid_: canvas, context, renderer.

**Part**: the behaviour a character plays, owned by the Engine: worker, pod, greeter, guard, checker,
keeper, courier, wrangler, founder. The Theme decides who plays each part.
_Avoid_: role (that is a VM's role in the Snapshot), type, class.

**Look**: what a character looks like, supplied by the Theme: a person or a plain box.
_Avoid_: sprite, skin, avatar.

**Place**: a piece of furniture or a post that one character calls home in a Theme's layout.
_Avoid_: station, desk (for the concept; an Office desk is one kind of Place), slot.

**Room**: the area of a Theme's layout that stands for one VM. It is dimmed while the VM is down.
_Avoid_: zone, area, station.

**Scene**: a scripted sequence the Engine plays for a lab event (deploy, rollback, vault run, pod
run). A Scene waits for its verdict, which arrives in a later Snapshot.
_Avoid_: animation, cutscene, effect.

**Cue**: a fixed moment in a Scene where a character speaks a line from the Theme.
_Avoid_: trigger, prompt.

**Mood**: a character's state derived from up/down, CPU, memory and workload health: break, working,
stressed, swamped, fainted, absent.
_Avoid_: status, state, emotion.

## Versioning (trunk-based)

Work off `main`; Conventional Commits + Keep a Changelog; bump version + tag at release;
`package.json` version == latest tag; no per-PR bumps.
