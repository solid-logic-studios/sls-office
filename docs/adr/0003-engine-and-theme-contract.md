# ADR 0003: Engine and Theme contract

- **Status:** Accepted
- **Date:** 16 November 2026

## Context

Issue #2 replaces the tracer-bullet page with the real Office: an Engine that animates the lab, and
Themes that decide what it looks like. Two more Themes are already filed (#3, #4), so the split
between the two has to hold before they start. The map (solid-logic-studios/infrastructure#221)
sketched a `Theme` interface; this ADR records the contract as built and the rules around it.

## Options considered

What a Theme is:

- **Data and pure drawing functions behind one interface.** The Theme supplies places, looks, words
  and set dressing. The Engine owns every behaviour. A new Theme is a new module.
- **Theme subclasses of Engine classes.** Familiar, but each Theme would then carry behaviour, and a
  fix to a scene would have to be made once per Theme. Rejected.
- **Sprite sheets and a JSON layout.** The most "data" of the three, but it needs an art pipeline
  and image assets before the first Theme exists. The prototype's art is all rectangles; so is ours.

How the Engine draws:

- **Through a `Painter` interface** (rectangle, text, alpha, clip) in art pixels. The page adapts it
  to a canvas; tests use a recording fake. The Engine and Themes need no canvas and no DOM.
- **Directly on a `CanvasRenderingContext2D`.** Less code, but nothing above the canvas could be
  tested in Node, and the issue asks for tests with no canvas.

Canvas text:

- **A built-in 5 by 7 bitmap font.** Original art, no font file, the same width in a test as in a
  browser.
- **A web font** (the prototype used Silkscreen from Google Fonts). A request to a third party from
  a staff-only page, or a third-party file in a public image that must hold only our own work
  (ADR 0002). Rejected.

## Decision

- **The Theme contract lives in `src/contract/theme.ts`**, next to the Snapshot contract, with the
  `Painter` in `src/contract/painter.ts`. These TypeScript types are the single source: the Engine
  and every Theme import them, and nothing else defines the shape.
- **Dependencies point one way.** A Theme imports only from `src/contract/`. The Engine imports only
  from `src/contract/`, itself and the one shared helper `src/assert-never.ts`. A test fails if a
  file under `src/engine/` imports from `src/themes/`, `src/page/` or `src/simulator/`. Only
  `src/main.ts` knows which Themes exist.
- **A Theme supplies no behaviour.** It gives a `layout` (floors, a lift, rooms, homes for each
  part, break spots, stores, the vault), a `cast` function (who plays each VM or workload, and what
  they look like), the founders, the `lines`, the `decor` and the hover `hotspots`. Its drawing
  functions are pure: no `Date`, no randomness, no DOM, no state. Anything that moves is a function
  of the stage's time.
- **The Engine owns behaviour by part.** A part (`worker`, `pod`, `greeter`, `guard`, `checker`,
  `keeper`, `courier`, `wrangler`, `founder`) is a behaviour the Engine implements once. The Theme
  decides who plays it, which is where lab names such as `traefik` and `gatus` are known. The
  Engine knows the Snapshot vocabulary (VM roles, workload kinds) and nothing more about the lab.
- **Two looks.** `person` is drawn by the Engine's one sprite renderer; `box` is a plain rectangle
  for a Theme with no art. The `boxes` Theme uses it and exists to prove the contract: it renders
  the same Snapshot on a different layout with no Engine change.
- **Moods** follow the prototype: under 10% CPU `break` (held until 14%), over 80% CPU `stressed`,
  over 88% memory `swamped`, an OOM kill `fainted` for 4.5 seconds, a down VM or an unhealthy or
  down workload `absent`. `absent` beats `fainted`, which beats `stressed`, then `swamped`, then
  `break`.
- **Events come from differences.** The differ compares each Snapshot with the previous one and
  publishes events on a bus: the Snapshot's own `events`, a VM's `up` flag flipping, and workloads
  appearing or going. A Snapshot with the same `at` as the last one is the same document re-read,
  and publishes nothing. The first Snapshot publishes nothing. So a scene is skipped at worst, never
  replayed. A `deploy` or `oom` subject is a workload id; a `vm-down` or `vm-up` subject is a VM id.
- **Scenes wait for their verdict.** A deploy's `started` and its `healthy` or `rolled-back` arrive
  in different Snapshots, so a scene plays up to the health check and waits, with a time limit. A
  verdict with no `started` plays the whole scene.
- **The Simulator is another `SnapshotSource`**, switched on with `?sim`. It produces Snapshots of
  the same shape, validated against the generated schema in its tests. Every control-room action on
  the lab is a `SimCommand`; the time-of-day slider only moves the sky and goes to the page. The
  Engine cannot tell the Simulator from the live source.
- **Canvas text uses the built-in pixel font**, capitals only. The stage draws at whole device
  pixels per art pixel. At the default zoom it never goes below 1.5 CSS pixels per art pixel, so
  text stays legible on a phone and the stage pans instead of shrinking. The zoom-out button can
  go below that when the viewer asks for the whole Office at once.
- **Nobody walks through a wall.** A floor declares the span characters may walk, and the Theme
  paints a doorway wherever that span crosses a wall.

## Consequences

- A new Theme is one module under `src/themes/`, plus an import and an entry in `THEMES` in
  `src/main.ts`. If it needs an Engine change, the contract is missing something: change the
  contract, not the Engine for one Theme.
- The Theme interface is wider than the map's four-field sketch (it adds founders, the visitor,
  hotspots, the legend and furniture art). Each addition is something the prototype showed that is
  Office-specific and so cannot live in the Engine.
- Themes cannot add a new behaviour, a new carried item (the parcel and strongbox trolleys) or a
  new kind of particle. Those are Engine changes that every Theme then shares. A Theme can add its
  own set dressing, including depth-sorted `props`.
- Which service is the greeter or the checker is decided per Theme, so the mapping from lab names
  to parts is repeated in each Theme. Extract it when the second real Theme (#3) needs it.
- The live Snapshot has no workloads or events until solid-logic-studios/infrastructure#224 and
  #225, so the live Office shows the VM characters and the founders only. `?sim` shows everything.
- The pixel font has capitals, digits and common punctuation only. Tooltips, the log and the rest
  of the page are DOM text in the page's own font.

## Amendment: a Theme may reuse a sibling Theme's world (November 2026, #61)

The Tower (`src/themes/tower/`) is the Office's world on a different layout. Copying the Office's
cast, looks, founders, visitor, lines, legend, Soundscape and VM blurbs into it would be two copies
that drift.

- **A Theme imports from `src/contract/` and, where it reuses another Theme's world, from that
  sibling Theme's modules.** The Tower imports those pieces (and some furniture art and helpers)
  from `src/themes/office/`. Only the layout, places, decor and hotspots are its own.
- The Engine rule is unchanged: nothing under `src/engine/` imports from `src/themes/`.
- **A sibling import points one way.** The Office does not import from the Tower. When a third
  Theme needs the same pieces, move them into a shared module under `src/themes/` rather than
  importing a chain of siblings.
- **Known quirk:** the Engine sends the Standup to `layout.floors[0]`, which is the Tower's
  basement. It works, in an odd room. Putting it in the lobby needs a contract change (an optional
  front spot), which is out of scope here.
