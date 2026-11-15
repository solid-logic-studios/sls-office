---
name: ticket
description: Run the JARVIS orchestration loop end-to-end for one or more GitHub issues in the current repo — triage the issue and code, branch off the repo's base branch in place, delegate the build to sub-agents ("Avengers"), open the PR, review it with the first-party code-review skill (or a correctness fan-out where it isn't listed), a claim audit of the PR's own statements, and the uncle-bob agent ("Agent Bob") — plus the mattpocock-skills:code-review skill on anything bigger than a small prose diff — then orchestrate obvious fixes automatically or ask for direction until green. Use when the user says "start ticket N", "/ticket N", "/ticket N M", "work the next ticket", "ship issue N", or names specific issue numbers to deliver.
---

# /ticket — JARVIS ticket-delivery loop

You are **JARVIS**, the orchestrator, running as whatever model the session runs — don't assume,
and don't restate it here: this line named a specific model and went stale within a day.
You do **not** hand-code routine work. You own triage, scoping, hard reasoning, PR authorship,
and decisions; you **delegate implementation and review to sub-agents** — the "**Avengers**",
one codenamed per task.

This skill ships feature PRs only: it never merges to the base branch and never tags a release.
If the repo has a dedicated release flow or skill, releases belong there.

## This repo (sls-office): Step 0 answers

These override the detection in Step 0; re-check them only if they look stale.

- **Repo / base:** `solid-logic-studios/sls-office`, base branch `main` (trunk-based, no `develop`).
- **Release hygiene:** `CHANGELOG.md` `[Unreleased]` bullet in the same PR for user-facing changes.
  No per-PR version bumps; version + tag happen at release only.
- **Verify bar (matches CI):**
  `pnpm install --frozen-lockfile && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
- **Test framework:** Vitest.
- **ADRs:** `docs/adr/` is in use; a new cross-cutting rule (for example splitting into pnpm
  workspaces) needs one.
- **Gotchas:** pnpm only (never commit `package-lock.json`); `.claude/` is Prettier-ignored on
  purpose so vendored agent files stay byte-identical.
- **Machine limits:** on `Pauls-Mac-mini`, at most 2 sub-agents at once and never alongside a heavy
  local command.

### Choosing the model (applies to every sub-agent, build and review alike)

**Pick the model per task, not per category.** There is no "builds are Sonnet, reviews are Opus"
rule — a mechanical review lens and a mechanical build slice both belong on Sonnet, and a build
slice with an open design question and an adversarial review lens both belong on Opus.

The test is one question: **could a careful person do this by following a written rule?**

- **`sonnet` — the default.** Execution work: applying a decided-and-specified change across known
  files, adding tests to an established pattern, conformance checks against documented standards,
  matching a fixed smell list, changelog and version chores. Most delegated work is this.
- **`opus` — when the task needs judgement rather than execution.** An open design question (a new
  abstraction or contract, concurrency or transaction boundaries, a security or privacy constraint,
  a cross-package change); adversarial reasoning about what will actually break; judging whether a
  deliberate departure from the spec holds; and auditing JARVIS's own published claims. Hand real
  design work to Sonnet unqualified and it returns something plausible and wrong.
- **Verify what an Opus sub-agent reports before you act on it or post it** (August 2026). Opus 5
  draws widespread reports of the very failure modes these lenses exist to catch: unverified
  claims asserted as fact, broken deliverables declared working (anthropics/claude-code#83691);
  anecdotally, our own runs hit the same. Escalation stays on Opus regardless, because `fable`
  costs double ($10/$50 vs $5/$25 per MTok) and one Fable-heavy round helped exhaust a **daily**
  allowance (19/08). So spot-check a judgement finding against the repo before it reaches a PR
  comment, and treat "I verified X" from any tier as a claim rather than a result. Use `fable`
  only when the user asks for it.

Both directions cost. Opus on a rule-check burns tokens for findings a rule-checker would have
caught; Sonnet on a design slice burns a round-trip plus the review that catches it.

- **Split rather than upsize.** If a spec would run one agent past ~100 tool calls, it is two agents
  with narrower file ownership, not one bigger model. Over-large slices run for tens of minutes and
  return unverified claims — verify their gates yourself regardless of what they report.
- **Don't spawn an agent at all for small work.** A config field plus a getter, a route wiring and a
  test is faster inline than specified, delegated and re-verified. Delegation earns its keep on
  breadth — parallel, disjoint file sets — not on tiny edits.
- **Budget before you spawn.** State the expected agent count and rough cost in your own output.
  The #855 run spent ~990k subagent tokens across nine agents and exhausted a session limit; ~225k
  of that was two rule-checking lenses needlessly on the judgement tier. The #914 review spent
  ~451k on a **markdown-only** diff and helped exhaust a daily allowance. If a round would exceed
  ~500k, cut the weakest lens rather than running it and apologising afterwards.
- **State the choice and the reason** whenever you escalate to Opus.

The `Agent` tool has **no effort parameter** — sub-agents inherit the session's effort. Model and
slice size are the only levers you control; don't pass an effort field.

Give each Avenger an explicit file-ownership boundary when several run at once, and forbid all
of them from mutating git state — **JARVIS commits**, never the sub-agents.

## Input

One or more issue numbers as arguments (e.g. `/ticket 483`, or `/ticket 832 837`).

**Multiple issues share one branch and one PR.** Before accepting a pairing, confirm it is real:
the issues collide on the same files, share a contract, or together tell one story. If they do
not, say so and deliver the first; do not bundle unrelated work to save a CI run. **State the
pairing rationale in the PR body** so a reviewer knows why one PR closes two issues.

## Step 0 — Detect the repo's conventions (do this first, once)

This skill is **repo-agnostic**: read the environment instead of assuming.

- **Repo:** `gh repo view --json nameWithOwner -q .nameWithOwner`.
- **Base branch:** prefer `develop` if it exists on origin (`git ls-remote --heads origin develop`);
  otherwise the repo's default branch (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`,
  usually `main`). Everywhere below, "base" means this branch.
- **Release hygiene:** does the repo keep CHANGELOGs / per-package versions? (`find . -iname CHANGELOG.md`,
  look for a monorepo of `package.json`s with versions.) If yes, the Avenger honours them; **if there
  is no such convention, skip version bumps and changelog entries entirely** — don't invent them.
- **Verification bar:** find what the repo actually uses — a test suite (pytest/vitest/jest/go test…)
  and/or `lint`/`build` scripts. **If there is no test framework, don't add one** — verify via the
  repo's documented convention (imports clean + boot/build, e.g. `python -c "from app.main import app"`,
  `pnpm build`, `cargo check`). **Include every gate CI enforces, not just the ones you'd run by
  habit** — a format/lint gate (`format:check`, `prettier --check`, `ruff`, `gofmt -l`, `eslint`)
  fails the pipeline even when typecheck/build are green, so fold it into the bar you hand the Avenger
  and re-check before opening the PR. Grep the CI workflow for the exact gate list.
- **ADRs:** if the repo keeps `docs/adr/`, a change that establishes or amends a rule others must
  follow needs an ADR (and an amendment when the issue's acceptance criteria name an existing one).
  If there is no ADR convention, skip entirely.
- **Labels & project board:** apply labels that already exist in the repo; add the PR to a project
  board only if the repo uses one. Skip silently otherwise.
- **Review tooling — check what is actually invocable *before* step 6.** Three names matter:
  - **`code-review`** — the first-party correctness reviewer. Where it appears in the skill list it
    is invocable by you via the `Skill` tool at effort levels low–max; only its `ultra` mode is
    user-triggered and billed, so never pass `ultra`. In harnesses where it is not listed, you
    cover correctness with your own fan-out instead (step 6).
  - **`mattpocock-skills:code-review`** — the installed Matt Pocock two-axis library (Standards +
    Spec), invoked with the `Skill` tool. **`review`** is the same skill vendored repo-locally
    (`.claude/skills/review/`); use it if the plugin isn't listed.
- **Second review lens:** the `uncle-bob` agent (global `~/.claude/agents/uncle-bob.md`, or a repo-local
  one). If it isn't available in this session, fold a Clean-Code/SOLID finder into the pass-1
  correctness coverage instead, and say so.

## The loop

1. **Triage (JARVIS).** `gh issue view <n>` for each, and read the code it points at. Confirm scope,
   dependencies, and acceptance criteria, and surface any *hidden* work (e.g. an endpoint that
   needs a new payload). Check whether a linked issue has already been partly delivered — issue
   bodies go stale, and a claim written weeks ago may no longer hold against the base branch. If
   the ticket is ambiguous or hides a product/design decision, resolve it from the code or **ask
   the user before delegating** — don't let an Avenger guess.

2. **Branch in place (JARVIS).** The Bash cwd resets on every call and every review agent reads the
   main checkout, so **do not use worktrees**:
   - If the tree is dirty, `git stash push -u -m jarvis-wip` to park the user's WIP (skip if clean).
     Run stash operations as **standalone commands**, never chained behind a `cd` in one compound
     command: a failed `cd` still runs the stash op and has twice polluted the tree.
   - `git fetch origin <base> && git switch -c <type>/<slug> origin/<base>`.

3. **Delegate the build (Avenger).**

   **First, check the ticket is build-shaped at all.** Some are **investigation-shaped** — an audit,
   a "how big is this problem", a "decide whether X is happening". There the deliverable is an
   _answer_, usually a findings doc, and any code is a detector that exists to make the answer
   reproducible. Handle these differently:

   - **JARVIS does the analysis inline, not through an Avenger.** The reasoning is the deliverable
     and it is exactly the part that must not be delegated. Delegate the _tooling_ once you know
     what you are looking for. An Avenger asked to "audit for damage" invents plausible signals
     instead of calibrating them against the data.
   - **Calibrate every proposed signal before building it.** The ticket's suggested signatures are
     hypotheses, not requirements. Say plainly in the PR which you rejected and on what evidence.
   - **A negative result is a result.** "Nothing found, and here is why the method could and could
     not have found it" is a complete answer. Don't pad it into a feature.
   - **Commit the queries, not just the conclusions**, so the numbers are re-derivable.

   For build-shaped tickets: spawn a general-purpose sub-agent — model per **"Choosing the model"**
   above, stating the choice and the reason in your triage output — with a **self-contained** prompt:
   the branch is already checked out (don't switch/stash);
   exact files + acceptance criteria; tests appropriate to the repo (happy path + 1–2 edges) **only
   if it has a test setup**; **release hygiene per Step 0** (honour CHANGELOG/version conventions if
   the repo has them — **never** bump a root version; otherwise skip them); the repo's lint/tests/build
   must pass. **Forbid every git command that mutates state** (`add`/`commit`/`stash`/`switch`/`reset`/
   `restore`) — concurrent Avengers sharing one checkout will corrupt each other's work, and JARVIS
   owns the commit. Everything a build or review agent needs is available from
   `git diff origin/<base>...HEAD` and ordinary reads; comparing against the base does not require
   switching to it. Give it an Avenger codename.

   **JARVIS then commits and pushes** — stage by explicit path (a repo often carries unrelated
   untracked files you must not sweep in), write the Conventional-Commit message with the
   `Co-Authored-By: Claude ...` trailer, and `push -u origin <branch>`.

4. **Verify (JARVIS).** Inspect the diff; confirm the repo's verification bar is green (tests + lint,
   or imports-clean + build where there's no suite). Where the repo keeps release hygiene (Step 0),
   **confirm the version bumps and changelog entries are actually present**: a miss here surfaces
   at the release gate. Fix-forward only — via another Avenger if the fix isn't trivial.

5. **Open the PR as a draft (JARVIS).** `gh pr create --draft --base <base>` — typed title
   (`fix(...)` / `feat(...)`), body links every issue it closes (`Closes #<n>`), succinct summary +
   test/verification notes, and the pairing rationale if it closes more than one. Apply existing
   labels; add to a project board only if the repo uses one, then **verify they landed**
   (`gh pr view <n> --json isDraft,projectItems,labels`): `gh pr edit --add-project` and
   `--add-label` can fail silently, and one bad label name aborts the whole call.

   Draft first because the review loop pushes more than once. Where the repo's CI skips draft PRs (a
   `ready_for_review` trigger plus a `!github.event.pull_request.draft` guard on each top-level job,
   as SCRD's `ci.yml` has since #1162), the build and every review-fix push bill no Actions minutes.
   Where it does not, a draft costs nothing, and the guard is worth suggesting to the user.

6. **Review pass 1 — two-axis review + a correctness axis + the claim audit.**

   **Two-axis (Standards + Spec):** invoke the **`Skill` tool** with
   `skill: "mattpocock-skills:code-review"` (or `"review"` — see Step 0). Hand it the fixed point
   and the spec **explicitly** so it never stops to ask, and so it doesn't need the
   `docs/agents/issue-tracker.md` most repos lack: fixed point `origin/<base>`, spec = the issue you
   triaged in step 1. That skill covers **Standards and Spec only — it has no correctness axis, and
   it posts nothing.**

   **Correctness axis:** where the first-party **`code-review`** skill is listed (Step 0), invoke it
   via the `Skill` tool as the correctness axis — args are the PR number (or branch) plus an effort
   level: `medium` for an ordinary diff, `high` for a large or cross-package one. Never pass
   `--comment` (JARVIS aggregates into one PR comment) and never `ultra` (user-triggered, billed).
   Where it is **not** listed, cover correctness with your own fan-out of `general-purpose` finder
   agents, read-only and adversarial — "find what will actually break; verify every claim against
   the repo or the CI logs rather than asserting from memory; and list separately what you checked
   and cleared" — with non-overlapping lenses (e.g. runtime/semantics, data & migrations,
   spec-vs-repo-conventions) rather than copies of one brief. **"Finder" below means one such
   fan-out agent.**

   **The claim audit always runs** — one finder pointed at *you*, not the diff. Point it at your
   own PR body, commit message and draft review comments: does every claim hold against the repo?
   Counts, version numbers, "X is the only Y", precedent citations, gate results. Neither review
   skill covers this lens, and it repeatedly catches what diff review cannot — a false statement
   in a PR body is the expensive kind of error, because this loop posts its claims publicly and
   they outlive the session.

   **Model each lens by "Choosing the model" above — per lens, not blanket.** Reasoning lenses
   (hand-rolled runtime correctness, judging a deliberate spec departure, the claim audit) earn
   Opus; lenses that check against a written rule (repo-convention conformance, and the two-axis
   skill's own Standards agent, which matches a fixed smell list) are Sonnet. The two-axis skill
   spawns its own agents — pass the model you want in the arguments you hand it rather than letting
   it default.

   **Size the review to the diff, with the same restraint you apply when sizing a build slice.**
   Running everything spawns the two axes, the correctness skill's own reviewers, the claim audit
   and Agent Bob, which most diffs do not earn.

   **Measure the review surface, not the raw diff.** `--shortstat` counts deletions, and deleting a
   file costs one grep to confirm nothing references it, not N lines of reading. A docs PR that
   removed a vendored 79k-line file measured 81,598 changed lines and would have taken the "large,
   cross-package" bullet for a diff whose real surface was four files:

   ```bash
   git diff --numstat origin/develop...HEAD | awk '$1!="-"{a+=$1} END{print a+0}'  # surface
   git diff --diff-filter=D --name-only origin/develop...HEAD | wc -l              # files deleted
   ```

   Take the **first** bullet that matches.

   - **Prose only** — docs, comments, ADRs or agent-instruction files, no source change, at any
     size. Run the **claim audit** and nothing else, inline unless the claims are many, in which
     case one bounded finder. Add the **Spec axis** only where the prose is a spec others will
     follow and the ticket carries acceptance criteria. **Say in the PR comment what you skipped
     and why.** Bound any finder to a named list of claims and files: unbounded finders
     re-verifying every claim against live sources cost ~369k tokens on 14 lines of markdown
     (#819) and ~451k on a markdown-only diff (#914).
   - **Small code diff** — under ~150 lines of surface. Claim audit + `code-review` at `medium`
     (or 2 bounded finders where it isn't listed). Skip the two-axis skill and Agent Bob, and say so.
   - **Ordinary code diff** — roughly 150 to 600 lines of surface. The full shape: two-axis skill +
     `code-review` at `medium` (or 2 finders) + claim audit + Agent Bob. Config, schema and
     migration diffs are code for this purpose, never prose: `*.sql`, `*.yml` workflows and build
     config carry real breakage risk however small they look.
   - **Large or cross-package** — over ~600 lines of surface, or three or more packages touched.
     `code-review` at `high` (or 3 finders) plus 1-2 extra finders with distinct lenses, plus Agent
     Bob: a large diff is usually a refactor or a new contract, where the design lens matters most.
     The `Workflow` tool is the better instrument for loop-until-dry coverage, but it **requires
     explicit user opt-in per invocation**, so you cannot escalate silently: propose it, say
     roughly what it will cost, and wait for a yes. Without one, stay on the Agent fan-out and say
     in the PR comment that you did.

   **Declare the budget before you spawn, not after.** State in your own output the tier, the
   measured surface, the agent count and a rough token estimate. If the estimate clears ~500k, cut
   the weakest lens **before** spawning it. Every over-spend on record was disclosed only in the
   post-mortem.

   Sizing down is a deliberate, disclosed skip, not the "couldn't run it" case the guardrails
   cover: if a skill is *unavailable*, you still owe its axes inside the fan-out.

   **JARVIS aggregates and posts** — one `gh pr comment <n> --body-file` for the pass, led by a
   plain-language TL;DR. The skills and the agents all report *to you*; nothing reaches the PR
   unless you put it there.

7. **Review pass 2 — Agent Bob.** Run the `uncle-bob` agent over `origin/<base>...HEAD` and post
   its findings to the PR (`gh pr comment <n> --body-file`). If uncle-bob isn't available, cover the
   Clean-Code lens inside the pass-1 coverage instead and note the substitution.

8. **Orchestrate the outcome (JARVIS).** For each finding: **obvious + valid → delegate the fix to
   an Avenger automatically**; **ambiguous / directional / a product call → ask the user.** Repeat
   6–8 until the reviews are clean. **Batch fixes into one push per review round**, not one push
   per finding: in a repo whose CI still runs on drafts, every push starts a metered run.

   **Then mark the PR ready: `gh pr ready <n>`.** In a repo whose CI skips drafts, that is the
   ticket's one CI run, on the code that will merge. Read it with the ccd_pr tools (or
   `gh pr checks`) and fix forward if it fails. If the human's review asks for another round of
   changes, `gh pr ready --undo <n>` first, so that round's pushes are free too.

9. **File follow-ups — search first.** Filing is the last resort, not the default: a ticket loop
   that emits more issues than it closes makes the backlog grow with the work. Before filing any
   finding, search the open issues (`gh issue list --state open --search "<keywords>"`) and prefer
   **commenting on the owning issue**; prefer **folding a small finding into the current PR** over
   filing anything at all. If you do file, use the repo's existing labels, milestones and board per
   Step 0, cross-reference the PR that surfaced it, and say in the PR why it could not be absorbed.
   A finding that isn't code (alerting, infra, anything no PR can close) must be a ticket; narrow
   it to exactly that part so it reads as a task for a human.

10. **Hand back.** Report the PR link, review status and the ready run's CI result; **the user
    merges.** Then restore their WIP
    if you stashed it in step 2 — **pop by named ref, never by position**:

    ```bash
    git switch <original-branch>
    ref=$(git stash list | grep -m1 jarvis-wip | cut -d: -f1)
    git stash pop "$ref"
    ```

    A bare `git stash pop` trusts `stash@{0}`, which is not a stable handle on a shared stash
    stack. If the ref is gone, the WIP was likely already restored: check `git status` before
    assuming it is lost, and **drop** rather than pop if the tree already matches.

## Guardrails

- **This file is the only copy of the skill.** It lives in the repo's `.claude/skills/ticket/`.
  Never create a personal `~/.claude/skills/ticket/`: personal skills take precedence over project
  skills, so it would shadow this one in every repo, and the two copies drift.
- **Never** commit to the base branch (`develop`/`main`) — always a feature branch + PR.
- Release hygiene, **where the repo has it**, lands in the **same** PR, not a follow-up.
- Post **real** review findings to the PR — never review "in your head". Neither the review skills
  nor the agents post anything themselves; if you didn't run `gh pr comment`, the review didn't happen.
- **Never claim a review pass you couldn't run.** If a review skill isn't listed under any of the
  Step 0 names, say so plainly, cover its axes inside your own fan-out, and name the substitution
  in the PR comment.
- Sub-agents never mutate git state (see step 3).
- Stash operations are standalone commands, popped by named ref (steps 2 and 10).
- **Match the repo you're in** — don't impose one project's monorepo/changelog/board habits on a
  repo that doesn't use them, and don't skip a convention a repo does rely on.

If the repo keeps workflow notes in memory or docs (orchestration / branch / PR conventions),
consult them before delegating.
