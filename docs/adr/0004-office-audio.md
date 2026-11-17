# ADR 0004: Office audio

- **Status:** Accepted
- **Date:** 17 November 2026

## Context

The Office runs all day on a small screen with speakers on Paul's desk (a Raspberry Pi in a
Chromium kiosk, 13 inch touchscreen). It is silent, so a fault in the lab is only noticed if
someone looks. We want to hear the Office: Alarms when something breaks, the cast talking, the
hum of a busy lab.

The page is a static image with no server beyond `httpd` (ADR 0002), and the image is public. The
Engine is silent and draws only through the `Painter` (ADR 0003). Every line a character says comes
from the Theme's fixed line banks (105 unique lines in the office Theme today); none is templated.

## Options considered

Where audio lives:

- **Page Soundboard playing a Theme Soundscape.** The Engine stays unchanged and silent. The
  Soundboard subscribes to the Engine's bus and reads `engine.characters()` and `engine.findings`,
  which already carry the speaker's Part, position and mood. The Theme supplies what it sounds like
  as data. Chosen: the same split as looks and lines.
- **An `Audio` interface in the Engine, like the `Painter`.** Testable in Node, but it widens the
  Engine for something only the page needs, and the bus already reports everything audible.
- **Sounds hard-coded in the page.** Simplest, but every Theme would sound the same.

How speech is voiced:

- **Piper, rendered at image build time, with `speechSynthesis` as the fallback.** Natural voices
  with no runtime cost on the Pi. Chosen.
- **`speechSynthesis` only.** No build step, but on the Pi's Chromium it is espeak, which is very
  robotic, and it differs per device.
- **A cloud TTS service.** Better voices, but a paid key, a third-party request from the page or the
  build, and output whose licence may not allow a public image.

Where Piper runs:

- **A `voices` stage in the Dockerfile.** Pinned, cached by layer, and git stays free of binaries.
  Chosen.
- **Rendered locally and committed.** No Piper in CI, but several megabytes of clips in git that go
  stale whenever a line changes.
- **A separate CI job handing clips to the Docker build.** The same output with more wiring.

Sound effects and music:

- **Synthesised in the browser with Web Audio** from sfxr-style parameter sets. No files, no
  licences to track, and the chiptune character suits the pixel art. Chosen.
- **Recorded CC0 files.** Richer, but they need sourcing, licence records and image space.

## Decision

- **The Soundboard lives in `src/page/audio/`** and is the only code that touches Web Audio or
  `speechSynthesis`. It subscribes to the bus and reads the Engine's existing read-only views. The
  Engine gains no audio code; if the Soundboard needs something the bus does not carry, the bus
  gains an event, as it would for any other subscriber.
- **The Theme contract gains an optional `soundscape`** (`src/contract/theme.ts`): data only. It
  maps bus event kinds and Alarm triggers to sound parameter sets, gives a Voice per Part and per
  founder, the ambient bed, the music and the Announcement vocabulary. A Theme without one is
  silent. `boxes` gets a minimal Soundscape to prove the contract.
- **Voices are per Part, plus one per founder.** The Soundboard varies pitch and rate a little from
  a hash of the character's id, so two workers sound related but distinct. This keeps Piper to about
  ten voice models.
- **Four channels, ranked:** Alarm > speech > effect > ambient (music sits with ambient).
  - An Alarm interrupts speech and ducks everything else.
  - Speech: one speaker at a time, a queue of at most 2, lines older than 4 s are dropped, and at
    most one voiced line per 8 s. Every bubble is still shown; only some are voiced.
  - Effects: the same sound at most once per 1.5 s.
  - Ambient: a continuous bed (room tone, server hum rising with load, keyboard clatter rising with
    mood), ducked under speech.
- **Effects are spatial.** Panned by the character's x position and quieter for other floors.
- **Alarm triggers:** `oom`, `vm-down`, deploy `rolled-back`, backup `failed`, and `findings.crit`
  going from 0 to more than 0. Each sounds once, on the edge. While `crit` stays above 0, a soft
  Reminder plays every 10 minutes. `vm-up` and `crit` returning to 0 play the All-clear. There is
  no acknowledge control.
- **Quiet hours** are 22:00 to 07:00 local by default, set with `?quiet=22-7`. During them Alarms
  play at half volume and nothing else plays, Reminders included.
- **Sound is on by default; music is off by default.** A speaker button mutes, and the choice is
  remembered per browser (`localStorage`). Browsers block audio until the first click, so a normal
  browser stays silent until then; the speaker button shows a "tap to enable" state while blocked.
  `?mute` forces it off. The Pi kiosk launches Chromium with
  `--autoplay-policy=no-user-gesture-required`, documented in the README.
- **Piper renders in a `voices` Dockerfile stage.** The Piper release and every voice model are
  pinned by version and SHA-256. The build stage emits the list of (Voice, text) pairs from the
  Themes, rendering only the Voices that can say each line, plus each Theme's Announcement
  vocabulary. The stage writes `dist/voices/*.ogg` and a manifest keyed by a hash of Voice and text.
  At runtime the Soundboard plays the clip when the manifest has it, else falls back to
  `speechSynthesis`. `pnpm build` and the tests stay Node-only, so `pnpm dev` speaks through
  `speechSynthesis`.
- **Only permissively licensed voices.** The image is public, so each voice model's dataset licence
  must allow redistributing its output (public domain or CC-BY style). The repo records each
  voice's licence and source next to its pin, and any attribution goes in the image.
- **Announcements are stitched.** The Standup (a founder summing up the last 24 hours of the Office
  log at 09:00) and the spoken status (tap an empty part of the stage) are composed from the
  Theme's fixed vocabulary (number words, mood words, Part titles such as "the gateway", stock
  phrases), pre-rendered by Piper. Anything outside the vocabulary falls back to `speechSynthesis`.
- **In scope as extras:** the Standup, the spoken status on tap, easter eggs (a fainted character
  snores, an uptime-streak jingle) and procedural chiptune music whose tempo follows lab load.

## Consequences

- The Theme contract grows again. A new Theme can stay silent, and gains audio without an Engine
  change.
- The Docker build gains a Python/binary stage and some build time on a cache miss. Changing a
  line re-renders only through the cache key, which covers the whole line list, so any line change
  re-renders every clip.
- The image grows by the rendered clips (a few megabytes).
- Dev and the tests never hear Piper; Piper's output is only checked by building the image.
- Tap-to-speak status shares the stage with tooltips and drag-to-pan, so a tap on a character or
  hotspot keeps its current meaning and only a tap on empty stage speaks.
- `speechSynthesis` fallback sounds different on every device, which is accepted for dev and for
  anything outside the vocabulary.
