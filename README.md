# sls-office

[![CI](https://github.com/solid-logic-studios/sls-office/actions/workflows/ci.yml/badge.svg)](https://github.com/solid-logic-studios/sls-office/actions/workflows/ci.yml)
![Node 24](https://img.shields.io/badge/node-24-339933)
![pnpm](https://img.shields.io/badge/pnpm-managed-f69220)

SLS Office renders the Solid Logic Studios lab as an animated, themed pixel-art dashboard. It is
built from an engine, themes and a simulator. The tracer bullet is in: a versioned Snapshot
contract and a minimal page that draws one plain character per VM, shipped as a small static image.

## Run locally

```bash
pnpm install
pnpm dev
```

The page polls `snapshot.json` next to `index.html` every 5 seconds and shows "Waking the office…"
while it is missing or older than 60 seconds.

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
  ghcr.io/solid-logic-studios/sls-office:main
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

Tags published: `main`, `sha-<short>` and `sha-<long>` from each push to `main`, and `X.Y.Z` and
`X.Y` from each `vX.Y.Z` release tag (no `latest`).

**GHCR visibility:** this repo is private, so the package is private by default and the Compute
host needs a pull credential unless the package is made public. That decision belongs to
solid-logic-studios/infrastructure#222's ADR-0018, which is not yet written.

## Contributing

See [`CLAUDE.md`](CLAUDE.md) (canonical), [`AGENTS.md`](AGENTS.md) and [`CONTEXT.md`](CONTEXT.md).
