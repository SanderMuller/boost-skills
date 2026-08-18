# Changelog

All notable changes to `sandermuller/boost-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2.28.0 - 2026-08-18

<!-- verified-sha: 16304b656a38f1e8e5a888292ea2673181c7133a -->
The `readme` and `pre-release` skills now understand packages whose documentation lives in a `docs/` static site (for example VitePress on GitHub Pages) instead of the README. Additive — packages without a docs site see no change.

### Added

- **`readme`: a third README shape — docs-site.** For packages with a `docs/` site: a thin README (badges, pitch + teaser example, install, one usage example, a Documentation section, standard footer) that links to the docs instead of restating them. The skill defines the detection signals (generator config in `docs/`, a root config naming `docs/` as source, or a deploy workflow building from it), link mechanics that keep README links GitHub-renderable, URL-stability rules under route rewrites (a reorder keeps the published URL, a slug rename needs a redirect), per-surface index-sync rules (docs index and sidebar cover every page; a top nav bar is checked for dead entries only), and a scoped link audit that distinguishes source-file links, generator-routed site links, and asset references. The staleness audit now covers `docs/` pages. Sourced from production dogfood.

### Changed

- **`pre-release`: the docs site is audited at every release.** Step 5a's freshness audit now covers docs pages, index sync, and the link audit on docs-site repos. A new step 5c derives and runs the local docs build — mirror the repo's docs deploy workflow, else pick the package manager from the `docs/` lockfile and its `build` script; a documented skip plus the manual link audit is the fallback when no command is derivable or the toolchain is missing. Where the generator fails the build on dead links (VitePress default), broken cross-links are caught before push instead of at deploy time.
- **`pre-release`: accurate CI semantics for path-filtered workflows.** Step 6 now explains that an unmatched `paths` filter creates no workflow run at all (not a `skipped` one), why that absence is correct, and why the per-SHA gate cannot prove a disabled docs workflow ran — the local build attempt is the mandatory docs check, with the CI docs run as additional coverage.
- **`pre-release`: corrected fallback rationale.** The "if the `readme` / `release-notes` skill isn't synced" fallbacks no longer claim tag filtering drops them — `boost-requires` rescues both into every sync that ships `pre-release`. The fallbacks now name their real audience: sync pipelines that don't honor `boost-requires`.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.27.0...2.28.0

## 2.27.0 - 2026-08-15

<!-- verified-sha: f2994a085d448af311fd44b2f41b83044771361c -->
A dedicated skill for the browser pass that `frontend-quality` can only afford to make one advisory step. Tag-gated on `frontend`; projects that do not declare it see no change.

### Added

- **`eye-verification` — a command-only browser verification flow (`/eye-verification`).** `frontend-quality` ends with an eye-verify step, but it sits behind type-check, lint, and tests, and is deliberately advisory: run it where a harness exists, defer it explicitly where none does. That framing is right for a quality gate and wrong for the moment the browser pass *is* the task — a UI change whose risk is entirely runtime, or work that has to leave proof behind for a reviewer and QA.
  
  The new skill is that flow, and it is mandatory end to end. It resolves the testables before driving anything, in a fixed priority chain: the PR body's testing section, then the tracker issue's QA testables or reproduction steps, then a spec's edge-case table, and — when none of those exist — gathered from the diff and listed back so the coverage is visible. A section left at its template placeholder yields nothing and falls through rather than passing as a source.
  
  It then drives every testable, including its edge cases, and reports **Pass / Fail / NOT VERIFIED** with the evidence that proves each one. A testable that could not be driven is named with its reason; an unqualified green over a partial pass is the failure mode the skill exists to prevent.
  
  The last step is the one that is usually skipped: **captured is not published**. A screenshot proving a testable is stored durably in the repo and attached to the PR or tracker issue that already exists, rather than left at whatever local path the capture wrote it to.
  
  Scope covers committed and uncommitted work both — this runs before the commit more often than after it, so a committed-only diff would report "nothing changed" over a full working tree of frontend edits.
  
  The skill carries the orchestration only. The harness, the coverage contract, the traps that fake a green run, fault injection, and per-element design verification stay in `frontend-quality`'s references and scripts, which it declares via `boost-requires` and points at rather than duplicating.
  
- **`frontend-quality` routes to it.** Its eye-verify step now names the dedicated flow for changes that deserve a full mandatory pass, where the project ships it.
  

### Notes

- **Command-only.** `disable-model-invocation: true`, and the description carries no activation triggers, so agents that ignore that flag do not auto-activate it either. Invoke it deliberately.
- **Tagged `frontend`,** the same tag as `frontend-quality` — a project that declares one gets both.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.26.0...2.27.0

## 2.26.0 - 2026-08-14

<!-- verified-sha: bc41652dd2af9c13e766f3f234d7e44dde811431 -->
Bot review threads now close on the thread itself. Additive — no configuration change needed.

### Changed

- **`pr-review-feedback`: every bot thread ends in one of three states.** Applying the code was only half the loop: reasoning posted as one top-level PR comment left the threads showing as unresolved, so the next reviewer had to read and re-judge every one of them. Each bot thread now ends **applied** (reply on the thread with what changed, then resolve), **declined** (reply with the reasoning, then resolve), or **deferred** (a human took the thread over: reply that it is being worked, leave it open, and the PR goes back to draft until it closes). A top-level comment never counts as closing a thread. Self threads — your own notes-to-self — keep the lighter rule: resolving without a reply is fine. Sourced from production dogfood.
  
- **`pr-review-feedback`: the hard gate got harder.** The final verification now pages past 100 review threads, flags threads whose comment list was truncated, verifies a deferred thread actually sits on a draft PR, and catches silent resolves — a resolve without a reply passes the unresolved-threads query, so the gate now demands proof the reply exists (the reply mutation's returned comment URL, or a by-id thread lookup). A thread the agent lacks permission to resolve is reported as blocked work, not waved through as an allowed exception.
  
- **`pull-requests`: one owner for draft/ready.** A new *Marking a PR Draft / Ready* section owns `gh pr ready` in both directions. Marking ready has one precondition — zero unresolved bot threads, checked with a paginated query before every flip, including the auto-ready for low-risk PRs. Open colleague threads never block: they are the review conversation itself. `pr-review-feedback` routes its draft/ready flips through this section and now declares the dependency (`boost-requires`), so the two skills always sync together.
  

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.25.0...2.26.0

## 2.25.0 - 2026-08-14

<!-- verified-sha: 58ea1f87752f87a1a11509fba66578999fba28a1 -->
A new opt-in guideline that settles which voice an agent writes in, per surface. Additive — a project that does not declare the `voice` tag sees no change.

### Added

- **`voice` guideline (opt-in, tag `voice`).** Agent output drifts in register: a PR body reads like marketing, a Jira ticket like a stack trace, a chat reply buries the answer under three paragraphs of throat-clearing. The guideline fixes one rule per writing surface in a routing table — chat replies, PR titles and descriptions, review replies, issue and ticket text, spec files, `AskUserQuestion` payloads, and commit messages all take ASD-STE100 Simplified Technical English, and the guideline ships those twelve rules with it (one idea per sentence, active voice, simple tenses, everyday words, answer first, no shouting). Text an end user reads routes to the project's own tone-of-voice rules instead, so the two can never compete over the same words. A skill that defines its own voice — `humanizer`, `readme`, `release-notes` — keeps it, and so does prose the user asks for in a named style. The table also states the fallback for a surface it does not list, so an agent never guesses.
  
  The guideline is always-loaded once a project opts in, which is the point: a rule that governs every reply cannot wait for a load trigger. Declare it with `->withTags([..., 'voice'])` and run `vendor/bin/boost sync`. Sourced from production dogfood.
  

### Changed

- **`boost-skills` now declares the `voice` tag itself.** The catalog eats its own cooking; every reply, PR, and commit message written in this repo follows the guideline.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.24.0...2.25.0

## 2.24.0 - 2026-08-05

<!-- verified-sha: 5dfddd7d389faa2896842069c2c76fd197eacaa9 -->
A conventions slot for projects that mandate a label on every PR. Optional and additive — leave it out and nothing changes.

### Added

- **`pr.labels` — a configurable mandatory-PR-label policy for `pull-requests`.** Some organisations require every PR to carry exactly one label from a fixed vocabulary, chosen by a question the diff cannot answer: who wrote the first working version, which change class this is, which compliance category applies. There was no slot for that — `pr` accepted only `title_format`, `template_path`, `gates` and `risk`, and rejects unknown keys, so the policy could not even be forward-declared. The remaining option was the guideline layer, which is compiled into `CLAUDE.md` / `AGENTS.md` and loaded in every session, so a rule that only matters when a PR is created cost tokens on every unrelated task.
  
  Declared in `boost.php`, the policy renders inside the `pull-requests` skill instead, where it is read only when that skill activates:
  
  ```php
  'pr' => [
      'labels' => [
          'require_exactly_one' => true,   // false ⇒ at most one
          'exempt_bot_authors' => true,    // skip for Dependabot & friends
          'rule' => 'Who wrote the first working version of the main change?',
          'rule_doc' => 'docs/pr-label-policy.md',   // optional prose
          'options' => [
              ['name' => 'Label A', 'when' => 'criterion for A'],
              ['name' => 'Label B', 'when' => 'criterion for B', 'on_doubt' => true],
          ],
      ],
  ],
  
  
  
  
  
  ```
  The slot carries the mechanism only. Label names, the deciding question, and the policy prose are yours — no vocabulary and no semantics are fixed by the package, and `options` has no mandated length beyond needing at least one entry.
  
  The skill applies the `name` **verbatim**. These vocabularies are usually aggregated outside the repo, where a translated or re-cased name does not fail loudly; it just stops counting, and the repo drops out of the aggregation unnoticed.
  
  How the label is decided: the agent answers `rule` from first-hand knowledge when the work happened in the session, treats repository evidence (commit history, trailers, the diff) as an input rather than an answer when the branch predates it, and asks the author otherwise — batched into the existing pre-PR `AskUserQuestion` call alongside the risk and description-direction questions. `on_doubt` marks the option an uncertain *author* falls back to; the agent may not use it to skip asking. A resolved label reaches the PR via `gh pr create --label`.
  
  The package applies the label, it does not enforce it. Nothing here blocks an unlabelled PR — add a CI check on the PR event if you need a hard gate.
  
- **`final-verification-review` reports the label policy in its closeout check.** A configured mandate is now visible before the PR exists rather than at creation time. An unresolved label is a note, since the pre-PR question resolves it; only a config that cannot be satisfied — an empty `options` list, or several options claiming `on_doubt` — is reported as blocking.
  

### Notes

- **Absent ⇒ no behaviour change.** With no `pr.labels` declared, both skills render an explicit no-op and there is no label step. Existing configs are unaffected.
- **No `schema-version` bump.** This is additive to v1; `schema-version` stays `1`.
- **Orthogonal to `pr.risk`.** A risk tier's own `label` is routing metadata applied by tier score; `pr.labels` is an author-declared policy. Declare either, both, or neither — with both, a PR carries both labels.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.23.1...2.24.0

## 2.23.1 - 2026-07-31

<!-- verified-sha: 650ae5a2e0bbbe7faed5042e2518b7ae759d087d -->
Fixes four ways the `dangling-symbols.sh` companion introduced in 2.23.0 could report a clean sweep on a merge that had a real dangling reference. **If you are on 2.23.0, upgrade** — a check that silently passes is worse than no check, because `resolve-conflicts` tells you to trust its result.

### Fixed

- **The sweep no longer depends on the reader's git configuration.** It parsed git's human-facing output while assuming defaults, but that output is shaped by settings the script neither set nor inspected. Four of them made it print `No dangling references` and exit `0` against a repository that provably had one:
  
  - `grep.patternType=extended` — the word-boundary `\b` is a GNU regex extension that matches nothing under ERE, so every symbol lookup came back empty. The lookup now uses `git grep -w -F`: `-w` is a git option rather than a regex feature, and `-F` treats the symbol as the literal identifier it is. Verified against the `basic`, `extended`, `fixed` and `perl` pattern types.
  - `color.diff=always` / `color.ui=always` — ANSI escapes prefixed every line, so the `^-` and `^+` matching that finds removed declarations stopped working. Closed with `--no-color`.
  - `diff.external`, and the `GIT_EXTERNAL_DIFF` environment variable — an external driver replaced the diff output entirely. Closed with `--no-ext-diff`.
  - A `textconv` driver bound through `.gitattributes` — content was rewritten before diffing, so a symbol could be transformed out of the diff. Closed with `--no-textconv`.
  
- **A failed sweep now fails loudly instead of reporting success.** `die` was being called from inside a pipeline subshell, where `exit` terminates only that subshell; the script printed its error and then fell through to `No dangling references` with exit `0`. Both diffs are now collected in the main shell, so a git failure exits `2`.
  
- **`resolve-conflicts` no longer falls through to the commit phase on a fast-forward.** The fast-forward outcome noted that nothing needed verifying but omitted the explicit stop its sibling outcome carries, leaving a path that reached the commit phase with an empty tree.
  

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.23.0...2.23.1

## 2.23.0 - 2026-07-26

<!-- verified-sha: a838c232e569713b5b806b6c907d2c01324fea38 -->
`resolve-conflicts` now owns the whole merge rather than just the conflicted parts of it, and verifies the cases git reports as clean. Every git behaviour below was checked against real repositories before being written down; two claims the skill previously made turned out to be wrong.

### Added

- **Cross-side consistency check in `resolve-conflicts`, with a shipped companion.** A merge can combine both sides cleanly and still leave code that no longer agrees with itself — one side renames a declaration while the other adds a reference to the old name. Git reports no conflict, and a diff against either side looks exactly as it should, because the removal and the stale reference never appear in the same comparison. The new `scripts/dangling-symbols.sh` companion sweeps **both** directions (they removed something you call, and you removed something they call) and reports surviving references. Retarget it at any language with `--keywords`; `--help` documents the rest.
- **Clean-tree preflight.** A dirty tree does not reliably stop a merge: git aborts only when the incoming change would overwrite the dirty file, so unrelated work-in-progress otherwise survives into the verification diffs with nothing marking it as unrelated. Untracked files stay excluded from the gate — they never reach a diff — but now carry their own documented abort path, since an incoming file landing on an untracked path stops the merge outright.
- **`bash -n` syntax gate for shipped `.sh` companions**, mirroring the existing `node --check` path for `.mjs` assets.

### Changed

- **`resolve-conflicts` merges with `--no-commit`.** A conflict-free merge previously committed itself before any of the prescribed verification ran, leaving a failed check fixable only by amending or resetting. Conflicted and clean merges now behave identically: the merge stays staged until the commit phase. Fast-forwards are unaffected and need no verification.
- **Marker-less conflicts are handled.** Modify/delete and rename/delete conflicts (`DU`/`UD`) carry no `<<<<<<<` markers — git leaves the surviving side's content in place, so deciding what is left to resolve by grepping for markers skips those files entirely while they look finished. Conflicts are now enumerated by status code, with the opposite side read through `git show :N:`.
- **Failing tests are baselined against both parents.** Red on your branch was previously enough to call a failure pre-existing and move on. But a test red on your side may have been *fixed* on the incoming one, in which case a red result after the merge means the resolution dropped that fix — the exact dropped-functionality bug the skill exists to prevent. All four ours/theirs combinations now have a verdict.
- **Verification split by the question it answers.** "Did the resolution keep both sides?" (a diff) and "do those changes still agree with each other?" (the sweep and the test suite) are separate checks, and the second runs even when git reported no conflict.
- **`pull-requests`, `pr-review-feedback`, and `jira-rework` route their whole base-sync merge through `resolve-conflicts`**, not just the conflicted case. Each previously restated the post-merge verification itself, precisely because a clean merge never reached the skill. All three now declare `boost-requires: resolve-conflicts`.

### Fixed

- **`merge-tree` exit taxonomy in `resolve-conflicts`.** Unrelated histories exit `128` with `fatal: refusing to merge unrelated histories`, not exit `1` with the `not something we can merge` message the skill attributed to them. Exit `128` is now documented as its own case, covering both that and the rejected `--quiet` + `--name-only` combination.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.22.0...2.23.0

## 2.22.0 - 2026-07-26

<!-- verified-sha: a52cbddfe51142c389cdd33ba4079f2bf59caaa4 -->
Two review-quality disciplines: trace behavior claims to real code before writing them, and check what was built against what was actually required.

### Added

- **"Trace, Don't Assume"** in the verification-before-completion guideline (so it applies everywhere, via `CLAUDE.md` / `AGENTS.md`): a claim about how the code *currently* behaves — a root cause, an existing mechanism, present behavior — must be traced to real code or a runtime observation before it's written into a spec, PR, commit, review, issue, or comment, and no illustrative example may be invented. Intended behavior a spec proposes as a requirement is exempt. Stops one unverified guess from seeding a whole ticket's context and tests on a false premise.
- **Conformance & scope check in `code-review`** — fetch the *real* requirement (the spec's goals, technical sections, and edge cases; un-superseded linked-issue criteria; or the task itself), then verdict each requirement **requirement-down** (Met / Partial / Unmet), and scope-check for implied requirements, unrequested extras, silent interpretations, and side effects. The diff shows what was built, never what was forgotten.

### Changed

- **`implement-spec` now walks the requirements before final verification** — task checkboxes track *tasks done*, not *requirements met*, so a required behaviour no task mapped to is otherwise never caught. It verifies each requirement against real code, then runs the full quality gate last so that gate covers anything the walk changed.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.21.0...2.22.0

## 2.21.0 - 2026-07-16

<!-- verified-sha: 9257915c000c140d8d38258d83ffc397711ce368 -->
### Added

- **`clean-specs` skill** (command-only, `/clean-specs`) — a post-merge net that removes spec files whose work is fully shipped: every task box checked **and** a title/branch-matched, un-reverted merge commit that is an ancestor of the base branch. Conservative by design — it leans toward keeping a spec on any ambiguity, reports and asks for confirmation before deleting, re-checks eligibility against fresh state, and ships the removal as a reviewable PR.

### Changed

- **`pull-requests` now removes the implemented spec as a detect-and-verify step**, not a from-memory delete. It finds the branch's spec from the diff against the base, removes it, and verifies no unrelated spec was swept in by a broad `git add -A` — closing the path by which implemented specs reached the base branch. Unrelated specs that were swept in are restored without discarding local content.
- **`implement-spec` cleanup** defers spec removal to that step instead of hand-deleting, and points at `/clean-specs` as the post-merge backstop.
- **`clarify`, `write-spec`, and `implement-spec`** now delegate multi-file research sweeps to a read-only research subagent, keeping the main working context small on research-heavy flows.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.20.0...2.21.0

## 2.20.0 - 2026-07-16

<!-- verified-sha: 2fbe6c08eeb1b25b034742ef2c81b0d0a76fbe34 -->
### Added

- **`clarify` skill** — the shared questioning core: code-first exploration,
  bisect-to-intent, fuzzy-term sharpening, scenario stress-tests, and an
  assumptions audit. Usable standalone (`/clarify`) or as the base other skills
  build on.
- **`promptimize` skill** — turns a rough prompt into one optimized,
  model-agnostic prompt and returns only the prompt. Builds on `clarify`.
- **Eye-verify harness for `frontend-quality`** — a shipped `scripts/lib.mjs`
  helper library (`createChecker`, `capturePageIssues`, `withFailedRoute`) and a
  `references/eye-verify.md` coverage-contract guide, so a project gets
  browser-verification plumbing without building its own. `console.mjs` gained an
  `--axe` accessibility/contrast pass, screen-reader-attribute leak scanning, and
  application-request (xhr/fetch) failure gating.
- **Dependency-aware spec workflow** — `write-spec` phases now declare an
  immutable `ID` and `Depends:` edges; `implement-spec` computes each ready
  "wave" and can implement independent phases in parallel under an explicit
  opt-in, with write-disjoint and DAG-validation safeguards. Specs without the
  new metadata fall back to the existing sequential behaviour.

### Changed

- **`interview` now builds on `clarify`** (declares `boost-requires: clarify`) —
  the grilling disciplines live in one place instead of being duplicated across
  skills.
- **`migration-squash` is now invoke-only** (`disable-model-invocation: true`).
  It no longer auto-activates on incidental mentions of migrations or
  `schema:dump`; run it explicitly (`/migration-squash`) or by directly asking
  for a squash. This matches its destructive nature — a squash deletes migration
  files.

### Internal

- `validate-skills.php` now runs `node --check` over every shipped
  `*/scripts/*.mjs` companion asset, not only the codex-review wrapper.
- Documented the `boost-requires` skill-dependency system in the README.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.19.0...2.20.0

## 2.19.0 - 2026-07-10

<!-- verified-sha: c7eccb58ea36bf8d78d8384e7cb239ddf5d0e931 -->
Activates the skill dependencies declared in 2.18.0. That release shipped the
`metadata.boost-requires` declarations but they were inert on the engine
available at the time; `boost-core 1.4.0` resolves them, so this release raises
the floor to require it.

### Changed

- **Requires `sandermuller/boost-core ^1.4`** (raised from `^1.3`).
  `boost-core 1.4.0` resolves `metadata.boost-requires`: whenever a skill ships,
  every skill it hands off to ships too, and a required skill that a consumer's
  tags would otherwise drop is rescued in (transitively, surfaced as an INFO
  diagnostic). Pinning the floor here makes the co-shipping guarantee real for
  every consumer instead of best-effort. `1.4.0` is additive and backward
  compatible, and the catalog already required `^1.3`, so the step is small.
  Authoring guidance for `boost-requires` lives in `boost-core`'s README.

No skill content changed — the declarations themselves shipped in 2.18.0.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.18.0...2.19.0

## 2.18.0 - 2026-07-10

<!-- verified-sha: 9a01ee921389304f9eef3f3ffa73b6f13fe7bfd0 -->
Six skills now declare their hard dependencies in frontmatter, dogfooding the
skill-dependency system `boost-core` is building. Once that engine lands,
selecting a skill will co-ship every skill it hands off to — a dependency the
tag filter would otherwise drop gets rescued, so a skill never delegates to
something that isn't there. This release ships the declarations only: they are
**inert under the current engine** (`boost-core ^1.3` ignores the unknown
`metadata.boost-requires` key, verified against the shipped engine), so it is
safe ahead of the resolver and changes nothing for consumers until they run a
dependency-aware `boost-core`. Everything is **additive** — no skill removed or
renamed.

### Added

- **Skill dependency declarations (`metadata.boost-requires`).** Space-delimited
  bare skill names, mirroring `boost-tags`. Six skills declare their hard
  hand-offs:
  
  - `interview` → `write-spec`
  - `bug-fixing` → `test-writing`
  - `evaluate` → `code-review codex-review`
  - `final-verification-review` → `evaluate codex-review pull-requests`
  - `pre-release` → `readme release-notes upgrading`
  - `jira-rework` → `jira-updates`
  
  Only **hard hand-offs** — where a skill's flow invokes another skill — are
  declared. Conditional and routing references stay undeclared on purpose:
  `jira-create` / `jira-updates` only cross-reference each other for routing,
  and capability-gated mentions like `backend-quality` / `frontend-quality` are
  scoped by tags, so declaring them would rescue tooling into projects that do
  not want it.
  

The declarations were derived from a body-reference audit of the catalog and
validated against `boost-core`'s ship-closure design, then dogfooded through
this repository's own review flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.17.0...2.18.0

## 2.17.0 - 2026-07-03

<!-- verified-sha: d95543268942dfc269c6d04d09ab8dcedf2530a4 -->
### Added

- **A shipped eye-verify harness** (`frontend-quality/scripts/`, emitted as `boost-core` 1.3
  companion assets). Three framework-agnostic tools so a project stops rebuilding the plumbing:
  
  - `screenshot.mjs` — navigate a running app, optionally crop to a `--selector` with ≥15px
    padding (clamped to the page), save a PNG.
  - `console.mjs` — record console errors/warnings, uncaught page errors, and failed requests;
    `--text-pattern` scans rendered text for a project-supplied leak regex (e.g. untranslated-key
    markers); `--fail-on-error` gates.
  - `auth-capture.mjs` — the portable auth seam: open a headed browser, log in by hand, save a
    Playwright `storageState` the other two reuse via `--storage-state`. Knows nothing about any
    login form, so it works for any app.
    Playwright is a project prerequisite (`npm i -D playwright && npx playwright install chromium`);
    each tool fails fast with that hint if it's absent. What stays per-app is only genuinely
    app-specific glue (programmatic SSO login, data seeding, domain drivers).
  
- **Catalog-consistency CI gate** (`.github/validate-catalog.php`). The format validator never
  checked that the catalog's own tables agree with what ships; the new gate enforces README
  Skills/Guidelines tags vs each skill's `metadata.boost-tags`, skill/guideline inventory,
  the guideline tag sidecar, the documented tag vocabulary, `boost:conv` tokens vs real
  `conventions-schema.json` slots, and `schema-required` vs conv usage.
  
- **On-demand design-verification reference** (`frontend-quality/references/design-verification.md`).
  The full per-element scoring rubric — attributes incl. shadow/elevation, line-height,
  letter-spacing, tap-area; the "undocumented difference is a finding, not a deviation" rule;
  image-sampling to the nearest project token when there's no token spec; and a ✓/✗ scoring table.
  

### Changed

- **`codex-review` replaced the plugin path with a bounded native-CLI wrapper.** The Codex
  plugin's companion awaited a `turn/completed` event with no timeout and hung on stale broker
  sessions. The skill now ships `scripts/run-codex-review.mjs` (a companion asset) that runs the
  bare `codex` CLI under a hard timeout — it cannot hang and cannot read a stale prior run's
  output. The wrapper adds an env-configurable timeout (`CODEX_REVIEW_TIMEOUT_MS`, floor 1000ms;
  `--timeout-ms` wins) and a no-flag target fallback that infers the review target from the repo's
  default branch. `codex.invocation_mode` is deprecated and ignored (retained in the schema so
  existing configs keep validating).
- **Eye-verify woven deeper.** `frontend-quality` gained a "seed the off-by-default state before
  capturing" step and points at the shipped harness as the primary capture path; `pull-requests`
  documents private-repo image embedding (a committed PNG's `?raw=true` blob URL renders inline
  for authenticated members; a browser drag-drop `user-attachments` URL is the no-file fallback;
  `data:` URIs are stripped by GitHub). The `javascript` guideline was slimmed to the always-on
  principle plus a pointer, so the detailed rubric lives on-demand rather than in every project's
  `CLAUDE.md`.

### Fixed

- **README tag/inventory drift**, surfaced by the new gate: `pre-release` now documents its
  `release-automation` tag (a consumer declaring only `php`+`github` would not have received it);
  `jira-updates` drops a `github` tag it never carried in frontmatter; and the shipped
  `signed-commits` guideline gets its missing row in the Guidelines inventory.

### Internal

Repository-only; none ship to consumers (all under `export-ignore`d paths or dev config):

- CI `composer install` runs `--no-scripts --no-plugins` on the fork-exposed `pull_request` job.
- Dependabot now watches the `composer` ecosystem, not just GitHub Actions.
- `stolt/skill-validator` pinned exactly (`0.0.1`; the `^0.0.1` caret resolved to the same version).
- Removed a dead `.mcp.json` pointing at a `vendor/bin/testbench boost:mcp` command this package
  does not provide.

The codex, eye-verify, and design-verification work was sourced from the upstream catalog and
production adoption feedback, then dogfooded through this repository's own evaluate and
codex-review flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.16.1...2.17.0

## 2.16.1 - 2026-06-30

<!-- verified-sha: b17d63530e47ca45aabd7025ec084c4283acdeea -->
### Fixed

- **`interview` and `write-spec` no longer instruct a redundant manual "Other" option in assumption audits.** Both skills told the agent to add an explicit `"Other / let me clarify"` choice to each `AskUserQuestion` audit prompt, but `AskUserQuestion` already appends its own free-text "Other" — so prompts rendered two semantically identical escape hatches. The instruction now drops the manual option and notes the tool supplies one. This also removes the `"let me clarify"` first-person pronoun, aligning the wording with the `ask-user-question` guideline shipped in 2.16.0.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.16.0...2.16.1

## 2.16.0 - 2026-06-28

<!-- verified-sha: b00295ec8a047b763ec3c3ab532f0df00eb38505 -->
A frontend-quality release: first-class frontend testing and browser eye-verification join the catalog, a new Laravel migration-squash skill and an always-on AskUserQuestion guideline ship, and `codex-review` is hardened against the plugin hangs that have stalled reviews. Everything here is **additive** — no skill or guideline was removed or renamed, no conventions slot or `schema-version` changed, so a consumer upgrading from 2.15.0 keeps every existing behavior and simply gains the new content (tag-gated where noted).

### Added

- **First-class frontend tests.** `frontend-quality` now runs the project's JS/TS test suite (Vitest / Jest / …) as a third check alongside type-checking and linting — scope to the changed area during development, full suite at completion, and cover changed logic with a test. `test-writing` and `bug-fixing` gained framework selection for JS/TS runners (auto-detected from `package.json`), so a frontend bug is reproduced with a failing JS test the same way a backend one is. (`frontend` tag.)
- **Eye-verification (browser self-verify).** A UI change is best confirmed by *seeing it run* in a real browser — type-check and lint can't catch runtime/visual bugs (stale state, dead toggles, broken scroll / sticky behaviour, z-index show-through, async races, untranslated-key leaks). Woven through the lifecycle as advisory guidance: the `javascript` guideline gains an "Eye-verify frontend changes" section, `frontend-quality` a suggested eye-verify step, `pull-requests` an advisory pre-PR gate, and `bug-fixing` / `write-spec` reference it for visual fixes and UI-feature success measures. Includes per-element / per-attribute design verification (don't eyeball the whole image), ~15px padding around single-element screenshot crops, ephemeral-clone host targeting (a worktree may be served elsewhere — a hard 404 means the wrong host), and PR screenshot mechanics (embed in the PR body, commit a file rather than a base64 `data:` URI that hosts strip, include the approved design alongside; a harness that can't run this session is a tracked deferral, not a silent skip). Generic — a project supplies its own browser harness (commonly `tools/verify/`) or a Playwright MCP server.
- **New `migration-squash` skill** (`laravel` tag). Create or review a Laravel migration squash (`schema:dump --prune` into a single schema baseline) with a verification checklist that catches the defects squash PRs actually ship with: an incomplete dump (DB behind the target), a contaminated dump (a migration applied from an abandoned/local/renamed branch), and a pruned data-migration whose seeded rows vanish on a fresh DB because `schema:dump` captures structure, not rows. The completeness and contamination checks compare the dump's records against the target's *baseline records ∪ migration files* — so legitimate history whose files earlier squashes pruned isn't false-flagged. Defaults to the standard `mysql-schema.sql` (the `.dump` rename is an optional project variant), keeps the review steps host-neutral, and defers destructive operations to the `database-safety` guideline.
- **New `ask-user-question` guideline** (always-on). In `AskUserQuestion` the user reads a question *from* the assistant, so first/second-person pronouns are ambiguous — the guideline says to name the actor explicitly ("the assistant" / "the user") or drop the pronoun, across the question text, every option label, and every option description.

### Changed

- **`codex-review` hardened against Codex plugin hangs.** The companion awaits a `turn/completed` notification with no timeout, so a dropped event (broker/version skew, an untrusted ephemeral clone path) could hang a review forever. The skill now clears stale brokers in a preflight before every launch, treats a poll-loop timeout as a hang and recovers via the synchronous bare-CLI path (immune to the hang) rather than reading a stale result, and calls out that ephemeral clone paths (e.g. polyscope) aren't auto-trusted — trust the dir first.
- **Sync the base into the branch before every push.** `pull-requests` (a new preflight item plus a sync step in the work-on-existing-PR flow) and `jira-rework` now merge the resolved base in before pushing, so CI tests the branch against the latest target rather than a stale base — closing a conflict/break class that a green CI run can otherwise hide. The PR analysis compares against the just-fetched `origin/<base>`. `pr-review-feedback` already did this.
- **Sharper code-comment bar in `evaluate`.** Phase 3 keeps a comment only when, without it, a competent reader would draw the wrong conclusion or break the code on edit — a real-but-inferable why belongs in the tracker, not inline. Adds a density signal: more than one surviving comment in a single function is a smell that the code wants splitting or renaming.
- **Generic PR risk framed as residual risk.** The `pull-requests` Low/Medium/High block now weighs risk *after* the checks that run on every change (tests, CI, QA, reviewers): a loud, reversible failure ranks below a silent or irreversible one, and a narrow, well-tested change on a shared path isn't automatically high risk. Projects with `pr.risk` tiers still delegate scoring to their own matrix.

The frontend-testing and eye-verification work and the skill refinements were sourced from upstream and production adoption feedback, then dogfooded through this repository's own evaluate, codex-review, and release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.15.0...2.16.0

## 2.15.0 - 2026-06-26

<!-- verified-sha: cb6caafe42313ce90798ad2e4c2e8eb0ed7856f3 -->
### Changed

- **`pr-review-feedback` now activates on how the team actually asks.** The skill's trigger description previously only matched the formal "apply review feedback" wording. It now recognises terse, real-world phrasings — "fix the comments", "fix PR comments", "fix review comments", "fix comments issue 1234" — plus the Dutch "verwerk de comments" / "comments fixen". The description was also trimmed back to a single trigger list (it had grown to two overlapping lists).

### Added

- **Phase 0: bare-number resolution.** A loosely-named "fix comments 1234" is ambiguous — `1234` may be the PR or the issue the PR was created for. Phase 0 probes GitHub to classify the number, and when it's an issue, finds the linked open PR (by branch prefix, then by an explicit issue reference in the PR body) before any feedback is gathered. When more than one PR matches, or none, it lists the candidates and asks rather than guessing.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.14.0...2.15.0

## 2.14.0 - 2026-06-19

<!-- verified-sha: 97a4e14a490014905f9ab62e48fbb2e42690c332 -->
### Changed

- **Slot-aware skills now use paired visible-default conventions tokens.** The 13 skills that inline project conventions (`pull-requests`, `bug-fixing`, `test-writing`, `backend-quality`, the Jira skills, and the rest) wrap each slot as `<!--boost:conv …-->default value<!--boost:conv:end-->`. `boost-core` still resolves the whole span to the configured value at sync time; an engine that does not resolve `boost:conv` — notably `laravel/boost` — now shows the default value as readable text rather than a gap where the value was previously hidden inside a comment attribute. **Requires `boost-core ^1.2.1`** — the paired form needs the 1.2.1 engine, and the floor skips the empty `1.2.0` tag.
- **`pre-release` and `release-notes` hardened against premature and empty releases.** Adds an explicit PR-based release flow (merge → re-run CI on the post-merge commit → draft notes → tag; a green feature-branch CI is not the release gate); treats a pre-existing or placeholder-SHA notes file as "no notes yet" (delete and redraft, never edit in place); makes the step-8a pre-tag gate agent-run with a content-presence check that the release's PR is actually merged; and makes the release flow release-branch-aware instead of hardcoding `main`.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.13.0...2.14.0

## 2.13.0 - 2026-06-19

<!-- verified-sha: 25d74c4b7b6b8c3aa96070ef7a4000ec5bcff886 -->
### Changed

- **`humanizer` now catches the AI tells that survive a vocabulary swap.** The skill's Wikipedia-based foundation handled the encyclopedic register; this release grafts the rhetorical and structural patterns from the MIT-licensed [stop-slop](https://github.com/hardikpandya/stop-slop) by Hardik Pandya, which target the punchier "AI blog post" voice. Nine new patterns (#30–#38) cover false agency (abstractions given human verbs to hide who acted), narrator-from-a-distance, throat-clearing openers, dramatic fragmentation, lazy extremes, performative emphasis, business jargon, Wh-openers, and engineered "quotables"; the negative-listing striptease folds into the existing parallelism pattern. Two tools come with them: a Quick Checks pre-delivery pass and an optional five-axis scoring rubric. The new rules are scoped so they don't degrade neutral reference docs — README, API docs, and release notes keep their third-person, impersonal voice and evidentiary phrasing ("the benchmark shows" is not false agency). Untagged, so it applies to any project's prose. Additive under conventions `schema-version 1` — no breaking change.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.12.0...2.13.0

## 2.12.0 - 2026-06-17

<!-- verified-sha: a0d8b61fca92c7d386cdbcc91316062256b02387 -->
### Changed

- **`pr-review-feedback` now reliably resolves threads, not just applies the code.** A "close the loop" finish-line plus a new Phase 7 hard gate re-query the PR and assert zero unresolved bot/self threads remain (colleague threads stay gated). Resolving each bot/self thread is now mandatory, thread IDs are re-fetched if they scroll off, and the skill's triggers gained Copilot / CodeRabbit / "resolve threads" so natural-language asks discover it. Fixes feedback being applied while the review threads were left open. Additive under conventions `schema-version 1` — no breaking change.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.11.0...2.12.0

## 2.11.0 - 2026-06-17

<!-- verified-sha: 265a1696fbe22e2b3a0323aa09b8410c4634b240 -->
Five workflow skills gained a named anchor concept (a "Leitwort") that recurs through the skill, with one key step reframed as a gate the agent can't rationalise past. The writing skills picked up a shared prose trio. All additive under conventions `schema-version 1` — no new convention slot, no breaking change.

### Changed

- **`bug-fixing`** now anchors on **the red test** / red-green-refactor: no production edit until a red test reproduces the bug (with a carve-out for defects that genuinely can't be expressed as an automated test).
- **`code-review`** anchors on **proportionality** and **code health over time** — match each finding to its real impact, review for net improvement, and cut findings that don't earn their line.
- **`test-writing`** frames every test as an **executable specification** (the name reads as scenario + outcome) and names the **assertion roulette** smell — one behaviour per test, not the "one assertion per test" misreading.
- **`resolve-conflicts`** names the **semantic conflict** — a clean textual merge that still drops one side's behaviour — and gates the verify phase on preserving both intents.
- **`ux-review`** adds the **principle of least astonishment** as a justify-don't-reject gate: novel UI is allowed, but must be justified against user expectation.
- **Writing skills share a prose trio.** `pull-requests` names its existing **why, not what** rule and adds **omit needless words**; `release-notes` and `readme` adopt **omit needless words**; `readme` and `humanizer` adopt **curse of knowledge** (write for a reader who lacks your context).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.10.0...2.11.0

## 2.10.0 - 2026-06-16

<!-- verified-sha: 14ad8fccd9b04274e4450186e14835246fe12364 -->
### 2.10.0

The `pr-review-feedback` skill now treats a test as part of fixing a bug, not an afterthought. When review feedback flags a runtime fault or an edge case, the skill writes a failing test that reproduces it *before* applying the fix, then verifies at quality-check time that every fix is covered. Additive under conventions `schema-version 1` — no new convention slot, and pure style/refactor feedback still needs no test.

###### Changed

- **`pr-review-feedback` — a bug or edge-case fix now requires a test.** Phase 3 (Apply Changes) gained a step: when a comment flags a runtime fault (a wrong type, a bad boundary condition, a feature/permission edge, a regression), add a failing test that reproduces it before touching the fix, then make the change so the test passes. Phase 4 (Verify Quality) was reframed from "add a test" to "confirm every fix is covered" — it now verifies the regression/edge-case test exists and passes rather than merely suggesting one. The style/refactor carve-out is preserved: cosmetic feedback needs no new test, only that existing tests still pass.

###### Fixed

- **Corrected a stale `project-boost` slug to `project-boost-php`.** A guideline reference pointed at the old package slug; downstream readers following it would have hit the wrong name.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.9.0...2.10.0

## 2.9.0 - 2026-06-14

<!-- verified-sha: c54b86703b300d50caa6df796ac30b00a43add4b -->
An issue-resolution preflight for the `pull-requests` skill, so a PR is never opened without a tracker issue behind it unless the change is a deliberate chore. Surfaced while tightening a downstream application's issue workflow, where PRs were landing with no linked issue because nothing in the flow asked for one. Additive under conventions `schema-version 1` — a project whose branch patterns carry no `{issue_key}` placeholder sees no new step, and no new convention slot is introduced.

#### Added

- **`pull-requests` — issue-resolution preflight.** A new first preflight item runs only when the project's branch patterns include an `{issue_key}` placeholder (i.e. the project links PRs to a tracker). It resolves the issue *before* the branch is named, since the key feeds the branch name, the PR title, and the template's issue reference. The branch's existing key is reused when present; an issue known from the conversation is confirmed against the tracker; otherwise the user is asked — via a single `AskUserQuestion` — to name an existing issue, create one on the spot, or proceed as a chore against a no-`{issue_key}` branch pattern (e.g. `chore/{slug}`). A project whose patterns carry no `{issue_key}` placeholder skips the step entirely.
- **`pull-requests` — tracker-aware issue verification and creation.** A dedicated step splits the resolution path by key style so the right tool is used: a bare GitHub issue number goes through `gh issue view` / `gh issue create`, while a Jira-style key (`HPB-1234`) goes through the read-only `jira_get_issue` MCP tool to confirm and the `jira-create` skill to open one. `gh issue` is never run against a non-GitHub key, and `jira-updates` is explicitly excluded — it is a post-PR mutation flow, not a pre-PR lookup.

#### Changed

- **`pull-requests` — branch-rename and title guidance now issue-aware.** The branch-pattern preflight step folds the resolved issue key into the suggested rename when an `{issue_key}` pattern applies (e.g. `feature/1234-add-export`). The PR-title placeholder docs no longer assume a Jira-style key: `{issue_key}` resolves a Jira-style key (`HPB-1234`) or a bare GitHub issue number (`1234`) depending on the project's patterns. The empty-placeholder rule trims an adjacent dash or `#` and drops any brackets left wrapping nothing, so a chore PR title reads cleanly (`[#{issue_key}] {short_title}` → `Add export` when there is no issue).

The change was dogfooded through a downstream application's PR flow, then reviewed (including an external Codex pass) before shipping.

### What's Changed

* Add issue-resolution preflight to pull-requests skill by @SanderMuller in https://github.com/SanderMuller/boost-skills/pull/7

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.8.0...2.9.0

## 2.8.0 - 2026-06-14

<!-- verified-sha: 2e14e6e1ba4a0576c0a674a6baff63f1065468ca -->
Two refinements to the `php`/`github`-tagged skills, both surfaced while migrating a downstream application onto the `project-boost` family. The `backend-quality` test-runner substitution is now complete end-to-end, and a new opt-in `quality.rector` convention slot gives Rector a home in the completion and PR-preflight flows. Additive under conventions `schema-version 1` — a project that declares nothing sees no behavior change.

### Fixed

- **`backend-quality` — runner substitution now covers every command.** The configured test runner (`testing.backend_framework`) was previously substituted only in the intro prose; the Tier 1 / Tier 2 command blocks and the Quick Reference table hardcoded `vendor/bin/pest`. On a `phpunit`-configured project that pointed the agent at a binary that does not exist, and the intro's "if your runner is phpunit, run phpunit instead" disclaimer was a weak patch against the commands actually followed. Every command block and table cell now resolves the runner at sync time, and the full suite prefers the project's `composer test` script when one is defined.

### Added

- **`quality.rector` convention slot.** A new optional boolean. When `quality.rector: true`, `backend-quality`'s completion tier and the `pull-requests` preflight run `vendor/bin/rector process` to completion before Pint, then re-run Pint (Rector's output is not style-clean, so it always needs a Pint pass after). The slot is strictly opt-in — the step is never triggered by Rector merely being present in the dependency tree or by a stray `rector.php`, so adopting the catalog changes no existing project's flow. The ordering rule (Rector before Pint; always Pint after Rector) is encoded in both skills, and the PR preflight uses the same scoped `pint --dirty --format agent` invocation as `backend-quality`.

The changes were dogfooded through this repository's own evaluate → codex-review → release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.7.0...2.8.0

## 2.7.0 - 2026-06-14

<!-- verified-sha: a606626f0904810a32b97baecc3ad2ec7b1ecb08 -->
A code-brevity lens folded into the `evaluate` self-review loop and the `code-review` skill, inspired by the "lazy senior developer" pattern — stop at the first viable solution, and prefer the standard library, a native or framework feature, or an already-installed dependency over hand-rolled code. The family already pushed hard on correctness, style, and convention; this adds the missing pull toward writing less. It rides the existing review-and-fix loop rather than a standalone always-on guideline, so a project whose code is already lean sees no change.

### Added

- **`evaluate` — over-engineering review row + brevity floor.** Phase 2's review table gains an **Over-engineering** category: unrequested abstractions, speculative generality, premature flexibility, and hand-rolled code a stdlib/native/framework feature or installed dependency replaces — anything deletable without losing required behavior. A **"brevity has a floor"** guardrail sits directly under the table: shortening code is a win only when nothing required is lost, and validation at trust boundaries, error / data-loss handling, security, accessibility, explicitly-requested functionality, and tests for non-trivial logic are never traded away to shrink code. Findings flow through the existing Phase 4 fix loop like any other.
- **`code-review` — sharpened Code Quality bullet.** The soft "Unnecessary complexity" line becomes an **Over-engineering** lens carrying the same floor, so the structured fresh-eyes pass (run as `evaluate`'s Phase 6 and standalone) checks brevity independently of the self-review.

The lens was dogfooded through this repository's own evaluate → review → release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.6.0...2.7.0

## 2.6.0 - 2026-06-14

<!-- verified-sha: 3bf77bb93aab6f4d20d3fae8895e7673b09f1e22 -->
Three handoff-hardening guards for the `write-spec` → `implement-spec` pair, adapted from the `/improve` skill's plan/execute model. They tighten what happens when a spec is implemented later than it was written, when a load-bearing assumption turns out to be false mid-implementation, and when a test passes without actually exercising the change. All additive under conventions `schema-version 1` — no new slots, and a spec written before this release implements exactly as before.

### Added

- **`write-spec` / `implement-spec` — drift detection.** `write-spec` now stamps the commit a spec was planned against (`<!-- spec:planned-at <sha> <date> -->`) directly under the title, with a `+uncommitted` marker when the working tree was dirty and a refresh rule for Conversion Mode. `implement-spec` runs a drift preflight at the start of every invocation and resume — not just the first phase — using single-ref `git diff <sha>` so it catches both committed changes and the implementer's own uncommitted edits to cited files. On a material mismatch it stops and surfaces the stale `file:line` rather than building against moved line numbers; a missing stamp (older specs, non-git) simply skips the check.
- **`write-spec` / `implement-spec` — STOP conditions.** `write-spec` derives a `## STOP Conditions` section from the load-bearing subset of the assumptions ledger — an actionable view, not a competing record, so the ledger stays the single source of truth. `implement-spec` reads it when present (absent on pre-2.6 specs, which is not an error) and gains a documented-vs-undocumented deviation contract: a minimal deviation logged in `## Findings` with rationale is acceptable; an undocumented one is a failure, and a triggered STOP condition halts implementation.
- **`implement-spec` — test-assertion guard.** Because a single agent both writes a spec's tests and checks its own boxes, the skill now requires each test to assert the spec'd observable behaviour — a green test that exercises nothing is not coverage. Confirm the assertion would fail without the change before checking the Tests box.

The changes were dogfooded through this repository's own write-spec → implement-spec → review → release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.5.0...2.6.0

## 2.5.0 - 2026-06-09

<!-- verified-sha: 1decdb174eac0df5c4ab6e6dc85a107abe00af34 -->
A trio of skill refinements around the review-and-merge flow: self-review feedback now auto-applies, the feedback flow syncs the branch with its base before touching code, and conflict detection moved earlier so it can run without side effects. All additive under conventions `schema-version 1` — no new slots, and a project that never reviews its own PRs sees the same behavior as before.

### Added

- **`pr-review-feedback` — self-review comments auto-apply.** Thread authors now fall into three roles instead of two: **self** (the authenticated `gh api user` login), **bot**, and **colleague** (any other human). A thread is auto-handled when every comment in it is from a bot or from you, so the common loop — open your own PR, leave notes-to-self, then run the skill — now picks those notes up, evaluates them, and applies/replies/resolves automatically, exactly like bot feedback. Another human commenting anywhere in the thread still flips the whole thread to colleague and back behind the `colleague_gate`. Previously a self comment was treated as a colleague thread and gated.
- **`pr-review-feedback` — Phase 1b base-branch sync.** Before applying feedback, the skill now brings the PR's base branch in, so changes land on top of an up-to-date branch rather than one that has drifted. It checks for a clean working tree, probes for conflicts without side effects, and hands off to `resolve-conflicts` when the merge would conflict — with an old-Git fallback and a note that thread line numbers go stale after the merge (match by `diffHunk`, not `line`).
- **`resolve-conflicts` — Phase 0 side-effect-free conflict detection.** A new first phase finds out *whether* a merge will conflict and *which files* without touching the working tree: `git merge-tree --write-tree` locally (with the exit-code semantics spelled out — 0 clean, 1 split into conflict-vs-error by stdout, 128 for the `--quiet`+`--name-only` combo), or GitHub's GraphQL `mergeable` / `mergeStateStatus` when only a PR number is in hand (including the `UNKNOWN`-is-async caveat). This is what `pr-review-feedback`'s Phase 1b probe hands off to.

The refinements were sourced from real-world adoption feedback and dogfooded through this repository's own review and release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.4.0...2.5.0

## 2.4.0 - 2026-06-08

<!-- verified-sha: 28d2c1e6d3861ad1fdd9d3ea23dda3b51c490436 -->
Two new optional conventions slots and a batch of skill refinements drawn from real-world adoption. Everything here is **additive under conventions `schema-version 1`** — a consumer that declares neither new slot, and existing slot-aware skills, behave exactly as before.

### Added

- **`fixtures.anonymization` conventions slot** — an optional anonymization gate, consumed by the `evaluate` skill (and inherited by `final-verification-review`), that guards a publicly-shipped package against leaking proprietary product domain — real entity/class names, table/column names, route keys, domain jargon, copied comments — through code samples and fixtures. Declare a `guideline` pointer (the policy prose lives in your own always-on guideline, not the slot), a `scope` (default `['tests/', 'src/']` — `src/` ships in the dist archive, so its code samples are the worst leak surface), and an optional `forbidden_terms` denylist for a deterministic fast-path. Absent ⇒ no check, no behavior change. Mirrors the `translations` gate's knobs-in-slot / prose-in-guideline split.
- **`review` conventions slot** — optional PR review-feedback configuration for the `pr-review-feedback` skill: extra `bot_reviewers` logins (extends the built-in automated-reviewer set rather than replacing it) and a `colleague_gate` on/off toggle. With the gate on (default), a human colleague's review threads are never auto-acted on; turning it off opts a project into full automation. Absent ⇒ built-in defaults.
- **No-PR flow in `final-verification-review`** — the closeout skill is now flow-aware. Alongside the existing PR flow it supports projects that ship by committing directly to a target branch (optionally cutting a release): the branch and work-state checks adapt, the gates stay flow-agnostic, and the verdict points at the matching next step (a PR, or a commit and `pre-release`).

### Changed

- **`pull-requests`** — expanded the description guide with a per-change-type "how much to say" table and a plain-language / no-AI-mumbo-jumbo section (compound-noun stacks, metaphors, and diff-jargon are out), cross-referencing the `humanizer` skill. Before drafting a description the skill now asks the author for a direction — what the PR's headline is — batched with the risk question in a single prompt.
- **`pr-review-feedback`** — sharpened the bot-vs-colleague classification: a thread counts as a bot thread only when *every* comment in it is from a bot, so one human reply flips the whole thread to colleague (and a thread whose comments were truncated fails safe to colleague). Configurable via the new `review` slot.
- **`interview`** — rewritten from a structured-questionnaire flow into an adversarial grilling flow: read the codebase before asking, one question at a time with a recommended answer, sharpen fuzzy terms, stress-test rules with concrete edge cases, cross-reference stated behavior against the code, and a final assumptions-and-fuzziness audit so a spec can be signed off without an end-to-end read.
- **`write-spec`** — added a requirements-settled gate (bounce back to `interview` when the ask is still fuzzy, judged after loading issue context), a research-before-writing checklist, an Assumptions Audit with an `## Assumptions` ledger, and a light "spec already exists" conversion mode.
- **`jira-create` / `jira-updates`** — functional edge cases now become dedicated QA-testable blocks, sourced from the spec's `## Edge Cases` table or the PR's edge-case list; technical-only edges stay out of the issue tracker.
- **`evaluate`** — runs the new `fixtures.anonymization` check as part of its review phase when the slot is configured.

The skill refinements were sourced from upstream and production adoption feedback, then dogfooded through this repository's own closeout and release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.3.0...2.4.0

## 2.3.0 - 2026-06-05

<!-- verified-sha: 090b63eb8298be5226494488d6d99628d4e7d942 -->
### Added

- **`final-verification-review` skill** — a thin pre-PR closeout orchestrator for the moment work is done and a PR is next. It runs the full `evaluate` loop (including the Codex review per its dedup rules), then dry-runs the `pull-requests` preflight **check-only** — branch/base resolution with the rename/stop semantics mirrored from `pull-requests`, work state, the project's `pr.gates`, and title-format/template preconditions — and ends in a single **READY / NOT READY** verdict with the exact missing items. It never creates the PR; that stays `pull-requests`' job. Orchestrates without duplicating: code verification belongs to `evaluate`, gate definitions to `pull-requests`. Tagged `github`; reads the existing `branches.patterns`, `github.default_base_branch`, and `pr.gates` slots.

### Changed

- **`codex-review` hardened with a re-review loop.** A review is stale the moment a fix changes a file, so the skill now re-runs the review after applying fixes until a round comes back clean — with explicit stop rules (a clean round is final, a dismissals-only round is final, capped at 3 rounds) and scope-aware re-review semantics so committed-work reviews see the fix commits while working-tree reviews never sweep the user's uncommitted work into a commit. Also new: a sibling sweep (an accepted finding that reveals a bug class triggers a scan of the reviewed scope for other instances) and an engine-fidelity rule (retry the same engine on capacity/transient failures; never substitute another reviewer or fall back to self-review).
- **`evaluate` Phase 7 (Codex review) generalized.** The manual-invocation-only carve-out is gone: the external review now applies regardless of how evaluate was invoked, with a dedup-based skip that mirrors the `pull-requests` gate's `since_last_code_change` freshness window — any task file counts (code, docs, skills, config), not only code, so docs-only changes can no longer slip past a stale review. An unrunnable Codex review is surfaced in the report instead of silently skipped.
- **Capability-gated parallel-execution guidance** in `evaluate` and `final-verification-review`. Subagent support is now near-universal across the synced agents but with divergent semantics (barrier-style, explicit-request-only, serial delegation), and the Agent Skills spec defines no orchestration vocabulary — so both skills describe parallelism as portable prose intent: read-only fan-out only, fixes always serial in the main context, no nesting, the sequential order stays canonical, and a scripted workflow feature is an optional escalation rather than a dependency.

The closeout-loop patterns (re-review-until-clean, bug-class sweep, engine fidelity) were informed by studying the public [`openclaw/agent-skills`](https://github.com/openclaw/agent-skills) autoreview skill and validated through dogfooding on this repository's own release flow before shipping.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.2.0...2.3.0

## 2.2.0 - 2026-06-04

<!-- verified-sha: 90733eb11d838d8e3b0c8797d6590a06acc706b2 -->
Two optional conventions slots and a generalized `evaluate` skill. Everything here is **additive under conventions `schema-version 1`** — a consumer that declares neither slot, and existing slot-aware skills, behave exactly as before.

### Added

- **`pr.risk` conventions slot** — optional PR risk-tier routing for the `pull-requests` skill. Declare variable-length `tiers` (a `routing` discriminator — `reviewer_count` is implemented, with `codeowners_path` / `blast_radius` / `gate_skill` reserved for a future minor — plus `human_reviewers`, `require_codeowners`, `label`, free-form `extra` actions, and per-tier or slot-level `ai_reviewers`), with optional `matrix_doc` / `assessment_skill`. `pull-requests` renders and routes by your tiers when declared, and falls back to its generic Low/Medium/High question when absent. Orthogonal to `pr.gates` — a gate-only project is never pushed into a tier.
- **`translations` conventions slot** — optional DB-driven translation-key validation, consumed by a new conditional check in the `evaluate` skill. Declare a per-consumer `key_pattern` plus `file_based_prefixes` (`framework_groups` + `vendor_namespace_exempt`) and an optional `rules_doc`. Scoped to database-stored keys that bypass the framework's own file-based validation; absent ⇒ no check.

### Changed

- **`evaluate` skill hardened** with two general-purpose phases, so projects no longer need to shadow it to get them: **evaluation-scope resolution** (resolve the change set once; never fall back to the whole-branch diff) and an **Audit Code Comments** phase (a Remove / Replace / Trim / Keep ladder with tooling-annotation exemptions). The Security review row now also covers auth checks, XSS, and SQL injection alongside the existing checks.
- **README** documents the two new slots and corrects the `boost-core` requirement to the current `^0.20 || ^0.21 || ^0.22 || ^0.23 || ^1.0`.

Validated against real-world adoption (a production app with DB-driven translations and ISO-27001 PR routing) before release: declaring the slots replaces ~200 lines of duplicated host prose with single-source declarative data, with no change for consumers that don't adopt them.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.1.0...2.2.0

## 2.1.0 - 2026-06-04

<!-- verified-sha: d402d36bbaa23b660420c478441a147d969ee047 -->
Adds support for `boost-core 0.23` and the `1.x` line, raises the minimum engine to `^0.20`, and ships a new signed-commits guideline. See [UPGRADING.md](https://github.com/SanderMuller/boost-skills/blob/main/UPGRADING.md) for the one migration step.

### Breaking

- **Requires `boost-core ^0.20`.** The accepted range is now `^0.20 || ^0.21 || ^0.22 || ^0.23 || ^1.0`, dropping `0.16`–`0.19`. This is a support-policy cutoff, not a hard requirement of the shipped skills (they still resolve correctly on `0.16`) — it aligns `boost-skills` with the config API `boost-core` froze for `1.0`: `->withTags(...)` takes a single array as of `boost-core 0.20.0` (it was variadic through `0.19`). If you were already on `boost-core 0.20+`, the only effective change is the added `0.23` / `1.x` support. Consumers on `0.16`–`0.19` should move to `0.20+` and update their `boost.php` `->withTags(...)` call to the array form — see UPGRADING.md.

### Added

- **`boost-core 0.23` and `1.x` support.** `^0.23` and `^1.0` join the require range, so consumers can adopt the upcoming `0.23` engine and the `1.0` line without `boost-skills` capping them.
- **`signed-commits` guideline.** When a repository has commit signing enabled, never fall back to an unsigned commit if the signing agent (1Password, `gpg-agent`, etc.) is unavailable — stop and surface the failure instead of bypassing it with `--no-gpg-sign`. Self-gating: inert for repositories without signing configured, so it never blocks workflows that don't sign.

### Changed

- **Config and README examples use the array `->withTags([...])` form** to match the `boost-core 0.20+` builder signature.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.6...2.1.0

## 2.0.6 - 2026-06-03

<!-- verified-sha: f7c102e232a44d998f30aaf228fb1615497c2482 -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.22` alongside `0.16`–`0.21`, so consumers can adopt the upcoming engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19 || ^0.20 || ^0.21 || ^0.22`.** Forward-compat for the upcoming `boost-core 0.22` release, which freezes the conventions-token and tag/sidecar contracts `boost-skills` depends on as semver-protected public format/behavior. Under Composer's 0.x caret rules each minor is opt-in, so the previous ceiling would have excluded the `0.22` root — this keeps consumers running both packages able to adopt the new engine minor without `boost-skills` capping them. `^0.16` remains the token-resolution floor.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.5...2.0.6

## 2.0.5 - 2026-06-03

<!-- verified-sha: c461dfaac3f6a000898b0dbb8c6aea1450b0144b -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.21` alongside `0.16`–`0.20`, so consumers can adopt the upcoming engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19 || ^0.20 || ^0.21`.** Forward-compat for the upcoming `boost-core 0.21` release. Under Composer's 0.x caret rules each minor is opt-in, so the previous ceiling would have excluded the `0.21` root — this keeps consumers running both packages able to adopt the new engine minor without `boost-skills` capping them. `boost-core 0.21` carries a pre-1.0 breaking change (`FileEmitter::emit()` returns `iterable<EmittedFile>`); `boost-skills` ships skills and guidelines with no `FileEmitter` implementation, so that change is a no-op here. `^0.16` remains the token-resolution floor.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.4...2.0.5

## 2.0.4 - 2026-06-03

<!-- verified-sha: a5edfb580f8ace3fd726a1b335200be3e6fb28ea -->
Maintenance patch. `boost-skills` adopts `boost-core`'s `.config/boost.php` config location for its own dev tooling and widens the engine constraint to accept `boost-core 0.20`. No skill behavior changed.

### Changed

- **Moved `boost.php` to `.config/boost.php`.** `boost-core 0.17+` resolves the engine config from either the project root or `.config/`; this repo adopts the tidier `.config/` location for its own dev setup. The file is dev-only (`export-ignore`d), so consumers — who supply their own boost config — are unaffected. The dev-tooling floor is `boost-core 0.18` here (via `package-boost-php`), which always carries the `.config/` resolver.
- **Bumped the `package-boost-php` dev dependency to `^0.17`.** Pulls `boost-core ^0.18 || ^0.19` into the dev tree.
- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19 || ^0.20`.** Forward-compat for the upcoming `boost-core 0.20` release. Under Composer's 0.x caret rules each minor is opt-in, so the previous ceiling would have excluded the `0.20` root — this keeps consumers running both packages able to adopt the new engine minor without `boost-skills` capping them. `^0.16` remains the token-resolution floor.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.3...2.0.4

## 2.0.3 - 2026-06-02

<!-- verified-sha: 58559d8c438a3076d6d4de66051f509dc38824a2 -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.19` alongside `0.16`, `0.17`, and `0.18`, so consumers can adopt the new engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19`.** `boost-core 0.19.0` is additive and changes nothing `boost-skills` uses (the conventions-inlining engine is unchanged since `0.16`). But under Composer's 0.x caret rules each minor is opt-in, so the previous `^0.16 || ^0.17 || ^0.18` ceiling excluded the `0.19` root — capping any consumer running both packages at `boost-core <0.19`. `^0.16` remains the token-resolution floor (the `mcp.jira` sub-key token still needs the `0.16.0` resolver); `0.19` is simply now accepted.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.2...2.0.3

## 2.0.2 - 2026-06-02

<!-- verified-sha: 32f4fa76f22f2d022c7d5eab76f28890c6d7962f -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.18` alongside `0.16` and `0.17`, so consumers can adopt the new engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18`.** `boost-core 0.18.0` is additive and changes nothing `boost-skills` uses (the conventions-inlining engine is unchanged since `0.16`). But under Composer's 0.x caret rules each minor is opt-in, so the previous `^0.16 || ^0.17` ceiling excluded the `0.18` root — capping any consumer running both packages at `boost-core <0.18`. `^0.16` remains the token-resolution floor (the `mcp.jira` sub-key token still needs the `0.16.0` resolver); `0.18` is simply now accepted.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.1...2.0.2

## 2.0.1 - 2026-06-01

<!-- verified-sha: 7b624d9692f5f816af90baba0e312ad2414b98ff -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.17` alongside `0.16`, so consumers can adopt the new engine release without a `boost-skills` upgrade getting in the way. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17`.** `boost-core 0.17.0` is additive — it adds `.config/boost.php` support and is fully back-compatible — and changes nothing `boost-skills` uses (the conventions-inlining engine is unchanged since `0.16`). But under Composer's 0.x caret rules a bare `^0.16` resolves to `>=0.16 <0.17`, which excluded `0.17`. That capped any consumer running both packages at `boost-core <0.17`. `^0.16` remains the token-resolution floor (the `mcp.jira` sub-key token still needs the `0.16.0` resolver); `0.17` is simply now accepted.

### Docs

- Documented two `2.0` upgrade gotchas in `UPGRADING.md`: a host `.blade.php` guideline silently dropped during sync, and a host shadow keeping its convention block. Both surfaced from real-world adoption of the `2.0` token-inlining migration.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.0...2.0.1

## 2.0.0 - 2026-05-31

<!-- verified-sha: e18578c6a76df8005ed2edae28e33085d424c018 -->
Slot-aware skills now resolve their project-convention values **into the skill body at sync time** via `boost-core`'s conventions-inlining tokens (shipped in `0.15.0`), instead of reading the always-loaded `## Project Conventions` block at agent runtime. Once a consumer's synced catalog is fully token-sourced, that block drops entirely — the values are baked into each skill. Adopting needs `boost-core ^0.16`.

### Breaking

- **Requires `boost-core ^0.16` (hard floor).** The 10 slot-aware skills (`jira-create` / `jira-rework` / `jira-updates`, `pull-requests`, `codex-review`, `write-spec`, `interview`, `bug-fixing`, `backend-quality`, `test-writing`) now contain `<!--boost:conv-->` tokens. The inliner ships in `0.15.0`, but the three Jira skills use an `mcp.jira` open-vocab sub-key token that only the `0.16.0` resolver handles — on `0.15` it emits raw, losing the value. On any engine below `0.16` at least one token emits raw into the skill body, so `^0.16` is enforced as a composer `require` constraint, not just documentation. This also makes the slot-aware skills `sandermuller/boost-core`-specific — they don't resolve under `laravel/boost` (no inliner). Adopt a family-package release that floats `boost-core` to include `^0.16` (e.g. `package-boost-php ^0.16.1`). See [UPGRADING.md](UPGRADING.md).

### Changed

- **All slot-aware skills migrated from runtime `$.slot` references to render-time tokens.** Each skill's `## Project Conventions slots` documentation table is removed (obsolete once values inline); the slot dependency is now in the tokens + the schema. Agent behavior is unchanged — skills dispatch identically; the value is inlined instead of read from the block.
- **The three Jira skills inline `mcp.jira` as a clean scalar token** (`<!--boost:conv path="mcp.jira" mode="inline" fallback="mcp-atlassian"-->`), resolving the MCP server-namespace segment directly — declared `mcp.jira` → schema-default `mcp-atlassian` → fallback. (`pull-requests` still renders the whole `mcp` map as YAML for its gate tools.)
- **`conventions-schema.json` gains `render` mode pins** on the structured / list slots (`branches.patterns`, `pr.gates`, `mcp` → `yaml`; `testing.forbid`, `spec.research_docs` → `inline`/`bullets`) as drift guards so a slot always renders in a consistent mode.

### How it works

- **Scalar slots** (`github.default_base_branch`, `codex.invocation_mode`, `jira.project_key`, …) inline their value directly into the prose.
- **Structured slots** (`branches.patterns`, `pr.gates`) render as YAML data the skill's algorithm prose then operates on at agent runtime — the value is inlined, the logic stays in the skill.
- **Unset slots** render a written fallback (a sensible default or a detection instruction), so a skill reads correctly whether or not the convention is declared.
- `boost where --conventions` shows each slot's effective resolved value (declared / schema-default / fallback).

### Upgrading

```bash
composer require --dev "sandermuller/boost-skills:^2.0"
# via a family package that floats boost-core to include ^0.16 (e.g. package-boost-php ^0.16.1)
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel





































```
No `boost.php` or slot-vocabulary changes — same `->withConventions([...])`, same schema v1. The `## Project Conventions` block in `CLAUDE.md` disappears once your full synced skill set is token-sourced (the engine keeps it until everything converges, so partial states are safe). See [UPGRADING.md](UPGRADING.md) for the full 1.9.x → 2.0 path.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.9...2.0.0

## 1.9.9 - 2026-05-31

<!-- verified-sha: 11649674a94d98b5f389f24e2e1ee8746efac0f5 -->
### Changed

- **Consumer-facing `boost-core` floor `^0.13` → `^0.13 || ^0.14`** (README + UPGRADING). `package-boost-php 0.15.1` widened its `boost-core` constraint to `^0.13 || ^0.14` (absorbing `0.14.0`'s project-scope reconcile-on-sync), so a fresh family install now resolves `boost-core 0.14.0` — outside the `^0.13` floor `1.9.8` stated (`^0.13` = `>=0.13 <0.14`). The floor now matches the family range, with `0.14.0` added to the notable-versions list (dropped-emitter orphan reaping, sha-gated so operator edits are preserved).
  
  boost-skills has no direct `boost-core` require — the family package pins the engine — so this is prose-floor accuracy, not a composer-constraint change. (boost-core is pre-`v1`; expect the floor to track each engine minor until the public API settles.)
  

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.9"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel






































```
No schema, slot, or skill-body changes — floor-tracking only.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.8...1.9.9

## 1.9.8 - 2026-05-31

<!-- verified-sha: d089455c180515a0eee643abd330dc889cf8641a -->
### Changed

- **Consumer-facing `boost-core` floor `^0.11` → `^0.13`** (README + UPGRADING). The `^0.11` floor (set in 1.9.5) had gone stale + disjoint from the family: the current family packages narrow `boost-core` to `^0.13`, so a consumer reading "Requires `^0.11`" while installing a current family package (which pulls `^0.13`) got contradictory guidance — `^0.11` and `^0.13` are non-overlapping ranges. The floor now matches the family line and lists the notable engine versions folded into it:
  
  - `0.9.0` — conventions-source-flip (values move to `boost.php`)
  - `0.9.3` — render-fail-then-write data-loss patch
  - `0.10.0` — cross-agent capability-loss fix + `boost doctor` entry-point banner
  - `0.11.0` — `BoostWrapperContract` (bare-CLI sync stops false-positive-deleting wrapper-injected files)
  - `0.12.0` — **markerless guidance files**: `CLAUDE.md` / `AGENTS.md` become wholesale boost-owned; operator content moves to `.ai/guidelines/`
  
  boost-skills has no direct `boost-core` require (it's a markdown catalog — the family package pins the engine), so this is prose-floor accuracy, not a composer-constraint change.
  

### Internal

- `require-dev` `package-boost-php` `^0.13` → `^0.15` (dev-env dogfood; pulls `boost-core 0.13.0`). The catalog now dev-syncs under the markerless guidance model — verified safe: boost-skills' own `CLAUDE.md` is fully vendor-generated (zero hand-authored content), so wholesale-ownership regenerates it losslessly.
- `.gitignore` managed block adds `.boost/` (the `0.13` sync-manifest dir).

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.8"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel







































```
No schema, slot, or skill-body changes — floor-tracking + dev-env only. If you hand-edited content into a generated `CLAUDE.md` / `AGENTS.md`, move it to `.ai/guidelines/` before adopting `boost-core 0.12+` (markerless makes those files wholesale boost-owned); see `boost-core`'s 0.12.0 notes.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.7...1.9.8

## 1.9.7 - 2026-05-31

<!-- verified-sha: 29b5d544c3514a6d69d9f78dd3da3356c91b8ff6 -->
### Changed

- **`test-writing` + `bug-fixing` — `testing.forbid` category-alias expansions rendered inline.** Both skills previously deferred to "see the schema description for alias expansions", but the schema description isn't loaded into the agent's context — so an agent had to know from general knowledge that `js-test-frameworks` includes `cypress`. Now the full expansion is inline in both skills:
  
  | Alias | Expands to |
  |---|---|
  | `js-test-frameworks` | vitest, jest, mocha, cypress, playwright |
  | `browser-test-frameworks` | cypress, playwright |
  | `php-browser-tests` | dusk, panther |
  
  A `forbid: ['js-test-frameworks']` now visibly refuses a Cypress test without the agent needing outside knowledge. Surfaced by runtime-dispatch verification against a proving consumer — an agent resolved the alias membership via general knowledge, which a stricter agent could have missed.
  

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.7"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel








































```
No schema or convention changes — the alias map is unchanged (this renders the existing schema map into agent context).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.6...1.9.7

## 1.9.6 - 2026-05-30

<!-- verified-sha: 8278606eaf76c6095ec401a5e1ce03978c258867 -->
### Changed

- **`require-dev` `sandermuller/package-boost-php` `^0.12` → `^0.13`.** package-boost-php 0.13.0 widens its `boost-core` constraint to `^0.10 || ^0.11`. boost-skills' dev environment was pinned `^0.12`, capping the transitive `boost-core` at `^0.10` — inconsistent with the `^0.11` consumer floor that `1.9.5` documents. The bump lets the dev environment resolve `boost-core 0.11.0`, so the catalog now dev-tests against the same floor it tells consumers to use. Dev-only constraint; consumers unaffected.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.5...1.9.6

## 1.9.5 - 2026-05-30

<!-- verified-sha: 07a17e546df12bc29c4559c5a5261aed42b4e423 -->
A dispatch-prose audit across all six under-dogfooded conventions-schema slot groups (`pr.gates`, `codex.invocation_mode`, `testing.forbid`, `spec.filename_pattern`, `mcp.*`, `branches.patterns`) — the slots no real consumer exercises yet, where a vendor-skill prose bug would surface only when someone first adopts them. Caught six real prose/schema gaps that schema validation can't (validation checks input shape, not vendor dispatch prose). Plus a `boost-core ^0.11` floor-bump.

### Changed

- **`pull-requests` (`pr.gates`)** — gate-ordering flow-control clarified (only `stop_and_request` halts; `warn` / `skip` continue to the next gate); `shell_command` failure modes enumerated (exit-127 / crash / timeout / Bash-tool error); `mcp_tool` success + failure shapes defined; default-value annotations added to the YAML examples.
- **`codex-review` (`codex.invocation_mode`)** — auth-failure / `$.codex.setup_doc` / `pr.gates` interaction concerns moved from plugin-nested subsections into a shared "Cross-cutting concerns" section so both invocation modes get parity. Base-branch resolution prose restated inline (first-match-wins) so the skill is self-sufficient without `pull-requests` loaded.
- **`test-writing` (`testing.forbid`)** — now slot-aware: reads `$.testing.backend_framework` (write tests for that runner) + `$.testing.forbid` (never write in forbidden frameworks). Adds `metadata.schema-required: ^1` + a Project Conventions slots table.
- **`jira-updates` (`mcp.*`)** — "Available Tools" header no longer hardcodes the `mcp-atlassian` server name; resolves via `$.mcp.jira` so custom MCP server-name segments work.
- **`conventions-schema.json`** — `spec.filename_pattern` gains its missing `"default": "specs/{slug}.md"` (sibling slots all carry schema defaults; `write-spec` asserted this default the schema didn't back). `branches.patterns` description broadened to name all consumers (base resolution by `pull-requests` + `codex-review`; the `pattern` field's reuse by `write-spec` for `{issue_key}` detection).

### Requires

- **`sandermuller/boost-core ^0.11`** (was `^0.10`). `0.11.0` adds the `BoostWrapperContract` so bare-CLI `boost sync` no longer false-positive-flags wrapper-injected files for deletion — the correctness half of the wrong-entry-point bug class (`0.10.0` closed the discoverability half with the `boost doctor` entry-point banner). `0.10.x` + `0.9.x` improvements ride in transitively.

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.5" "sandermuller/boost-core:^0.11"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel










































```
No `boost.php` or convention changes. The slot-vocabulary is unchanged — these are prose/schema-default refinements, not new slots.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.4...1.9.5

## 1.9.4 - 2026-05-29

<!-- verified-sha: 429039c4b99fae4b9e1672bb0a50675da83935d4 -->
Closes a tag-bucketing inconsistency where the `pre-release` skill was the odd-one-out in the release-tooling cluster (`pre-release` tagged `php github` while siblings `readme` / `release-notes` / `upgrading` are all tagged `release-automation`). Surfaced by a downstream consumer who reasonably declared `withTags(Php, Github)` for an application repo and ended up needing to explicitly exclude `pre-release` since the app doesn't do release work.

### Changed

- **`pre-release` skill re-tagged: `php github` → `php github release-automation`.** Subset-AND match — all three tags required for the skill to sync. Preserves PHP+GitHub scoping (the skill references Rector/Pint/Pest/PHPStan + `gh release create`) while adding the opt-in gate to align with sibling release-tooling skills.

### Behavior change for current consumers

- **Package authors with `release-automation` declared** (standard family pattern, gets you readme/release-notes/upgrading siblings): no change — `pre-release` still syncs.
- **PHP+GitHub package authors WITHOUT `release-automation` declared**: lose `pre-release`. Likely correct — if not doing release work, the skill doesn't apply.
- **PHP+GitHub app authors with just `Php` + `Github`** (the surfaced case): correctly stop receiving `pre-release`. If you previously had an explicit `withExcludedSkills(['pre-release'])` to silence it, you can drop that line.

If you want `pre-release` back, add `release-automation` to your `withTags(...)`.

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.4"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel











































```
**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.3...1.9.4

## 1.9.3 - 2026-05-29

<!-- verified-sha: de550633851f5cc0576c9b54ed9c28ea9a68a954 -->
### Changed

- **`require-dev` `sandermuller/package-boost-php` `^0.10` → `^0.12`.** Tracks the family-package's `0.11 → 0.12` floor-bump (which itself floored `boost-core` to `^0.10`, aligned with what `boost-skills 1.9.2` already requires). Dev-only constraint — keeps the catalog's own dev environment current with the family. Consumers unaffected (the require-dev constraint doesn't propagate downstream).

### Internal

- `.gitignore` managed-region catches up to current engine output: drops `.github/copilot-instructions.md`, `.github/skills/`, `AGENTS.md`, `CLAUDE.md`. Per the boost-core 0.9.0+ / 0.9.6+ path-ownership contract, those paths are either retired emitters or tracked audit copies.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.2...1.9.3

## 1.9.2 - 2026-05-29

<!-- verified-sha: a83b3548a397e32944d9f8963bf215ba09c0e4c0 -->
Floor-bumps the engine to `boost-core ^0.10` for the cross-agent capability-symmetry fix that landed in `0.10.0`. Laravel projects wiring the bare-CLI hook (`BoostAutoSync::run` in `composer.json` scripts) previously lost bundled `pest-testing` / `livewire-development` / `filament-development` / Inertia / Flux / Volt / Tailwind / Wayfinder / `laravel-best-practices` skills to Cursor / Copilot / Codex — the gap was masked locally by laravel/boost's MCP server for Claude Code only.

### Changed

- **`boost-core` floor `^0.9.3` → `^0.10`** (README + UPGRADING). Load-bearing per `0.10.0`'s entry-point-mismatch banner + the three-case `boost tags` diagnostic split. Earlier `0.9.3` data-loss patch + `0.9.4` diagnostic visibility ride along transitively.
- **UPGRADING.md section renamed** "From 1.7.x to 1.8.0" → "From 1.7.x to 1.9.x (current)". Walkthrough lede, composer-require example, and commit-message exemplar updated to current-floor coherence. Earlier `1.8.0` mis-tag is called out inline — pin `^1.8.1` or `^1.9.0+`, never bare `^1.8`.
- **`release-notes` skill body** (consumer-facing for agents drafting release bodies):
  - Flat top-level section structure (`## Added` / `## Changed` / `## Fixed` / `## Internal`; no `## What's changed` umbrella).
  - "No marketing-tone / audit-narration / framework-fold-in intro paragraphs" rule replaces the old absolute "no opening paragraph" rule; short value-add intros explaining a non-obvious bug class or upgrade-decision context are explicitly allowed.
  - Expanded What-to-omit list: leading version heading, `## Validation` / quality-gate counts, `## Acknowledgments` / pattern-tracking, dogfooding narrative, process choreography, peer-handle credits, "unchanged from prior" segments.
  - Worked good-shape example with section order matching the prescribed structure.
  

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.2" "sandermuller/boost-core:^0.10"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel projects













































```
Per `0.10.0`'s entry-point-mismatch banner: Laravel projects currently wired to the bare-CLI hook in `composer.json` scripts should swap to `@php artisan project-boost:sync` to close the cross-agent symmetry gap. `boost doctor` flags the mismatch automatically once `boost-core 0.10` is installed alongside `project-boost-laravel`.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.1...1.9.2

## 1.9.1 - 2026-05-29

### Changed

- **`autoresearch` skill — Laravel deep-dive subsection absorbed.** Vendor body grew from 286 → 488 lines with a new "Laravel projects — deep-dive variations" section layered on top of the generic flow. Activated for Laravel route/job/Eloquent code paths; skipped for pure-PHP, raw PDO, or CPU-bound targets per an activation-rubric table at the top of the section. The deep-dive covers:
  
  - Two metrics (`query_count` + `execution_median_ms`) instead of one — query count is often the dominant signal for database-heavy work.
  - Transactional benchmark template using the application kernel + Eloquent + factories + `DB::beginTransaction()` / `rollBack()` + `cache()->flush()` / `Once::flush()` between iterations.
  - Optional `sandermuller/stopwatch` profiling helper with explicit fallback to manual `hrtime(true)` checkpoints.
  - Two bottleneck taxonomies — query-count (eager loading, relation reuse, bulk inserts, audit suppression, touch suppression, deferred execution, duplicate elimination) and execution-time (validation overhead, double processing, object creation, event overhead, transaction batching, serialization).
  - Two-metric decision logic: `improved = queries < prev_queries OR execution_ms < prev_ms * 0.98`.
  - Laravel-specific constraints (`migrate:fresh` ban, factories not raw SQL, transaction rollback, `Once::flush()` between iterations, no test modification, preserve API contracts, never weaken security).
  
  Two strong-directive inline pointers in the generic body (Step 2 baseline + Phase 6 decide) route Laravel readers into the deep-dive with explicit consequence framing — "Skipping the deep-dive and drafting a generic benchmark for a Laravel target will leave you optimizing the wrong metric." Generic flow stays intact for non-Laravel consumers; pure-PHP / raw-PDO / different-ORM consumers can skip the deep-dive entirely per the activation rubric.
  
  Consumers maintaining a local `autoresearch` shadow with Laravel-specific content can drop the shadow on `1.9.1` adoption.
  
- **`ai-guidelines` skill — Laravel-substitute note.** Single inline note after the first `vendor/bin/boost sync` reference: Laravel projects with `sandermuller/project-boost-laravel` installed should substitute `php artisan project-boost:sync` for `vendor/bin/boost sync` throughout the skill. The bare `vendor/bin/boost sync` currently errors on `Container::path()` in Laravel projects until a wrapper-side or engine-side fix lands; the note closes the consumer-side friction without polluting the canonical skill with wrapper-specific commands at every reference.
  
- **`README.md` — Requires-line polish + floor-pin discipline cross-link.** Reference to "boost-skills 1.8.0" updated to "boost-skills 1.8.1+" (the `1.8.0` tag was mis-tagged and ships `1.7.2` content). Added a brief sentence on the load-bearing-only floor-pin discipline: polish-tier improvements in subsequent `0.9.x` releases (e.g. `0.9.4` diagnostic-visibility UX) ride along via the range constraint without forcing the floor higher.
  

### Adoption path

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9.1"
vendor/bin/boost sync
vendor/bin/boost validate














































```
Or in Laravel projects with `project-boost-laravel`:

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9.1"
php artisan project-boost:sync
vendor/bin/boost validate














































```
No migration step from `1.9.0`. Drop-in replacement.

### Acknowledgments

`1.9.1` ships absorption-pattern data point #2 (codex-review absorption in `1.8.0-rc1` was #1; `autoresearch` absorption is #2). The shape — universal-content-moves-into-catalog, with the absorbed content scoped via an activation-rubric — continues to earn its place. Real-world adoption signal: a proving consumer maintained a local shadow with substantive content that generalized cleanly to other consumers in the same framework class; absorbing it into the catalog drops the shadow and broadens the value.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.0...1.9.1

## 1.9.0 - 2026-05-29

### Changed

- **`pre-release` skill — "user cuts the tag" rule split into two clauses.** Agent must NOT execute `git tag` / `gh release create` / `git push --tags` (preserved). Agent MUST present the explicit `gh release create` command shape in the handoff (new requirement). Prose target-naming is the default-resolution trap; explicit-arg-shape removes it.
  
- **`pre-release` skill — new "Canonical handoff command shape" subsection** between step 7 and step 8. Specifies the required handoff format:
  
  ```bash
  gh release create <TAG> \
      --target <BRANCH> \
      --title "v<VERSION>" \
      -F internal/release-notes-<VERSION>.md
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  ```
  The `--target <BRANCH>` flag is always explicit, even when `main`. The branch named there MUST match the branch containing the verified-sha commit in the notes file.
  
- **`pre-release` skill — "ready to tag" reporting** now references the canonical handoff format instead of stopping at prose-level "ready" framing.
  

### Generalized principle

The discipline generalizes beyond `gh release create`: any agent→user handoff involving a CLI command with default-resolution paths must surface the relevant flag explicit, not rely on prose accuracy. Examples covered by the same principle: `git push` (default remote), `composer require` with version constraint (default stability resolution), `npm` / `yarn` / `pnpm` (default registry resolution). The skill subsection documents the broader pattern.

### Adoption path

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9"
vendor/bin/boost sync
vendor/bin/boost validate















































```
No migration step from `1.8.1`. Drop-in replacement; the new discipline applies to agents invoking the `pre-release` skill from this version forward.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.8.1...1.9.0

## 1.8.1 - 2026-05-28

**`1.8.1` supersedes `1.8.0`.** The `1.8.0` tag was cut at `main` HEAD (the post-`1.7.2` CHANGELOG-update commit) instead of the prep branch HEAD that carried the `1.8.0` catalog work — so the `1.8.0` tarball ships `1.7.2` content under a `1.8.0` version label. `1.8.1` is `1.8.0`'s intended content, tagged at the correct SHA. **Consumers should pin to `^1.8.1` rather than `^1.8` to skip the broken `1.8.0`.**

### Requires

- `sandermuller/boost-core ^0.9.3` — ships the `->withConventions([...])` builder method, the render-from-boost.php path, the `boost convert-conventions` migration command, the fail-closed both-sources-non-empty reconcile contract, AND the render-fail-then-write data-loss patch from `0.9.3`. The `^0.9.3` floor is defensive: a validation failure between the schema-read and the CLAUDE.md-write on `boost sync` could blank out the rendered block under the `0.9.0` / `0.9.1` / `0.9.2` engines. Polish-tier improvements in subsequent `0.9.x` releases (`0.9.4` diagnostic-visibility UX) ride along via the range constraint without forcing the floor higher.

### Catalog content (all carried over from the intended `1.8.0` cut)

The bulk of the content shipped under `1.8.0-rc1` (rc-cycle, real catalog content). The `1.8.0` stable tag was supposed to ship `1.8.0-rc1` content + the floor-bump; the mis-tag meant `1.8.0` shipped neither. `1.8.1` ships both. See [`1.8.0-rc1`'s release notes](https://github.com/SanderMuller/boost-skills/releases/tag/1.8.0-rc1) for the full per-item detail; summary below.

- **Operator-edit surface flips** — `CLAUDE.md` (YAML block) → `boost.php` (`->withConventions([...])` array). Slot vocabulary, agent-read behavior, schema-versioning contract, and validation semantics unchanged from `1.7.x`.
- **Skill prose update across 9 slot-aware skills** — opening "Project Conventions slots" tables and missing-slot UX prose describe the edit surface as "`boost.php` via `->withConventions([...])`". Skills updated: `jira-create`, `jira-rework`, `jira-updates`, `pull-requests`, `codex-review`, `bug-fixing`, `write-spec`, `interview`, `backend-quality`.
- **`pull-requests` skill body** — last explicit "declare `$.pr.gates` in their CLAUDE.md" reference rewritten to point at `boost.php`'s `->withConventions([...])` array.
- **`ai-guidelines` skill table** — AGENTS.md producer list reflects `boost-core 0.9.0`'s `CopilotTarget` joining the AGENTS.md shared-pool: "Codex / Copilot / Cursor / Amp / Junie / Kiro / OpenCode / etc.".
- **README "Project Conventions schema" section** — `->withConventions([...])` PHP-array example in `boost.php` replaces the marker-bounded YAML-in-CLAUDE.md example. Tooling table includes `boost convert-conventions`. `Migrating from 1.7.x` subsection.
- **`UPGRADING.md`** — canonical migration recipe for `1.7.x` → `1.8.x` consumers.
- **`codex-review` skill absorbs the `codex-plugin-cc` invocation playbook** — vendor skill self-contained for plugin mode: plugin install, Codex CLI install, companion script path resolution, four invocation patterns, polling loop with stale-result trap, result retrieval, auth failure mode, `pr.gates on_missing` interaction. Skill body 220 lines (was 155 pre-rc1).
- **`$.codex.setup_doc` slot description narrowed** — now: "Optional path to a project-owned doc with project-specific codex overrides only [...]. Most consumers leave this slot unset." Backward compatible.
- **Codex invocation patterns reference `$.github.default_base_branch`** — base resolution is slot-driven, not hardcoded.
- **`ai-guidelines` generated-files table** — `.github/copilot-instructions.md` row dropped in `1.7.2`; carried through `1.8.x`.
- **Floor-bump to `boost-core ^0.9.3`** — defensive floor, data-loss-patch rationale documented in `README.md` "Requires" line + `UPGRADING.md` "Required" section + `UPGRADING.md` adoption commit shape.

### Schema design notes

No schema vocabulary changes from `1.7.x`. `conventions-schema.json` v1 remains the contract. `$.codex.setup_doc` description narrowed per the codex-review absorption (no breaking change).

### Validation

- 27/27 skills + 1/1 guideline manifest valid.
- `opis/json-schema ^2.4` schema validation contract unchanged from `1.7.0` (operates on parsed values, format-agnostic for PHP-array vs YAML source).

### Adoption path

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.8.1" \
  "sandermuller/boost-core:^0.9.3"

# 1.7.x consumers only — migrate the edit surface
vendor/bin/boost convert-conventions

vendor/bin/boost sync
vendor/bin/boost validate
















































```
The `^1.8.1` floor (rather than `^1.8`) skips the broken `1.8.0` tag. See [`UPGRADING.md`](UPGRADING.md) for the full `1.7.x` → `1.8.x` migration recipe.

### What's Changed

* 1.8.0 stable prep: floor-bump to boost-core ^0.9.3 (CI trigger) by @SanderMuller in https://github.com/SanderMuller/boost-skills/pull/5

### New Contributors

* @SanderMuller made their first contribution in https://github.com/SanderMuller/boost-skills/pull/5

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.8.0...1.8.1

## 1.8.0 - 2026-05-28

### Requires

- `sandermuller/boost-core ^0.9.3` — ships the `->withConventions([...])` builder method, the render-from-boost.php path, the `boost convert-conventions` migration command, the fail-closed both-sources-non-empty reconcile contract, AND the render-fail-then-write data-loss patch from `0.9.3`. The `^0.9.3` floor (rather than `^0.9.0`) is defensive: a validation failure between the schema-read and the CLAUDE.md-write on `boost sync` could blank out the rendered block under the `0.9.0` / `0.9.1` / `0.9.2` engines. `^0.9.3` ensures every consumer adopting `1.8.0` gets the patch by default. Polish-tier improvements in subsequent `0.9.x` releases (`0.9.4` diagnostic-visibility UX) ride along via the range constraint without forcing the floor higher.

### Changed since `1.8.0-rc1`

- **Floor-bump** — `README.md` "Requires" line + `UPGRADING.md` "Required" section + `UPGRADING.md` adoption commit shape all carry `^0.9.3` with the data-loss-patch rationale prose. No skill-body changes; no schema vocabulary changes; no vendor-skill behavior changes.

### Carried forward from `1.8.0-rc1`

The bulk of the `1.8.0` content shipped under `1.8.0-rc1`. The following all stay landed; see [`1.8.0-rc1`'s release notes](https://github.com/SanderMuller/boost-skills/releases/tag/1.8.0-rc1) for the full per-item detail.

- **Skill prose update across 9 slot-aware skills** — opening "Project Conventions slots" tables and missing-slot UX prose describe the edit surface as "`boost.php` via `->withConventions([...])`". Skills updated: `jira-create`, `jira-rework`, `jira-updates`, `pull-requests`, `codex-review`, `bug-fixing`, `write-spec`, `interview`, `backend-quality`.
- **`pull-requests` skill body** — last explicit "declare `$.pr.gates` in their CLAUDE.md" reference rewritten to point at `boost.php`'s `->withConventions([...])` array.
- **`ai-guidelines` skill table** — AGENTS.md producer list reflects `boost-core 0.9.0`'s `CopilotTarget` joining the AGENTS.md shared-pool: "Codex / Copilot / Cursor / Amp / Junie / Kiro / OpenCode / etc.".
- **README "Project Conventions schema" section** — `->withConventions([...])` PHP-array example in `boost.php` replaces the marker-bounded YAML-in-CLAUDE.md example. Tooling table includes `boost convert-conventions`. `Migrating from 1.7.x` subsection.
- **`UPGRADING.md`** — canonical migration recipe for 1.7.x → 1.8.0 consumers.
- **`codex-review` skill absorbs the `codex-plugin-cc` invocation playbook** — vendor skill self-contained for plugin mode: plugin install, Codex CLI install, companion script path resolution, four invocation patterns, polling loop with stale-result trap, result retrieval, auth failure mode, `pr.gates on_missing` interaction. Skill body 220 lines (was 155 pre-rc1).
- **`$.codex.setup_doc` slot description narrowed** — now: "Optional path to a project-owned doc with project-specific codex overrides only [...]. Most consumers leave this slot unset." Backward compatible.
- **Codex invocation patterns reference `$.github.default_base_branch`** — base resolution is slot-driven, not hardcoded.
- **`ai-guidelines` generated-files table** — `.github/copilot-instructions.md` row dropped in `1.7.2`; carried through `1.8.0-rc1` + `1.8.0`.

### Schema design notes

No schema vocabulary changes from `1.7.x` or `1.8.0-rc1`. `conventions-schema.json` v1 remains the contract. `$.codex.setup_doc` description narrowed in `1.8.0-rc1` per absorption (no breaking change).

### Validation

- 27/27 skills + 1/1 guideline manifest valid.
- `opis/json-schema ^2.4` schema validation contract unchanged from `1.7.0` (operates on parsed values, format-agnostic for PHP-array vs YAML source).

### Adoption path

```bash
# 1. Update constraints
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.8" \
  "sandermuller/boost-core:^0.9.3"

# 2. Migrate conventions edit surface (1.7.x consumers only)
vendor/bin/boost convert-conventions

# 3. Re-sync + verify
vendor/bin/boost sync
vendor/bin/boost validate

















































```
See [`UPGRADING.md`](UPGRADING.md) for the full `1.7.x` → `1.8.0` migration recipe (or the `boost-skills 1.8.0-rc1 → 1.8.0` adoption note, which is the one-line constraint flip from `^1.8@RC` → `^1.8` plus stability flip).

### Acknowledgments

`1.8.0` shipped under the proving-consumer pattern that's stabilized across the family: a single high-friction consumer (`hihaho`) running the full migration end-to-end through `rc1`, surfacing zero vendor-side regressions and validating the codex-review absorption against real production usage. Engine-side parallel cadence held: `boost-core 0.9.0 → 0.9.4` delivered five patches in close succession with no schema-side adaptation required.

### Migration from `1.7.x`

See [`UPGRADING.md`](UPGRADING.md) for the full migration recipe. One-command path: `vendor/bin/boost convert-conventions` after the constraint bump.

### Migration from `1.8.0-rc1`

Atomic-commit shape, ~30 seconds of work:

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.8"

















































```
Then in `composer.json`: `minimum-stability` from `RC` → `stable` (or drop the field if you previously bumped only for this catalog). Run `composer update` to lockfile-flip. `boost-core` floor moves to `^0.9.3` transitively.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.7.2...1.8.0

## 1.7.2 - 2026-05-28

<!-- verified-sha: 05bd62ae8141e35ea602954b6cd405f80bf027a1 -->
### 1.7.2

Aligns the catalog with `sandermuller/boost-core 0.9.0`'s drop of the `.github/copilot-instructions.md` guideline-file emission. After 0.9.0 ships, the `CopilotTarget` no longer writes that file — Copilot now reads root `AGENTS.md` for guideline context per the GitHub Changelog 2025-08-28 + 2026 cloud-agent / CLI / JetBrains rollouts. Boost-core already emits `AGENTS.md` via `CodexTarget`, so the separate copilot-instructions write was duplicate.

Doc-only patch. No schema changes, no skill content rewrites, no functional behavior changes.

#### Changed

- **`ai-guidelines` skill** — removed the `.github/copilot-instructions.md` row from the Generated File/Directory reference table. The remaining `.github/skills/` entry stays (Copilot still consumes skills from that path; only the guideline-instructions emission drops).

#### Notes

- Ships immediately to align with `boost-core 0.9.0`'s release window — consumers adopting `boost-core ^0.9` on `boost-skills 1.7.x` see a correct catalog table during the 0.9.0 → 1.8.0 window without waiting for the larger 1.8.0 conventions-source-flip release.
- If your project previously had `.github/copilot-instructions.md` in your project gitignore, the boost-core write to that path is now dropped — the gitignore entry becomes a dead line and can be removed during your 0.9.0 adoption.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.7.1...1.7.2

## 1.7.1 - 2026-05-28

<!-- verified-sha: 1585e172fd1528e3cd430f341b7dcd3039ff19b4 -->
### 1.7.1

Documentation polish: clarifies that `boost-core`'s `Tag` enum vocabulary is broader than the tag-registry table in this README. Surfaced by real-world adoption (a Laravel-app consumer declared `Tag::Filament` / `Tag::Livewire` in `withTags(...)` as forward-compatible slots and hit "possible typo" diagnostics from `boost tags` despite the declarations being correct + intentional).

No schema changes, no skill content changes, no functional behavior changes. Doc-only release.

#### Changed

- **README Tags section** — added a paragraph after the existing mechanism-vs-vocabulary split clarifying that `boost-core` ships a broader `Tag` enum (`Tag::Filament`, `Tag::Livewire`, `Tag::Volt`, `Tag::Inertia`, `Tag::Flux`, `Tag::Pest`, `Tag::Tailwind`, others) with cases not bound to any current `boost-skills` skill. Declaring these in `withTags(...)` is harmless + forward-compatible — `boost-core` 0.7.5+ preserves declared-but-undiscovered tags across `boost install` picker re-runs.

The tag-registry table below the new paragraph stays unchanged — it documents tags `boost-skills` itself currently ships content under, not the family-wide enum vocabulary.

#### Notes

- The "possible typo" diagnostic wording in `boost-core`'s `boost tags` command is queued for separate engine-side polish; this README clarification removes the consumer-side ambiguity in the docs without waiting on engine release.
- Adoption flow for new consumers is unchanged. Existing consumers don't need to update anything.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.7.0...1.7.1

## 1.7.0 - 2026-05-28

<!-- verified-sha: 74170dfa86f25331955cb359220c040dddd9429b -->
### 1.7.0

Adds the conventions-schema slot-fill mechanism: vendor skills reference project-specific values (Jira project key, repo conventions, branch patterns, test framework, MCP server names, policy declarations) by JSONPath; consumers fill values in a `## Project Conventions` block in `CLAUDE.md` instead of shadowing entire skills. Nine catalog skills rewrite to consume the schema, from two in the `1.7.0-rc1` / `rc2` cycle to nine in stable.

#### Requires

- `sandermuller/boost-core ^0.8.2` — the conventions-schema engine surface. 0.8.2 ships the marker-bounded guideline-write fix that closes the round-trip-safety gap in 0.8.0/0.8.1. Without 0.8.2, the `Project Conventions` block in `CLAUDE.md` would be wiped on every sync by the upstream `AgentTarget` guideline-write step (acknowledged + fixed engine-side after `rc2` dogfood surfaced the failure mode).

#### Added

- **`resources/boost/conventions-schema.json`** (v1) — JSONSchema (draft 2020-12) defining the slot vocabulary. 8 slot groups (`jira`, `github`, `branches`, `pr`, `testing`, `codex`, `spec`, `mcp`), ~15 slots. Strict `additionalProperties: false` per named group (mcp stays open by design for project-defined MCP service keys). See the [Project Conventions schema](https://github.com/sandermuller/boost-skills#project-conventions-schema) section of the README for the prose contract.
- **`pr.gates` typed-policy mechanism** — array of typed-object gates with closed-enum `skill_invoked` / `shell_command` / `mcp_tool` discriminator. Vendor `pull-requests` dispatches on the `type` field; `mcp_tool` is the open escape hatch for project-specific policy (host registers a custom MCP tool, declares it as a gate) without vendor changes. Strict-rejects unknown types via JSONSchema `oneOf` + `additionalProperties: false`.

#### Changed

Nine skills now read project-specific values from the `## Project Conventions` YAML block in `CLAUDE.md` instead of embedding them in the skill body or asking the user every session. Each declares `metadata.schema-required: ^1` to signal the schema-version contract.

| Skill | Slot consumption |
|---|---|
| `jira-create` | `$.jira.project_key`, `$.jira.refuse_other_projects`, `$.jira.description_format_doc`, `$.mcp.jira` |
| `jira-rework` | `$.mcp.jira`, `$.jira.project_key`, `$.jira.refuse_other_projects` |
| `jira-updates` | `$.mcp.jira`, `$.jira.project_key`, `$.jira.refuse_other_projects`, `$.jira.description_format_doc` |
| `pull-requests` | `$.github.*`, `$.branches.patterns` (typed-object iteration with first-match-wins base resolution), `$.pr.title_format` (placeholder substitution), `$.pr.template_path`, `$.pr.gates` (typed-policy dispatch) |
| `codex-review` | `$.codex.invocation_mode` (plugin / bare_cli), `$.codex.setup_doc` |
| `bug-fixing` | `$.testing.backend_framework`, `$.testing.forbid` |
| `write-spec` | `$.spec.filename_pattern` (with `{issue_key}` / `{slug}` / `{date}` placeholder substitution + empty-placeholder-omit rule), `$.spec.research_docs`, `$.jira.project_key` (for `{issue_key}` resolution) |
| `interview` | `$.spec.research_docs`, `$.jira.project_key` |
| `backend-quality` | `$.testing.backend_framework` |

`pull-requests` additionally switches body/title patch commands from `gh pr edit --body-file` to `gh api -X PATCH` REST path — `gh pr edit --body-file` hits a Projects (classic) GraphQL deprecation in some `gh` versions surfaced during pre-release dogfood.

#### Schema design notes

- **Two-pattern slot taxonomy** — value slots (scalars / arrays / paths, vendor reads directly) vs policy slots (typed-object arrays, vendor dispatches on `type` discriminator). Each pattern has its own missing-slot UX: value-slot missing → ask user once per session; policy-slot missing → skip the policy entirely (no enforcement).
- **All 8 groups root-optional** — only `schema-version` is root-required. Capability-gated groups (`jira`, `github`, `branches`, `pr`, `testing`, `codex`, `spec`) don't force prompts on consumers who don't use the corresponding tag.
- **`additionalProperties: false` at root + per named group** — typos at root level (`jria.project_key`) and nested (`jira.projcet_key`) both fail validation. `mcp.*` intentionally stays open (the vocabulary of service keys is consumer-defined).
- **Per-pattern `base` in `branches.patterns`** — handles real-world hotfix/release branch workflows where `hotfix/*` targets `master` while `feature/*` targets `develop`. Sourced from production dogfood.
- **`codex.invocation_mode` enum default `plugin`** — most consumers benefit from the `codex-plugin-cc` companion script (background queueing, project-aware diff scoping, focus-argument handling, stable file-based result retrieval, `/codex:setup` auth bootstrapping). `bare_cli` stays as an opt-in fallback for environments without per-user `.claude/plugins/` cache (service-account CI runners, headless agents).
- **Strict-closed-enum `pr.gates` types in v1** — `skill_invoked` / `shell_command` / `mcp_tool`. Novel policy that doesn't fit closed-enum uses the `mcp_tool` escape hatch.

#### Tooling (via `boost-core ^0.8`)

- `vendor/bin/boost validate` — validates the `## Project Conventions` block against allowlisted vendors' schemas.
- `vendor/bin/boost slots [--vendor=X] [--missing] [--filled] [--json]` — lists slots across allowlisted vendors with filled / unfilled state.
- `vendor/bin/boost doctor --check-conventions` — adds conventions validation to the existing doctor report.
- `vendor/bin/boost paths --managed` — lists agent-managed paths (used by `pr.gates[].window: since_last_code_change` semantics).

#### Adoption path

1. Bump constraint: `sandermuller/boost-skills: ^1.7` and `sandermuller/boost-core: ^0.8.2` (or via family package — `sandermuller/package-boost-php ^0.10` / `sandermuller/package-boost-laravel ^0.11+` once those release with `^0.8.2` floors).
2. Run `composer update`. Auto-sync scaffolds the `## Project Conventions` block in `CLAUDE.md` on first sync.
3. Fill the YAML block with project values. Run `vendor/bin/boost validate` to surface missing/unknown slots; `vendor/bin/boost slots --missing` for fill-status by slot.
4. Drop any local shadows of the 9 rewritten skills if the vendor versions cover the project's needs.

#### Validation

- `opis/json-schema ^2.4` (engine validator): 17 test cases pass (full draft, minimal-required, strict-rejection of unknown gate types, `additionalProperties: false` at root + nested, schema-version `const: 1`, `jira.project_key` pattern, `branches.patterns` typed-object requirements, `testing.backend_framework` enum, `codex.invocation_mode` enum, `mcp.*` open vocabulary).
- 5 end-to-end engine scenarios + 1 new round-trip scenario pass against `boost-core ^0.8.2`: schema discovery + composition, scaffold flow, `boost slots --json` shape, `boost paths --managed`, schema-version seed, AND round-trip preservation of filled YAML across multiple syncs (the failure mode `rc1`/`rc2` dogfood surfaced + 0.8.2 fixed).

#### Migration from `1.7.0-rc2`

Consumers pinned to `^1.7@RC` or `1.7.0-rc2` resolve to stable `1.7.0` automatically once tagged (Composer's stability-suffix semantics: stable wins over RC). No constraint edit needed.

Consumers should also bump `sandermuller/boost-core` to `^0.8.2` if their constraint floor is lower — `1.7.0` requires the engine round-trip fix.

The `1.7.0-rc1` tag at `bf3c606` remains as a historical artefact — it was mis-targeted from `main` HEAD instead of the prep branch and never contained the schema work; `1.7.0-rc2` at `ca118a8` was the corrected RC.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.6.0...1.7.0

## 1.6.0 - 2026-05-27

### Added

- **`readme`** — author and maintain a high-quality README for a Composer package. Covers stub vs comprehensive shapes, voice, anti-patterns, staleness audit. Tagged `release-automation`.
- **`release-notes`** — draft GitHub release bodies for Composer packages. Covers structure (Breaking / Added / Fixed / Internal), past-tense voice, breaking-change callouts with migration code, and what to omit. Tagged `release-automation`.
- **`upgrading`** — canonical structure for UPGRADING.md in a Composer package. Covers when to maintain one, voice, anti-patterns. Tagged `release-automation`.

Content unchanged; only the publishing vendor changed. Tag-gated so consumers opt in via `withTags(..., 'release-automation')`. The vendor-side rationale (narrowing `package-boost-php` to package-author CLI + skill-authoring scope) lives in `package-boost-php`'s 0.10.0 release notes.

### Changed

- **`pre-release` skill** refactored to defer to the new sibling skills for canonical authoring rules. README staleness audit (§5a) now references the `readme` skill's audit section; release-notes drafting (§7) references the `release-notes` skill's structure / voice / breaking-change conventions. `pre-release` retains its orchestration role: timing (when notes draft, only after step-6 CI green), scrubbing rules (no internal noise in public release bodies), and the gating logic. The canonical convention content lives in the called-out skills.
- **`release-automation` tag** scope broadened. Was "CI release-automation convention" (single guideline, owned by `package-boost-php`). Now "release flow content: README authoring, release notes, UPGRADING, CI changelog automation" (3 skills owned by `boost-skills` + 1 guideline owned by `package-boost-php`). Tag registry row updated to reflect shared ownership.

### Migration

**Default upgrade path** — no action required for consumers who haven't declared `release-automation`. These skills are tag-gated; without the tag, sync is unchanged.

**To opt in to the moved skills**:

1. Ensure `sandermuller/boost-skills ^1.6` is in `withAllowedVendors([...])`.
2. Add `'release-automation'` to `withTags(...)` in `boost.php`.
3. Re-sync (`vendor/bin/boost sync` or via `composer install` auto-sync).

**Overlap-window workaround** — until `sandermuller/package-boost-php 0.10.0` ships (planned shortly after this release), consumers running both packages allowlisted AND declaring `release-automation` will hit a vendor-vs-vendor skill collision (`readme`, `release-notes`, `upgrading` published by both vendors). `boost-core` errors on the collision rather than picking a copy. Disambiguate by adding to `boost.php`:

```php
->withExcludedSkills([
    'sandermuller/package-boost-php:readme',
    'sandermuller/package-boost-php:release-notes',
    'sandermuller/package-boost-php:upgrading',
])





















































```
The exclusions force resolution to `boost-skills`'s copies during the overlap. Once `package-boost-php >= 0.10.0` is required (the version that drops these 3 skills), remove the `withExcludedSkills` block.

The collision affects only consumers that allowlist both packages AND declare the `release-automation` tag — primarily the boost-family dogfood projects (`boost-core`, `boost-skills`, the family-author packages). External consumers that don't declare the opt-in tag are unaffected.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.5.0...1.6.0

## 1.5.0 - 2026-05-27

- **`eloquent-models`** — creates and maintains Eloquent models with strict conventions: column/relation constants via `final public const`, comprehensive class docblock with typed `@property` and `@property-read` sections, foreign keys via constants, and the Laravel 11+ `casts()` method form referencing column constants. Includes a per-model checklist. Tagged `laravel` — sources content for any project that declares the `laravel` tag in `withTags(...)`. Sourced from production dogfood across multiple Laravel codebases; example domain genericized to parent/child/grandchild/tag for upstream.
- **`laravel` tag** — declared by a project using the Laravel framework (Eloquent ORM, service providers, framework integrations). Owner `boost-skills`. First entry in the registry for Laravel-wide capability tagging; pairs forward with future Laravel-framework-specific skills.

### Notes

- The constant syntax used in `eloquent-models` is `final public const NAME = 'value'` (untyped form, PHP 8.0+) — compatible with every PHP version Laravel 10/11/12 supports.
- The `casts()` method form is Laravel 11+. Laravel 10 consumers should adapt the example to the `protected $casts` property form (silent no-op otherwise).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.4.0...1.5.0

## 1.4.0 - 2026-05-25

Adds the first framework-specific skill (22 → 23) and registers two new capability tags. The skill is gated by tags — non-Laravel-Cloud consumers never see it.

### Added

- **`deploying-laravel-cloud`** — deploys and manages Laravel applications on Laravel Cloud via the `cloud` CLI: environments, databases, caches, domains, instances, background processes, billing. Tagged `laravel-cloud hosting` — a project must declare both to receive it. Sourced from production dogfood in a downstream Laravel-Cloud app; upstreamed here for shared maintenance.
- **`hosting` tag** — declared by a project that deploys to a hosted platform. Forward-compatible parent for platform-specific hosting tags (`laravel-cloud`, future siblings).
- **`laravel-cloud` tag** — declared by a project that deploys to Laravel Cloud specifically. Pair with `hosting` to receive `deploying-laravel-cloud`.

### Changed

- **README tag registry** — tightened wording, restructured the Tags section, added an Install example, and disambiguated `github` from `github-issues` explicitly (a repo hosted on GitHub but tracking issues in Jira declares `github` but not `github-issues`).
- **`boost-extension` tag** registered in the family-wide tag registry — owner `package-boost-php`. Documents the cross-family tag vocabulary even when the content lives elsewhere.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.3.0...1.4.0

## 1.3.0 - 2026-05-22

Adds three new guidelines (3 → 6), closing recurring gaps found across the boost-family repos. All three are tagged — they sync only to projects that declare the matching capability.

### Added

- **`javascript`** — JS/TS control-structure style (curly braces always, no single-line conditionals). Tagged `frontend`.
- **`phpstan-fixing`** — when a PHPStan error maps to a runtime bug, write a failing test before the fix. Tagged `php`.
- **`single-issue-scope`** — keep each session, branch, and PR focused on exactly one issue. **Opt-in** — tagged `single-issue-scope`; declare that tag in `withTags(...)` to receive it.

All three are tagged via `.boost-tags.yaml` (`boost-core` 0.6.0+ reads it; the manifest is inert on older versions or under `laravel/boost`).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.2.0...1.3.0

## 1.2.0 - 2026-05-22

Guidelines can now be capability-tagged, the same way skills are.

### Added

- **Guideline tag manifest** — a sidecar `resources/boost/guidelines/.boost-tags.yaml` maps a guideline to capability tags, so a guideline ships only to projects that declare the matching capability via `withTags(...)`. `database-safety` and `migrations` are tagged `database`; `verification-before-completion` stays untagged (universal). A project without a database no longer carries the database guidelines.
  
  Guidelines stay frontmatter-free — required for `laravel/boost` compatibility — so the tags live in the sidecar manifest rather than in the file. `boost-core` 0.6.0+ reads it; on older `boost-core` and under `laravel/boost` the manifest is inert and every guideline ships, so this is a forward-safe change.
  
- The CI validator now parse-checks every `.boost-tags.yaml` — invalid YAML, a non-map, a key that names no real guideline file, or a malformed tag fails the build. A bad manifest is a release-blocker, never a consumer surprise.
  

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.1.0...1.2.0

## 1.1.0 - 2026-05-22

Adds two skills (20 → 22) and tightens two existing ones.

### Added

- **`humanizer`** — removes signs of AI-generated writing (inflated significance, promotional language, em-dash overuse, rule-of-three, AI-vocabulary words, hedging, sycophancy) so text reads as natural and human. Vendored from the MIT-licensed `blader/humanizer` skill. Untagged — it applies to any project's prose.
- **`github-issue-updates`** — appends a user-facing description and QA testables to a GitHub issue after a feature ships, and moves the issue on its project board. The GitHub-Issues counterpart of `jira-updates`. Tagged `github-issues` — the first skill to use that capability tag.

### Changed

- **`bug-fixing`** — replaced a validation-library code example with a stack-neutral one (genericization residue a 1.0.0 pass missed).
- **`pre-release`** — sharpened the release-notes scrub step into a concrete grep checklist for internal identifiers.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.0.0...1.1.0

## 1.0.0 - 2026-05-21

The first stable release of `boost-skills`. It grows the package from 15 to 20 skills, introduces always-on guidelines as a new content type, and genericizes every shipped skill and guideline so nothing carries project- or framework-specific assumptions.

### Added

#### Skills (15 → 20)

- `interview` — structured Q&A to gather a complex feature's requirements before writing its spec; pairs with `write-spec`.
- `pull-requests` — create and manage your own GitHub PRs via the `gh` CLI: write the description, verify, route by risk.
- `resolve-conflicts` — resolve git merge conflicts without dropping functionality from either side.
- `test-writing` — write specific, descriptively named tests that follow Arrange-Act-Assert.
- `ux-review` — weigh UX/UI options for a new feature, recommend an approach, and document the decision.

#### Guidelines

A new content type — always-on guidelines under `resources/boost/guidelines/`, folded into `CLAUDE.md` / `AGENTS.md` alongside the skills:

- `database-safety` — never run destructive database commands; treat the test database as test-runner-owned.
- `migrations` — keep migration files self-contained; append columns rather than positioning them mid-table.
- `verification-before-completion` — run the verification command and read its output before claiming work is done.

### Changed

- **Genericized every skill and guideline** — removed project- and framework-specific assumptions (hardcoded toolchains, version matrices, framework idioms) so the content applies whatever the stack, and renders correctly under both `boost-core` and `laravel/boost`.
- `backend-quality` and `frontend-quality` made stack-agnostic in their test, lint, and type-check steps.
- Corrected `boost-tags` across the skill set — the package ships 9 capability-tagged skills and 11 universal ones, across the `php`, `frontend`, `github`, and `jira` tags.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/0.1.0...1.0.0

## 0.1.0 - 2026-05-20

First release of `boost-skills` — a package of generic AI agent skills in the `SKILL.md` Agent Skills format, for PHP projects and Composer packages. Skills are authored once here and distributed to every configured AI agent (Claude Code, Cursor, Copilot, Codex, Gemini, and the rest) by `boost-core`. Install `boost-skills` alongside a boost family package; see the README for setup.

### Skills

15 skills ship under `resources/boost/skills/`:

- **Review** — `code-review`, `codex-review`, `pr-review-feedback`, `evaluate`
- **Specs** — `write-spec`, `implement-spec`
- **Quality gates** — `backend-quality`, `frontend-quality`, `pre-release`
- **Debugging & performance** — `bug-fixing`, `autoresearch`
- **Jira workflow** — `jira-create`, `jira-rework`, `jira-updates`
- **AI configuration** — `ai-guidelines`

### Skill tags

Seven skills declare `boost-tags` — capability tags (`php`, `frontend`, `github`, `jira`) that mark which projects a skill is relevant to. A `boost-core` version with tag filtering syncs a tagged skill only to projects that opt into the matching capability; with earlier versions the tags are inert and every skill syncs. The remaining eight skills are universal.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/commits/0.1.0

## [Unreleased]
