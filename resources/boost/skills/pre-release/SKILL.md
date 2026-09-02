---
name: pre-release
description: "Pre-push / pre-release checklist. Runs Rector, Pint, full test suite, PHPStan, and audits README, the docs site (docs/ pages, index sync, local build), and `.ai/` docs for staleness. Activate before: pushing to remote, tagging a release, writing release notes, or when user mentions: pre-release, pre-push, release checklist, ship, cut release, release notes."
metadata:
  boost-tags: "php github release-automation"
  boost-requires: "readme release-notes upgrading"
---

# Pre-Release Checklist

Run this full gauntlet before pushing commits that may be tagged as a release or before drafting release notes. It catches regressions the two-tier `backend-quality` skill skips — Rector drift and stale docs shipped to downstream projects.

## When to Use This Skill

Activate when:
- About to push commits that will land in a release
- About to write or update release notes
- User says "ship it", "cut a release", "pre-push", "release checklist"
- A feature/fix is fully implemented and quality-gated

Do NOT use mid-development — this is a completion-level skill.

**The user cuts the tag, not you.** Tagging is irreversible-ish and a release-visibility decision the user owns. Do NOT execute `git tag` / `gh release create` / `git push --tags` yourself. The skill's job ends only once step 8b (post-tag watch) has confirmed the tag-ref and release-event workflows are green — "tag cut" is not the finish line.

**However, the agent MUST present the explicit `gh release create` command shape in the handoff — not prose target-naming.** Prose like "target is X" leaves room for default-resolution-path traps: `gh release create <TAG>` without `--target` defaults to whichever branch the user is on, which doesn't always match the verified-sha branch. That's documented `gh` behavior, not a bug — and it has shipped broken releases when the tag-cut workflow spans multiple branches (rc-prep + main, feature + main, etc.). See "Canonical handoff command shape" below for the required format. The discipline is removing the default-resolution path, not asking the user to be careful with prose.

## Workflow

Run the checks **in this order**. Each must pass before moving to the next. Fix issues as they surface; do not batch.

Always append `|| true` to verification commands so output is captured even on failure (per repo `CLAUDE.md` rule). Pass/fail is determined from the captured output, not the exit status alone.

**The order is 1 → 2 → 3 → 4 → 5 → commit → push → 6 → 7 (draft notes) → user cuts tag → 8a (pre-tag gate, just before `gh release create`) → 8b (post-tag watch).** Do not jump from step 5 straight to drafting release notes. The release-notes file is written only after the changes have been committed, pushed, and CI is green on that exact SHA (step 6). Writing notes earlier claims facts ("tests pass on CI matrix", "2,092 tests / 2,941 assertions") that are not yet proven. If you find yourself about to `Write` a file under `internal/release-notes-<version>.md` and the last thing you did was a local quality check, stop — you skipped commit/push/CI. And if the tag is cut without step 8a's live-remote + CI re-check, or without waiting on step 8b's tag-ref runs, the release ships on unverified facts even if steps 1-7 all passed.

**Two landing flows — know which you're in BEFORE step 6.** The order above is the **direct-to-release-branch flow**: you push the release commit straight to the release branch (usually `main`), and that branch's HEAD is the release commit. If instead the work lands via a **pull request** — it sits on a feature branch with an open PR — the release commit is the **merge commit on the release branch**, NOT the feature-branch tip. In a PR flow, three things shift and skipping any of them has shipped a broken release:

- **A green feature-branch / open-PR CI is NOT the release gate.** The tag is cut from the release branch, so the SHA that must be green, pinned, and tagged is the release branch's HEAD *after the PR merges*. Step 6's "CI green on the pushed commit" means the **merge commit on the release branch**, re-run after merge — not the branch CI from before.
- **Do NOT draft release notes (step 7) or hand off a tag (8a) while the PR is still open.** The PR-flow order is: branch CI green → **merge PR → re-run step 6 on the release branch's merge commit** → 7 (notes pinned to that merge SHA) → 8a → tag → 8b.
- **Tagging before the merge points the tag at the release branch's pre-merge HEAD**, which contains none of the PR's work — a green-but-empty release. This has actually shipped: a `1.2.0` tag cut while its PR was still open pointed at pre-feature `main` and carried zero of the feature; the empty version still resolved on Packagist, so a dependent package pinning `^1.2` would have installed an engine that wasn't there. Recovery was delete-tag + re-tag at the real merge commit. Step 8a check D (content presence) below is the backstop, but the primary rule is: **merge first, then notes, then tag.**

**The concrete commands in steps 6–8 use `main` as the release branch** — the common case. If your release branch is not `main` (a `release/*` line, a maintenance branch, an rc-prep branch), the release branch is wherever the tag will be cut from: substitute it in every `origin/main` / `refs/heads/main` reference below, and pin/verify against *that* branch's post-merge tip. The flow is identical; only the branch name changes.

### 1. Rector

```bash
vendor/bin/rector process || true
```

Must report **0 files changed**. If Rector modifies files, review the diff, commit the changes, and re-run until clean.

### 2. Pint

```bash
vendor/bin/pint --dirty --format agent || true
```

Must be clean. Re-run after Rector — Rector fixes can introduce style drift.

### 3. Full Test Suite

```bash
vendor/bin/pest || true
```

Must show 0 failures.

**Local green ≠ CI green for this step.** Pest runs parallel on one OS/PHP combination locally. The CI matrix includes Windows + `prefer-lowest` legs where `pest --parallel` has historically raced non-atomic filesystem ops (e.g. a `rename()`), producing failures invisible on macOS. Do not let a local pass relax step 6 rigor — step 6 is the authoritative test gate across the matrix. A release has shipped broken exactly this way: local green, a Windows `prefer-lowest` CI leg red, tagged anyway because step 6 was skipped.

### 4. PHPStan

```bash
vendor/bin/phpstan analyse --memory-limit=2G || true
```

Must show 0 errors. Fix real issues — do not pad the baseline. See `backend-quality` skill for baseline rules.

### 5. Documentation freshness audit

Release-worthy features change user-visible behavior, so `README.md`, a `docs/` documentation site when the repo has one, and the `.ai/` files we ship to downstream projects (via boost-core's `vendor/bin/boost sync`) can drift silently. Every release must audit all of them.

**Rule:** add or edit docs only where they reflect a real change. Do not bloat the README or skills. Delete stale content aggressively.

#### 5a. README

Consult the `readme` skill's staleness-audit section — **both halves of it**, and note that they scan different sets:

- **Staleness** runs against `git log <last-tag>..HEAD`: what changed since the last release is what can have gone stale.
- **Verbosity** runs against the **current README and every current docs page**, whatever the diff touched. A page that went over budget three releases ago never appears in a diff range again, so a history-scoped audit would pass it forever. This is a whole-corpus measurement — word counts and prose-run lengths — not a review of the change.

Docs rot by growing as well as by aging: every release adds a paragraph and nothing removes one. The `readme` skill owns the canonical authoring checklist (required sections, voice, anti-patterns, staleness-audit pattern); pre-release just orchestrates the timing — README freshness is audited at every release, not quarterly.

Pre-release-specific audit targets layered on top of `readme`'s generic pattern:

- **Rules-shipped sections** — if a rector gained / lost behavior, options, or limitations.
- **"Known limitations"** — every newly covered shape removes a row; keep it honest.
- **Public API / config keys** — if a constant was added, renamed, or its accepted values changed.

If unsure whether a change warrants a README update: check whether a user reading the README after the release would see outdated advice. If yes, update.

**Docs-site repos** (a `docs/` directory that is a static-site generator's source — detection rules live in the `readme` skill's "Detecting the docs-site shape" section): the same freshness audit covers the docs pages. Against `git log <last-tag>..HEAD`:

- Every release-worthy behavior change has its docs page(s) updated.
- Run the `readme` skill's index-sync check with its per-surface rules: docs index and sidebar cover every page, the root README follows its declared policy (all pages or section entry points), a top nav bar is checked for dead entries only.
- Run the `readme` skill's link audit: README → docs links are absolute site URLs and validate against the routes the generator produces, not against the filesystem; repo-relative pointers and asset references resolve on disk; site-internal links follow the generator's routing. Step 5c builds `docs/` only — it never checks README links, because the README sits outside `docs/`. So 5a owns the README link check in both the build and the documented-skip path.

This skill normally ships alongside `readme` — pre-release declares it in `boost-requires`, and boost-core *rescues* a required skill into the sync even when tag filtering would drop it. The inline targets above exist for sync pipelines that don't honor `boost-requires` (for example laravel/boost standalone): there, treat this section as the audit and apply the `readme` skill's rules from its upstream source.

#### 5b. boost-core skills + guidelines

The `.ai/skills/` and `.ai/guidelines/` directories are synced by boost-core (Composer plugin, `vendor/bin/boost sync`) to `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and per-agent `<.agent>/skills/` directories. Sources ship with the package (in `resources/boost/skills/` for package-author packages); generated files are auto-gitignored on consumer sides.

Check each edited-or-eligible doc:

- **Accuracy** — every command, path, rule name, and API example must still work against current `main`.
- **Scope** — skills describe *when* to activate and *what steps* to run. Guidelines describe *conventions that persist*. Don't mix.
- **Non-bloat** — prefer tables and bullets over prose. One skill = one clear workflow. Add a new skill rather than overloading an existing one. Delete steps that are no longer load-bearing.
- **Trigger words in frontmatter `description`** — if a new workflow exists, make sure someone typing the natural-language ask can discover the skill.

If any `.ai/` file changed, force a sync to verify locally:

```bash
vendor/bin/boost sync || true
git status --short .ai/
```

Only the `.ai/` sources need committing. Generated files (`CLAUDE.md`, `.claude/skills/`, etc.) propagate to consumers on their next `composer install/update` via boost-core's plugin.

#### 5c. Docs build gate (docs-site repos only)

**Policy: the build *attempt* is mandatory whenever a build command is derivable AND the toolchain is available locally; a documented skip is allowed when either is missing; the manual link audit (5a) is the required fallback when no build runs.**

Derive the command — never hardcode one:

1. **Mirror the repo's docs deploy workflow** when one exists: same working directory, install command, and build command.
2. Otherwise, only when `docs/package.json` declares a `build` script: pick the package manager from the lockfile in `docs/` (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock` or legacy `bun.lockb` → bun). Several lockfiles → ask, don't guess. A root-level workspace with no `docs/` lockfile falls under option 1 — do not invent a command.
3. Neither source yields a command, or the toolchain is missing locally → **skip with an explicit note** in your report; the 5a link audit is then the only pre-push check for the link forms it covers.

Example (npm layout, `|| true` capture per the repo convention):

```bash
npm ci --prefix docs || true
npm run --prefix docs build || true
```

The build must succeed. When the generator fails the build on dead links (VitePress does by default), this catches broken cross-links before push instead of at deploy time.

### 6. CI green-light gate (after push, before release notes + tag)

Local green ≠ CI green. The matrix job runs in a clean CI environment that usually differs from the dev machine — missing env vars, no cached state, different runtime/dependency combinations. Local passes frequently, CI fails. A green tag on a red CI is a broken release: a release has shipped where the whole suite failed in CI on an environment-shape problem while every test passed locally.

**Scope is per-commit, not per-run.** This repo has multiple workflows with different triggers — `gh run watch` follows a single run and will silently skip other workflows that also have opinions about the same SHA. Enumerate by commit SHA and wait for every matching run:

```bash
git push
SHA=$(git rev-parse HEAD)

# Settle — GitHub takes several seconds to register runs against the new SHA.
# Querying too early returns an empty list; `running=0` would falsely signal green.
sleep 20

# List every workflow run tied to this SHA, across all workflows/triggers
gh run list --commit "$SHA" --json databaseId,name,event,status,conclusion

# Wait for every run to reach a terminal state, then assert all success.
# `total > 0` guard prevents the empty-list → zero-running false green.
while true; do
    total=$(gh run list --commit "$SHA" --json databaseId -q 'length')
    running=$(gh run list --commit "$SHA" --json status -q '[.[] | select(.status != "completed")] | length')
    [ "$total" -gt 0 ] && [ "$running" -eq 0 ] && break
    sleep 15
done

failed=$(gh run list --commit "$SHA" --json conclusion,name -q '[.[] | select(.conclusion != "success" and .conclusion != "skipped")] | length')
[ "$failed" -eq 0 ] || { echo "CI red on $SHA"; gh run list --commit "$SHA"; exit 1; }
```

Pass criteria: every run for this commit has `conclusion` in `{success, skipped}`. A `skipped` conclusion is fine — a run reports it when its jobs were skipped by their job-level `if:` conditions. A `paths` filter that doesn't match behaves differently: the workflow produces **no run at all** for that push (nothing for `gh run list` to enumerate), which is equally fine — a push whose change set is docs-only is expected to leave `**.php`-filtered workflows absent.

**Docs-site repos need no extra step-6 check.** By the same rule, a `paths: ['docs/**']` docs workflow creates no run when the pushed change set doesn't touch `docs/**` — correct, since that push needs no docs gate. When it does touch `docs/**`, a triggered docs run appears in the per-SHA enumeration and the loop above gates it like any other run. But this loop cannot prove the docs workflow ran — a disabled or misconfigured workflow also creates no run, and `total > 0` is satisfied by any other workflow. That's why step 5c's local build attempt is the mandatory docs check under 5c's policy (documented skip only when no command is derivable or the toolchain is missing); the CI docs run is additional coverage when it exists.

**Don't rely on a "latest run" heuristic.** `gh run list --branch main --limit 1` may pick a run from a completely different push — the commit-SHA filter is the only reliable anchor.

On failure:

1. Pull the failure log via `gh run view <id> --log-failed` (or via API if `--log-failed` is empty: `gh api /repos/<owner>/<repo>/actions/jobs/<job-id>/logs`).
2. Reproduce locally — often requires the same env shape as CI (missing env vars, clean composer.lock install, a specific runtime/dependency combination the CI matrix covers).
3. Fix with a new commit on the same branch.
4. Push and re-run step 6 against the new HEAD.

**Do NOT write release notes until CI is green.** Release notes claim "tests pass on X/Y/Z"; CI is the evidence. Skipping this step reduces downstream trust. (The user handles tag creation — once release notes are drafted against a green CI, the skill's job is done.)

**Workflows triggered by `release` (e.g. `update-changelog`)** run AFTER tag creation, not before. They're outside this gate by design — their job is to decorate the release after it ships, not to gate whether it ships.

**`on: push` workflows re-fire on the tag-ref push.** Creating a release pushes a tag ref; any workflow that triggers on `push` (including `run-tests`) runs again against that tag ref. Those runs are *not* part of this pre-tag gate — they happen after tag creation. They can surface environment-shape failures (Windows fs races, prefer-lowest combos) that the main-branch run narrowly missed. Step 8 (post-tag watch) handles them.

### 7. Release notes (ONLY after step 6 CI-green)

This is where agents most commonly slip: running the local gauntlet (steps 1-5), then jumping straight to `Write internal/release-notes-<version>.md` without committing, pushing, or watching CI. **Do not do that.** Notes claim CI-matrix facts; CI must have produced those facts first.

**Structure / voice / breaking-change callouts / what-to-omit rules come from the `release-notes` skill.** That skill owns the canonical body shape (Breaking / Added / Changed / Fixed / Internal sections — bullets only, no intro prose, no `###` headings — past-tense voice, PR-linking conventions, and migration code blocks for breaking changes). Pre-release's role here is timing + scrubbing — *when* notes get drafted (only after step-6 CI green) and *what internal noise to scrub before saving*. The `release-notes` skill ships alongside this one via `boost-requires`; on a sync pipeline that doesn't honor `boost-requires`, follow the inline guidance below.

**For breaking changes in particular**: the `upgrading` skill carries the canonical UPGRADING.md structure. If this release is breaking (MAJOR or pre-1.0 minor with breaking change), run `upgrading` to append the migration entry — release notes and UPGRADING.md cross-reference each other.

**Release notes are public artefacts — do NOT leak internal process noise.** The release body is rendered on GitHub, prepended to `CHANGELOG.md` by CI, and indexed by Packagist. Anything written here is visible to every downstream consumer and shows up in search. Internal session/tooling identifiers, CI-internal chatter, and process choreography are *process* concerns, not product concerns — consumers don't know or care about them, and leaking them exposes internal architecture.

**What not to write:**

- Internal session/tooling identifiers — anything that names how the work was produced rather than what changed.
- CI-internal chatter and process choreography — run IDs, internal channel names, step-by-step workflow framing.

**What to write instead:**

- Nothing, when the alternative is process framing. A change that came from dogfooding is written as the change, never as its origin story: "sourced from production dogfood" is process noise scrubbed to a public-safe phrase, and the `release-notes` skill drops it too.
- Named public contributors only: GitHub usernames / real-name contributors who filed issues, PRs, or are otherwise publicly part of the conversation. If you have an external user or named downstream app that consented to being credited, name them. Otherwise, stay generic.
- Only what a consumer sees. Reasoning, root cause, and mechanism belong in the PR, not the notes — see the `release-notes` skill, which owns that rule.

**Scope of the rule:** applies to every file written under `internal/release-notes-<version>.md`, since that body text flows directly to the public GitHub release + CHANGELOG. Internal planning files (`internal/roadmap.md`, `internal/specs/*.md`) CAN reference internal identifiers — those stay out of the package's git history (`internal/` is gitignored).

**Quick scrub before `Write`ing the notes file.** Grep your draft for internal identifiers and process noise that must not reach a public release:

- Short alphanumeric handles that look like internal session, instance, or run IDs — e.g. any bare `[a-z0-9]{8}`-style code.
- Internal tool, agent, or channel names, and CI run IDs.
- Step-by-step workflow framing ("pass 1 found…", "via the X run").

Rewrite or delete every match before saving — only product-facing facts belong in the notes.

**Preflight — run these three commands and confirm all three before you create the release-notes file.** If any fail, you are not ready to draft notes; go back to whichever earlier step is incomplete.

```bash
# 1. Working tree must be clean — the commit landed, nothing is uncommitted
git status --short || true

# 2. HEAD must be pushed — local SHA == origin/main SHA
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && echo "pushed" || echo "NOT pushed"

# 3. Every CI run for this SHA must be terminal + {success, skipped} — same query as step 6
SHA=$(git rev-parse HEAD)
gh run list --commit "$SHA" --json name,status,conclusion
```

Only when (1) status is empty, (2) echoes `pushed`, and (3) every run is `completed` + `{success, skipped}` may you `Write` to `internal/release-notes-<version>.md`.

Draft into `internal/release-notes-<version>.md`. The user reads the draft, creates the tag, and publishes the release themselves — do not cut the tag, do not run `gh release create`, do not push tags. Once the release-notes file exists and CI is green, report "ready to tag" with the **canonical handoff command shape** (see "Canonical handoff command shape" below) and stop.

**Pin the verified SHA in the notes file.** The very first line of the notes file must be an HTML comment recording the green SHA. GitHub strips HTML comments when rendering the release body, so this is invisible to readers but greppable by step 8:

```markdown
<!-- verified-sha: 4387b6845b45def9c6ad80e638990f81b74bfb19 -->

## Fixed

- ...
```

The body starts at the first `## ` section. No version heading — the `release-notes` skill owns the body shape.

The SHA in that line is the exact `git rev-parse HEAD` that step 6 proved green. Step 8's pre-tag gate fails closed if the SHA in the notes file does not match the current HEAD (i.e. someone landed more commits between notes draft and tag).

**The verified-sha MUST be a literal 40-hex commit you just proved green — never a placeholder** (`<sha>`, `TODO`, `REPIN-…`, `xxxx`), and never a SHA recycled from a prior release's notes. A placeholder or stale SHA is not a "draft in progress" — it is a tag aimed at the wrong commit waiting to happen. If you cannot fill in a real green SHA, you are not at step 7 yet.

**If a notes file already exists for this version before CI is green, DELETE it — never edit it in place.** A recycled or carried-over `internal/release-notes-<version>.md` (e.g. copied from the previous version, or a draft with a placeholder SHA) counts as **no notes yet**, not a head start. Editing its body "to fix the content" while CI is not yet green is the exact step-7 violation that has shipped a broken release — the file looks ready, the handoff overstates readiness, and the placeholder SHA silently defeats the 8a gate. Delete first; redraft only once the green-merge-SHA preflight below passes. Treat "a notes file exists" and "the notes step is done" as independent: the step is done only when the file pins the real green SHA produced by step 6 on the actual release commit.

**CI handles `CHANGELOG.md` automatically — do not edit it manually.** `.github/workflows/update-changelog.yml` prepends the release body on release publish. See the `release-automation` guideline for details.

#### Canonical handoff command shape

When reporting "ready to tag" to the user, **always include the explicit `gh release create` command** the user should run, not prose target-naming. Prose like "target is X" leaves room for default-resolution-path traps: `gh release create <TAG>` without `--target` defaults to whichever branch the user happens to be on, which doesn't always match the verified-sha branch.

The required handoff format:

```bash
gh release create <TAG> \
    --target <BRANCH> \
    --title "v<VERSION>" \
    -F internal/release-notes-<VERSION>.md
```

Where:

- `<TAG>` is the bare version (`1.8.1`, not `v1.8.1`) — Composer and Packagist read the tag.
- `--target <BRANCH>` is **always explicit**, even when it's `main`. The flag removes the default-resolution path. The branch named here MUST match the branch that contains the verified-sha commit in the notes file.
- `--title "v<VERSION>"` uses the `v`-prefixed cosmetic title (`v1.8.1`).
- `-F` reads the release body from the verified-sha-pinned notes file.

A release has shipped broken specifically because the handoff used prose target-naming: agent said "target is the prep branch" in plain text; user ran `gh release create <TAG>` without `--target` and `gh` defaulted to `main`; the resulting tag pointed at content that did not match the notes' verified-sha. Recovery cost was a follow-up patch release explaining the mis-tag. The discipline this format encodes is: **remove default-resolution paths by surfacing the explicit-arg-shape, instead of relying on prose accuracy and user attention.**

The same discipline generalizes to any agent→user handoff involving CLI commands with default-resolution: `git push` (default remote), `composer require` with version constraint (default stability resolution), `npm` / `yarn` / `pnpm` (default registry), and so on. The principle: any command with a default that could resolve differently in agent context vs user context must be shown with the relevant flag explicit.

### 8. Pre-tag gate + post-tag watch (the step a broken release lacked)

Step 7 proves CI green at draft time. Step 8 proves CI is *still* green at tag time, and catches failures that only show up on the tag-ref push.

**8a. Pre-tag gate — runs TWICE: the agent runs it before presenting the handoff, and the user re-runs it seconds before cutting the tag.** It re-verifies four things: HEAD hasn't drifted since notes draft, the notes file pins this exact SHA, CI is still all green, and the target SHA actually contains this release's work.

**The agent MUST run this gate itself before presenting the `gh release create` handoff, and MUST refuse to present that command if any check fails.** The handoff message is a readiness claim; do not make it on an unverified state. The user still owns cutting the tag, but the agent does not get to hand over a tag command until its own checks pass — that removes the "user skipped the gate" failure mode (a release has shipped exactly because the gate was a user-run step that was skipped: the tag was cut while the PR was still open, against pre-feature `main`, and nothing caught it). The user then re-runs the same one-liner immediately before tagging to catch any drift in the interval.

```bash
SHA=$(git rev-parse HEAD)
VERSION="<version>"  # e.g. 1.2.3
RELEASE_BRANCH="main"  # the branch the tag is cut from — change for release/* etc.
NOTES="internal/release-notes-${VERSION}.md"

# A. Notes file exists and pins this SHA (anchored regex — tolerant of surrounding blank lines,
#    strict about the line itself so a rewrite of the SHA breaks the gate)
grep -qE "^<!-- verified-sha: $SHA -->$" "$NOTES" || { echo "NOTES SHA DRIFT — HEAD=$SHA, notes say $(grep verified-sha "$NOTES")"; exit 1; }

# B. HEAD matches the LIVE remote tip of main — not the cached tracking ref.
#    `git rev-parse origin/main` is stale until an explicit fetch and would
#    let a concurrent push slip through. `ls-remote` always hits the remote.
LIVE_TIP=$(git ls-remote origin "refs/heads/$RELEASE_BRANCH" | awk '{print $1}')
[ "$SHA" = "$LIVE_TIP" ] || { echo "HEAD DRIFT — HEAD=$SHA live origin/$RELEASE_BRANCH=$LIVE_TIP"; exit 1; }

# C. Every CI run for this SHA still terminal + {success, skipped}
failed=$(gh run list --commit "$SHA" --json conclusion -q '[.[] | select(.conclusion != "success" and .conclusion != "skipped")] | length')
running=$(gh run list --commit "$SHA" --json status -q '[.[] | select(.status != "completed")] | length')
[ "$running" -eq 0 ] && [ "$failed" -eq 0 ] || { echo "CI NOT GREEN — running=$running failed=$failed"; gh run list --commit "$SHA"; exit 1; }

# D. RELEASE ACTUALLY LANDED — guard against tagging a commit without the release.
#    "Green" is not "correct": a tag cut before its PR merged is green on a tree
#    with NONE of the release (the empty-but-passing release). The direct,
#    merge-strategy-agnostic catch is the PR's state — a squash, rebase, or merge
#    commit all set the PR to MERGED and advance the release branch, whereas the
#    failure (tag while the PR is open) leaves it OPEN:
PR=<the PR number carrying this release>
gh pr view "$PR" --json state -q .state | grep -qx MERGED \
  || { echo "PR #$PR is not MERGED — do not tag a release before its PR lands"; exit 1; }
#    Direct-to-main flow (no PR): assert there is something to release since the
#    last tag, so you never re-tag an unchanged tree:
#    LAST_TAG=$(git describe --tags --abbrev=0 "$SHA^" 2>/dev/null)
#    [ -n "$(git rev-list "${LAST_TAG}..$SHA")" ] || { echo "nothing new since $LAST_TAG"; exit 1; }

echo "OK to tag $VERSION at $SHA"
```

Check D is the backstop that fails closed even when A–C are individually defeated (a placeholder SHA that happens to align, or a gate run on the wrong branch): if the release's PR is still open, the merged content is not on the branch and the gate refuses the tag. Use the PR MERGED state (or, for a direct push, "commits exist since the last tag") rather than a commit-ancestry or new-symbol check — `--is-ancestor` against the PR head breaks under squash/rebase merges (the head is not an ancestor of the squashed result), and a sentinel grep doesn't generalize to deletion-only/docs-only releases. For an additive release you MAY *additionally* grep a sentinel the release introduces as a second proof, but never as the only check.

The `ls-remote` call is the key difference from the step 7 preflight, which uses the local tracking ref `origin/main`. Step 7 runs right after push when the tracking ref is fresh; step 8a can run minutes or hours later, after the user has context-switched, and the only safe way to prove HEAD is still the tip is to ask the remote directly.

If any check fails, do NOT tag. Fix the drift / failure, re-run steps 6-7 for the new SHA, then retry 8a.

**8b. Post-tag watch.** Creating the release pushes a tag ref, which re-fires `on: push` workflows (including `run-tests`) against that ref. Watch those runs — they are not part of the pre-tag gate and can fail even when 8a passed (Windows fs races, prefer-lowest combos that narrowly missed the main-branch run). Also watch `release`-event decorators (`update-changelog`).

**Do not use `gh run list --branch "$TAG"`.** The `--branch` flag's semantics for tag refs are undocumented — it sometimes works, sometimes returns empty. The reliable selector is the *tag's commit SHA* plus a jq filter on `headBranch == $TAG`. Both `push`-event (tag-ref re-fire) and `release`-event runs attach to that SHA with `headBranch` set to the tag name.

**Run 8b strictly after `gh release create` has completed.** The tag must already exist on the remote; fetch it locally before resolving the SHA.

```bash
TAG="$VERSION"
git fetch --tags origin --quiet
TAG_SHA=$(git rev-list -n 1 "$TAG")  # the commit the tag points at

# All runs attached to the tag SHA, then filter to those whose headBranch is the tag ref.
# This cleanly picks up both the `push`-event tag re-fires and the `release`-event decorators,
# and excludes the main-branch runs that step 6 already gated.
gh run list --commit "$TAG_SHA" \
  --json databaseId,name,event,headBranch,status,conclusion \
  -q "[.[] | select(.headBranch == \"$TAG\")]"

# Wait until every tag-scoped run is terminal, then assert all success.
# `waited` bounds the loop at ~15 min so a hung run doesn't block indefinitely.
# If `total` stays 0 past the first 90s, the tag was likely created without firing
# push/release workflows (rare — e.g. re-using an existing tag) — investigate manually.
waited=0
while [ "$waited" -lt 900 ]; do
    running=$(gh run list --commit "$TAG_SHA" --json status,headBranch \
      -q "[.[] | select(.headBranch == \"$TAG\") | select(.status != \"completed\")] | length")
    total=$(gh run list --commit "$TAG_SHA" --json databaseId,headBranch \
      -q "[.[] | select(.headBranch == \"$TAG\")] | length")
    [ "$total" -gt 0 ] && [ "$running" -eq 0 ] && break
    sleep 15
    waited=$((waited + 15))
done
[ "$total" -gt 0 ] || { echo "NO TAG-REF RUNS after ${waited}s — investigate"; exit 1; }

failed=$(gh run list --commit "$TAG_SHA" --json conclusion,headBranch,name \
  -q "[.[] | select(.headBranch == \"$TAG\") | select(.conclusion != \"success\" and .conclusion != \"skipped\")] | length")
[ "$failed" -eq 0 ] || { echo "TAG-REF CI RED on $TAG ($TAG_SHA)"; gh run list --commit "$TAG_SHA"; exit 1; }
```

Wait until terminal. If red:
1. Investigate (same as step 6 failure drill).
2. If the failure reveals a real bug (not just flake): fix on `main`, cut a follow-up patch release. Do not rewrite the tag.
3. If `update-changelog` failed: `CHANGELOG.md` won't be prepended — re-run the workflow once the underlying cause is fixed, or prepend the entry manually (rare).

**Rule:** the skill is not "done" until 8b goes green. "Tag cut" is not the finish line; "tag-ref CI green + release-event workflows green" is.

## Quick Reference

| Step               | Command                                                                                        | Pass criteria                                 |
|--------------------|------------------------------------------------------------------------------------------------|-----------------------------------------------|
| 1. Rector          | `vendor/bin/rector process \|\| true`                                                          | 0 files changed                               |
| 2. Pint            | `vendor/bin/pint --dirty --format agent \|\| true`                                             | clean                                         |
| 3. Tests           | `vendor/bin/pest \|\| true`                                                                    | 0 failures                                    |
| 4. PHPStan         | `vendor/bin/phpstan analyse --memory-limit=2G \|\| true`                                       | 0 errors                                      |
| 5a. README + docs  | staleness: manual scan vs `git log <last-tag>..HEAD`; verbosity: word count + prose-run scan over **every current** README/docs page (docs-site repos: docs pages, index sync, link audit) | no stale claims; every verbosity-audit item clean on every page (feature-list description on the README, budget, paragraph cap, prose-majority, gratuitous rationale, uncollapsed long tail, detail written above its tier); indexes agree; README site links match generator routes; repo-relative + asset links resolve |
| 5b. Boost docs     | `vendor/bin/boost sync \|\| true`                                                              | `.ai/` ↔ generated files in sync              |
| 5c. Docs build     | derived command (mirror docs workflow, else lockfile + `build` script), docs-site repos only   | build succeeds, or documented skip + 5a link audit |
| **commit + push**  | user confirms changes + `git push`                                                             | HEAD pushed to `origin/main`                  |
| 6. CI green-light  | `gh run list --commit "$(git rev-parse HEAD)"` all complete + no failure                       | every run for the SHA in `{success, skipped}` |
| 7. Release notes   | delete any pre-green/placeholder notes → preflight (clean tree + **merged** + CI green on release commit) → `Write internal/release-notes-<version>.md` | first line is `<!-- verified-sha: $real-green-SHA -->` (never a placeholder) |
| 8a. Pre-tag gate   | agent runs A–D (SHA-drift, push/merge state, CI-still-green, **content-presence**) before presenting handoff + REFUSES on failure; user re-runs before `gh release create` | prints `OK to tag`                            |
| 8b. Post-tag watch | `gh run list --commit "$TAG_SHA"` filtered by `headBranch == $TAG`                             | tag-ref + release-event workflows all green   |

## Important

- Run every step, in order, even if the change set looks small. Seemingly unrelated refactors have historically introduced regressions across surfaces the local quality gate doesn't exercise.
- Do not push if any step fails. Fix, then restart the checklist from step 1 — earlier steps may re-break after a later fix.
- Step 5a and 5b are the most common source of silent drift — the README and shipped skills are read by downstream users, and bloat accumulates fast. Delete stale content before adding new.
- Step 6 is the non-skippable gate: CI runs against a clean environment (no ambient env vars, no cached state, fresh composer install) and frequently catches env-shape bugs that local dev never sees. If the push+watch feels slow, that's the point — waiting 2 minutes for CI green is cheaper than tagging a broken release.
- Step 7 (release notes) is gated by step 6 — **the release-notes file must not exist on disk until CI is green on the pushed commit.** If you catch yourself about to `Write` a release-notes file after running local checks, stop: you are about to fabricate facts that the CI matrix has not yet established. Run the step-7 preflight commands first; if any of the three conditions is not satisfied, the draft is premature.
- **A pre-existing or placeholder notes file is "no notes," not "draft ready."** If `internal/release-notes-<version>.md` already exists before CI is green (recycled from a prior version, or pinning a placeholder/`TODO`/`REPIN` SHA), DELETE it and redraft against the real green SHA — never edit it in place. Editing a carried-over file "to fix the content" pre-green is the rationalisation that has shipped a broken release: the file looks ready, the handoff overstates readiness, and the placeholder SHA defeats the 8a gate.
- **In a PR-based release, merge first, then notes, then tag.** A green feature-branch CI is not the release gate; the tag is cut from the release branch, so re-run step 6 on the post-merge commit. Drafting notes or handing off a tag while the PR is open has pointed a tag at pre-feature `main` — a green-but-empty release that still resolved on Packagist for dependents.
- **The agent runs the 8a gate before presenting the tag handoff and refuses on failure** — it is not solely a user-run step. The handoff message is a readiness claim; an unverified handoff is how the user ends up tagging an unready state. 8a check D (content-presence) is the backstop: a tag whose tree does not contain this release's own commit (a reachability check that holds for any release shape) is rejected even if every other check is somehow satisfied.
- Step 8 closes the gap that has shipped broken releases before. 8a re-verifies the live remote tip (`git ls-remote`, not the cached `origin/main`) so a concurrent push can't slip a stale commit through. 8b uses `--commit "$TAG_SHA"` + a jq filter on `headBranch == $TAG` (not `--branch "$TAG"`, whose tag-ref semantics are undocumented and unreliable) so the tag-ref `on: push` re-fires and `on: release` decorators are both caught. Run both every time, even for one-commit patch releases.
- `pest --parallel` on Windows `prefer-lowest` has a known FS race around non-atomic ops like `rename()`. Do not assume local parallel-pest green proves CI-matrix green. Step 6 + 8b are the authoritative test gates.
