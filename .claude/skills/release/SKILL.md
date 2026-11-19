---
name: release
description: Cut a release of sls-office. Works out the next version from CHANGELOG `[Unreleased]`, bumps package.json, rolls the CHANGELOG, runs the gate and opens a `chore(release): vX.Y.Z` PR. Merging that PR tags and publishes the image automatically (tag-release.yml). Use when the user says "release", "/release", "cut a release", "tag and release", "ship vX.Y.Z" or "publish the image".
---

# /release: cut an sls-office release

A release is a PR that bumps `package.json` and rolls `CHANGELOG.md`. **The user merges it; the merge
does the rest.** `.github/workflows/tag-release.yml` sees a version on `main` with no tag, tags the
merge commit `vX.Y.Z` and calls `release.yml`. That workflow runs the gate, pushes
`ghcr.io/solid-logic-studios/sls-office:X.Y.Z` and `:X.Y`, and creates the GitHub Release with
`snapshot.v1.schema.json` and the CHANGELOG section as notes. Never tag or push a tag yourself
unless the automation failed and the user asks.

Arguments: optional, an explicit version (`/release 0.6.0`) or a bump (`/release minor`).

## 1. Check the starting point

- `git status` is clean and `main` is up to date with origin: `git switch main && git pull --ff-only`.
  If the tree is dirty, stop and say so; don't stash the user's work for a release.
- Note the last tag (`git tag --sort=-v:refname | head -1`) and the `package.json` version. They
  should match. If they don't, a release PR is already merged but untagged: check the latest
  `tag-release.yml` run (`gh run list --workflow tag-release.yml -L 3`) rather than bumping again.
- No open release PR already (`gh pr list --search "chore(release) in:title"`).

## 2. Work out the version

Read `## [Unreleased]` in `CHANGELOG.md`. **If it has no entries, stop**: there is nothing to release.

- An explicit version or bump in the arguments wins.
- Otherwise, using Keep a Changelog headings:
  - anything breaking (a `### Removed` entry, or an entry that says it breaks the Snapshot contract,
    the image's mount or run contract, or a URL parameter): **ask the user**. Pre-1.0 this is a minor
    bump by convention, but it is their call.
  - any `### Added` or `### Deprecated` entry (SemVer makes a deprecation a minor), or any additive
    Snapshot contract change (ADR 0002 allows those only in a minor): **minor**.
  - only `### Fixed`, `### Changed` or `### Security`: **patch**.
- State the version and the reason in one line, then carry on. No need to wait for a reply unless
  the version came from the breaking-change rule.

## 3. Branch and edit

```bash
git switch -c chore/release-vX.Y.Z
```

- `package.json`: set `"version": "X.Y.Z"`. Nothing else in the file.
- `CHANGELOG.md`:
  - Insert `## [X.Y.Z] - <today, e.g. 19 November 2026>` straight under `## [Unreleased]`. That moves
    every Unreleased entry into the new section and leaves `[Unreleased]` empty.
  - Links at the bottom: point `[Unreleased]` at `compare/vX.Y.Z...HEAD`, and add
    `[X.Y.Z]: https://github.com/solid-logic-studios/sls-office/compare/v<previous>...vX.Y.Z`
    under it.

## 4. Gate

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm typecheck && TZ=UTC pnpm test && pnpm build
```

All green, or stop and report.

## 5. Commit, push, open the PR

Stage exactly `package.json` and `CHANGELOG.md`. Use the commit message `chore(release): vX.Y.Z` with
the Co-Authored-By trailer. Then `git push -u origin chore/release-vX.Y.Z`, and
`gh pr create --base main --title "chore(release): vX.Y.Z"` with a body that covers:

- One line on what the release holds (the CHANGELOG section's bullets, summarised, with issue refs).
- The version bump and the reason.
- The gate result (file and test counts).
- "On merge, tag-release.yml tags `vX.Y.Z` and publishes `:X.Y.Z` and `:X.Y`."

A release PR is not a draft: there is nothing to review-loop. Then switch back to `main`.

## 6. After the user merges

Only when the user says it is merged:

- `gh run list --workflow tag-release.yml -L 1` and watch that run (`gh run watch <id> --exit-status`,
  in the background).
- Confirm the result: `gh release view vX.Y.Z --json tagName,url,assets` and the image tags.
- If the run failed, read its log and report. Recovery, only on the user's go-ahead:
  - The tag was pushed but the publish failed: **re-run the run** (failed jobs or all). The tag job
    sees the tag with no Release and publishes again. Or run `release.yml` by hand:
    `gh workflow run release.yml -f tag=vX.Y.Z`.
  - No tag was made (the tag job failed or was cancelled): fix forward, or push the tag by hand on
    the release PR's merge commit (`git tag -a vX.Y.Z -m vX.Y.Z <merge sha> && git push origin vX.Y.Z`),
    which starts `release.yml` directly.

## Guardrails

- Never bump the version in a feature PR. Releases happen only here.
- Never push to `main`, and never merge the release PR.
- The image is public (ADR 0002, amended): a release publishes for good. If anything in
  `[Unreleased]` looks unfinished or unreviewed, ask before cutting.
