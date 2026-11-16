# ADR 0002: Snapshot contract and static image

- **Status:** Accepted
- **Date:** 16 November 2026

## Context

The tracer bullet (issue #1) needs a data contract between the infrastructure collector, which
writes `snapshot.json`, and the page that reads it. It also needs a delivery format the Compute
host can pin and run. Both sides are developed separately, so the contract must be explicit,
versioned and testable from either repo.

## Options considered

Contract source:

- **TypeScript types as the single source, JSON Schema generated and published per release.**
  Idiomatic types in the browser bundle, no schema validator shipped to the page, only a shallow guard (`isSnapshot`).
- **Hand-written JSON Schema.** Language-neutral, but it drifts from the types and doubles the
  maintenance.
- **zod or typebox as a runtime source.** One definition, but it puts a validator in the browser
  bundle and makes the types less idiomatic. Rejected.

Image:

- **busybox `httpd`.** Tiny, runs as an unprivileged uid on one port, writes nothing.
- **nginx-unprivileged.** Familiar, but needs writable temp dirs, which fights a read-only root
  filesystem.
- **Caddy.** Capable, but larger than a static page needs.

## Decision

- Types in `src/contract/snapshot.ts` are the single source. A JSON Schema is generated from them
  with `ts-json-schema-generator`, never committed, and attached to each GitHub Release as
  `snapshot.v1.schema.json`. The collector's tests validate against a pinned copy. Validating the
  fixtures against the schema is part of this repo's tests.
- `cpu` and `mem` are percentages from 0 to 100.
- The v1 schema is strict (`additionalProperties: false`). `v` bumps on any breaking change.
  Additive optional fields are allowed without a bump only in a minor release, and only if the
  schema is regenerated and published with it.
- The image is busybox `httpd` running as uid 65534 on port 8080, serving the Vite build from a
  root-owned `/srv/office`, with a read-only root filesystem and a `HEALTHCHECK`. The build does
  not contain `snapshot.json`; the host mounts it read-only at `/srv/office/snapshot.json`.
- Image: `ghcr.io/solid-logic-studios/sls-office`, tagged `X.Y.Z` and `X.Y` from each `vX.Y.Z`
  release tag only (no `latest`). The release builds version tags from the tagged commit, and that
  commit is in the OCI `revision` label. **Amended (v0.1.1):** CI no longer pushes `main` and
  `sha-*` images; it builds without pushing.
- **Amended (v0.1.1):** the GHCR package is public (solid-logic-studios/infrastructure ADR-0018), so
  hosts pull with no credential. Public is one-way, so only reviewed releases are published, with
  no provenance or SBOM attestation (their GitHub event payload would be public too).

## Consequences

- Changing the contract means editing one TypeScript file; the schema and the release asset follow.
- The browser runs only the shallow guard. A file that fails it shows the waking state; deeper
  errors (such as an out-of-range `cpu`) are drawn as given.
- The image has no shell tooling beyond busybox and no TLS; the edge in front of it handles that.
- Anything in the image or its metadata is public: it holds only the static page and its art.
