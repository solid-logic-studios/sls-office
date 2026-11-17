# sls-office

[![CI](https://github.com/solid-logic-studios/sls-office/actions/workflows/ci.yml/badge.svg)](https://github.com/solid-logic-studios/sls-office/actions/workflows/ci.yml)
![Node 24](https://img.shields.io/badge/node-24-339933)
![pnpm](https://img.shields.io/badge/pnpm-managed-f69220)

SLS Office renders the Solid Logic Studios lab as an animated, themed pixel-art dashboard. It is
built from an engine, themes and a simulator: the lab's VMs, containers and CI pods are characters
at work, and deploys, backups and outages play out as scenes. It ships as a small static image.

## Run locally

```bash
pnpm install
pnpm dev
```

The page polls `snapshot.json` next to `index.html` every 5 seconds and shows "Waking the office…"
while it is missing or older than 60 seconds.

Add `?sim` to the address to drive the Office from the Simulator instead. A control room appears
under the stage with presets, load sliders and triggers for each scene (deploy, rollback, CI burst,
backup, OOM, VM down). `?theme=boxes` picks the plain test theme; the theme picker in the header
does the same.

## Themes

A Theme supplies the layout, the looks, the lines and the set dressing; the engine owns all the
behaviour. The contract is `src/contract/theme.ts`, and
[ADR 0003](docs/adr/0003-engine-and-theme-contract.md) records the rules. `src/themes/office/` is
the Office; `src/themes/boxes/` is the smallest working Theme.

## Scripts

| Script              | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `pnpm dev`          | Vite dev server                                                 |
| `pnpm typecheck`    | `tsc --noEmit`                                                  |
| `pnpm test`         | `vitest run`                                                    |
| `pnpm build`        | `vite build`, then writes `dist/schema/snapshot.v1.schema.json` |
| `pnpm schema`       | Regenerate the JSON Schema from the Snapshot types              |
| `pnpm voice-lines`  | Write the list of spoken lines the image renders                |
| `pnpm format`       | Apply Prettier                                                  |
| `pnpm format:check` | Prettier check (CI gate)                                        |

## Voices

The image speaks in a natural voice. At build time a `voices` stage renders every line a character can say
with [Piper](https://github.com/rhasspy/piper) into small Ogg Opus clips under `/srv/office/voices` (with a
manifest and an `ATTRIBUTION.txt`), and the page plays a clip when it has one. Piper and each voice model are
pinned in [`voices/models.json`](voices/README.md) by version and SHA-256, and Piper is not in the image.
`pnpm dev` has no clips, so it speaks through the browser's `speechSynthesis`, as does any line without a clip.

Every Office Part and founder is cast as a different speaker of one model, `en_US-libritts-high`, which
has 904 speakers; a few lines are respelt for the ear (`GET /` is said "get slash") in the Theme's `spoken`
map, while the bubbles keep their text. The casting was chosen blind from speaker metadata, so Paul signs it
off by ear in `?sim`. The voice model's licence and credits are in the image at `/voices/ATTRIBUTION.txt`.

To render a few clips locally, download the Piper release for your machine (the version in `voices/models.json`),
fetch the models from the repo root with `node scripts/fetch-voices.ts --out models` (it checks every hash against
`voices/models.json`), install `opus-tools`, then:

```bash
pnpm voice-lines dist-voices/voice-lines.json
node scripts/render-voices.ts --piper path/to/piper --models models \
  --lines dist-voices/voice-lines.json --out dist-voices/clips --limit 5
```

## Snapshot contract

The TypeScript types in `src/contract/snapshot.ts` are the single source. The JSON Schema is
generated from them (never committed) and published with each release as the asset
`snapshot.v1.schema.json`, so the collector can validate against a pinned copy. `cpu` and `mem`
are percentages from 0 to 100. The schema is strict, and `v` bumps on any breaking change. See
[ADR 0002](docs/adr/0002-snapshot-contract-and-static-image.md).

## Image

`ghcr.io/solid-logic-studios/sls-office` is a busybox `httpd` serving the static build as an
unprivileged user on port 8080, with a `HEALTHCHECK`. It needs no writes, so it is meant to run with a read-only root filesystem.
`snapshot.json` is not baked in: mount it at `/srv/office/snapshot.json`.

```bash
cp fixtures/snapshot.sample.json /tmp/snapshot.json
docker run --rm --read-only -p 8080:8080 \
  -v "/tmp/snapshot.json:/srv/office/snapshot.json:ro" \
  ghcr.io/solid-logic-studios/sls-office:0.1.1
```

The copy's `at` is stale, so the page shows "Waking the office…" until `at` is recent. In another
terminal, refresh the copy every 30 seconds (it is rewritten in place, so the running container
sees it, and the tracked fixture is never touched):

```bash
while true; do
  node -e 'const fs=require("fs"),f="/tmp/snapshot.json",s=JSON.parse(fs.readFileSync(f,"utf8"));s.at=new Date().toISOString();fs.writeFileSync(f,JSON.stringify(s,null,2)+"\n")'
  sleep 30
done
```

Edit the copy in place (do not replace it, as a bind mount follows the original file) and the moods
change without a reload. The page goes back to "Waking the office…" 60 seconds after the last refresh.

Tags published: `X.Y.Z` and `X.Y` from each `vX.Y.Z` release tag only (no `latest`). CI builds
the image on every PR and push to `main` but never pushes it.

**GHCR visibility: public** (solid-logic-studios/infrastructure ADR-0018), so the Compute host
pulls with no credential. Public cannot be undone, and anyone can pull every published version, so
the image must never hold anything internal, secret or third-party: no lab data (the snapshot is
mounted at run time), no fixtures, no source maps. Releases are pushed with `provenance: false`
and `sbom: false`, because those attestations carry the GitHub event payload (commit messages,
emails, repository metadata). This repository stays private.

## Pi kiosk

Sound is on by default (the Alarm, see [ADR 0004](docs/adr/0004-office-audio.md)). Browsers block audio
until the page has had a tap or key press, so until then the speaker button beside Pause reads "Tap to
enable". The Pi kiosk often has nobody to tap it, so launch Chromium with the autoplay flag:

```bash
chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://<host>:8080/
```

The speaker button mutes and unmutes, and the choice is remembered per browser. Add `?mute` to the URL
(`http://<host>:8080/?mute`) to force a screen silent; that overrides the saved choice and does not change it.

Quiet hours run from 22:00 to 07:00 local time by default. During them Alarms still sound, at half volume,
and everything else (the ambient bed, effects, speech, Reminders and All-clears) is silent. Change the window
with `?quiet=22-7`: two whole hours from 0 to 23, which wraps past midnight when the start is later than the end.
`?quiet=0-0` turns quiet hours off, and an invalid value falls back to the default. In `?sim` the time-of-day
slider moves the clock, so you can try them.

`?sim` also has a Sound panel in the control room: a button for every sound in the current Theme (the Alarm,
Reminder and All-clear, each effect and a sample line per Voice), a master volume that applies to every channel
and is remembered per browser, and an "Ignore quiet hours" switch for testing by day. Mute and quiet hours still
apply to the buttons unless that switch is on.

Tap an empty part of the stage to hear the lab's status: a founder says how many rooms are up and down, who is
worst off and any critical findings. Taps on characters, rooms and hotspots show their tooltips as before.

At 09:00 local, once a day, a founder (a different one each day) walks to the front and sums up the last 24 hours
of the Office log: deploys, rollbacks, faults, backups, and the busiest and calmest rooms. It is skipped when muted
or in quiet hours, and a reload the same morning does not repeat it; the `?sim` Sound panel has a Standup now button.

The Music button beside the speaker button turns on a quiet chiptune score (off by default, and the choice is
remembered per browser). Its tempo follows the lab's load, from a slow head-nod when idle to a brisk walk when
every VM is busy, and it is silent when muted and in quiet hours.

A few small surprises are tucked in, all quiet effects that follow mute and quiet hours: a fainted character
snores until it recovers, a long run of days with no Alarm earns a jingle, and the kettle goes on at morning tea.
The rest you can find in `?sim`, where the Sound panel plays each of them.

## Contributing

See [`CLAUDE.md`](CLAUDE.md) (canonical), [`AGENTS.md`](AGENTS.md) and [`CONTEXT.md`](CONTEXT.md).
