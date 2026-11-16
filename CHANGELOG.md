# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/solid-logic-studios/sls-office/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/solid-logic-studios/sls-office/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/solid-logic-studios/sls-office/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/solid-logic-studios/sls-office/releases/tag/v0.1.0
