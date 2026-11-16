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
| `pnpm format`       | Apply Prettier                                                  |
| `pnpm format:check` | Prettier check (CI gate)                                        |

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

## Contributing

See [`CLAUDE.md`](CLAUDE.md) (canonical), [`AGENTS.md`](AGENTS.md) and [`CONTEXT.md`](CONTEXT.md).
