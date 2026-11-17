# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The Office sounds an Alarm when the lab breaks (an OOM kill, a VM down, a rolled-back deploy, a failed backup, or the first critical finding), synthesised in the browser with no audio files. Where the browser blocks autoplay it stays silent until the first click or key press (#23).
- A speaker button beside Pause mutes the Office. The choice is remembered per browser, `?mute` starts a screen silent without saving, and the button reads "Tap to enable" while the browser blocks audio. The README explains the Chromium autoplay flag for the Pi kiosk (#24).
- A soft Reminder sounds every 10 minutes while a critical finding stays open, and an All-clear sounds when a VM comes back or the last critical finding closes (#25).
- Stage sound effects for deploys, paper, visitors, check-ins, workloads arriving and leaving, and backups, synthesised in the browser. Each is panned by where it happens, quieter on other floors, sounds at most once per 1.5 seconds, and is ducked under the Alarm (#26).
- A quiet ambient bed runs under the Office: room tone, a server hum that rises with lab load and keyboard clatter that quickens as the workers get busier. It is ducked under the Alarm and stops when muted (#27).
- Speech bubbles are spoken aloud through the browser's `speechSynthesis`, each character in its Part's Voice (founders have their own) with a little per-character variation. One line at a time, at most one every 8 seconds, stale lines dropped, and the ambient bed ducks while someone talks. The Alarm interrupts speech and holds it back, and Mute now cuts off a line mid-sentence (#28).
- The image speaks in a natural Piper voice: every line a character can say is rendered at build time (Piper is pinned by version and SHA-256, and a voice must be public domain or CC BY and trained from scratch) and played from a clip, with the browser's `speechSynthesis` as the fallback for `pnpm dev` and any line without a clip. Each character keeps its small pitch variation, and the Alarm and Mute cut a clip off like any other line (#29).
- Each Office Part and founder has its own Piper voice (one pinned LibriTTS model, a speaker per character, so the guard and the courier no longer sound alike), and tricky lines are spoken naturally: symbols and initialisms are read as words, trailing ellipses dropped and some slang respelt, through a Theme's `spoken` overrides while the bubbles stay as written (#30).
- Quiet hours, 22:00 to 07:00 local by default and set with `?quiet=22-7` (`?quiet=0-0` turns them off): Alarms still sound at half volume, and the ambient bed, effects, speech, Reminders and All-clears stay silent until they end (#31).
- A Sound panel in the `?sim` control room: play any sound in the current Theme (the cues, each effect and a sample line per Voice), set a master volume that applies to every channel and is remembered per browser, and ignore quiet hours while testing (#32).
- Spoken status: tap an empty part of the stage and a founder says how many rooms are up and down, who is worst off and any critical findings, stitched from each Theme's fixed vocabulary of Piper clips, with `speechSynthesis` for anything outside it (#33).
- Standup: at 09:00 local, once a day, a founder (a different one each day) walks to the front and sums up the last 24 hours of the Office log (deploys, rollbacks, faults, backups, the busiest and calmest rooms) in their own Voice. It is skipped when muted or in quiet hours, and a reload does not repeat it; the `?sim` Sound panel has a Standup now button (#34).
- Audio: easter eggs, all quiet effects ranked below the Alarm: a fainted character snores until it recovers, an uptime streak (7, 30, 100 and 365 days with no Alarm) earns a jingle once per milestone, a kettle comes to the boil at 10:30 (smoko), and three healthy deploys in a row are a hat-trick; each follows the effect throttle, mute and quiet hours, and the `?sim` Sound panel can play them (#35)

## [0.2.1] - 17 November 2026

### Fixed

- The page stops polling `snapshot.json` while its tab is hidden and polls again at once when shown, so a forgotten background tab no longer keeps the lab collector awake (#15).
- A deploy scene now waits up to 200 s for its verdict (was 30 s), so a `rolled-back` or slow `healthy` verdict that arrives minutes after `started` plays its scene instead of being absorbed (#17).

## [0.2.0] - 16 November 2026

### Added

- The Engine and the Theme contract (ADR 0003): moods, walking, speech bubbles, tooltips and scenes for a deploy (healthy and rolled back), a CI burst, an OOM kill, a VM outage and the backup vault run.
- The Office theme, ported from the prototype, and a plain `boxes` test theme, with a theme picker (`?theme=`).
- The Simulator and its control room, reached with `?sim`.

### Changed

- The page draws the Office in place of one plain character per VM. Canvas text uses a built-in pixel font and stays legible at phone width, Site instance names show in full on hover, and characters use doorways.

## [0.1.1] - 16 November 2026

### Changed

- The GHCR package is public (solid-logic-studios/infrastructure ADR-0018): only release tags (`X.Y.Z`, `X.Y`) are pushed, CI builds the image without pushing it (no more `main` and `sha-*` tags), and releases carry no provenance or SBOM attestation.

## [0.1.0] - 16 November 2026

### Added

- Snapshot contract v1 types and a generated JSON Schema, published as a release asset.
- Minimal VM moods page with a "Waking the office…" state when the snapshot is missing or stale.
- Static image `ghcr.io/solid-logic-studios/sls-office` built by CI.

[Unreleased]: https://github.com/solid-logic-studios/sls-office/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/solid-logic-studios/sls-office/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/solid-logic-studios/sls-office/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/solid-logic-studios/sls-office/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/solid-logic-studios/sls-office/releases/tag/v0.1.0
