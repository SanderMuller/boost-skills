# Plan 011: `clean-specs` proves shipping more than one way, and sweeps more than one directory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git log --oneline e2a671d..HEAD --
> resources/boost/skills/clean-specs/SKILL.md
> resources/boost/skills/write-spec/SKILL.md
> resources/boost/skills/eye-verification/SKILL.md
> resources/boost/skills/implement-spec/SKILL.md
> resources/boost/skills/pull-requests/SKILL.md
> resources/boost/conventions-schema.json`. If Step 3/Step 4 of `clean-specs`
> no longer reads as described under "Current state", or if a `spec.directories`
> slot already exists, read the change before applying this plan.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM — the change widens what the skill is willing to delete, and
  one new path (untracked directories) deletes files git cannot restore
- **Depends on**: none
- **Category**: correctness (the skill cannot fire), safety (the new path)
- **Planned at**: commit `e2a671d`, 2026-08-28
- **Provenance**: written-up investigation; source notes stay in `internal/`

## Why this matters

`clean-specs` deletes a spec only when a **merged PR** carrying the spec's
**issue key** is an ancestor of the base branch. Both halves of that sentence
are unavailable in the repositories where the skill is deployed, so it reports
"keep everything" in every run and can never delete a file.

Two independent causes, each sufficient on its own:

- **Keyless projects are a supported configuration.** `write-spec` handles the
  "no issue key" case and resolves the placeholder to empty. Every spec such a
  project writes dead-ends at Step 3 with `"no issue key in filename — manual
  review"` — the same output as having no skill installed.
- **The one directory it looks in is often empty.** Step 1 derives a single
  directory from `spec.filename_pattern`. A repository that keeps tracked specs
  under `docs/specs/` and local drafts under a gitignored `internal/specs/`,
  while the configured pattern still points at the default `specs/`, gets a
  clean sweep of an empty directory. That is a **false negative that reads
  exactly like success** — the worst failure shape for a housekeeping tool.

This repository is its own worked example. Every spec it holds lives outside the
configured default directory, none carries an issue key, and so **`clean-specs`
can evaluate none of them** — the skill cannot see a single spec in the
repository that ships it. The same shape was observed in a project that consumes
the package.

The deeper point is that PR metadata is **weak evidence used as the only
evidence**. The skill's own guardrails say so: shipped-state is inferred from
title/branch matching, which is imperfect. A PR title is a string a human typed.
It proves someone named a key, not that code shipped.

## Current state

`resources/boost/skills/clean-specs/SKILL.md` (142 lines):

- **Step 1** derives one directory: *"the literal path prefix before the first
  `{…}` placeholder"*, and enumerates with `git ls-files` — deliberately, so an
  untracked draft is never a deletion candidate.
- **Step 3** is a hard stop: no issue key → KEEP, stop.
- **Step 4** is built entirely on `gh pr list --search "<ISSUE-KEY>"` plus an
  ancestor check on the merge commit and a revert check.
- **Step 6** deletes with `git rm` on a branch, shipped as a PR via
  `pull-requests`.
- **Guardrails** name the safety net: report-first, explicit confirmation, a
  reviewable PR, and **git-recoverability**.

`resources/boost/conventions-schema.json` has a `spec` object with
`additionalProperties: false` and two slots: `filename_pattern` and
`research_docs` (an array with `render: ["inline", "bullets"]`).
`clean-specs` declares `metadata.schema-required: "^1"` and already renders a
`spec.filename_pattern` token.

## Decisions taken before planning

Recorded so the executor does not re-open them:

- **The deletion bar does not move.** "Fully checked off" plus "the work is on
  the base branch" stays. Only the *evidence accepted* for the second half
  changes.
- **Lean-KEEP stays the default on ambiguity.** More proof paths must not mean a
  lower bar. Each new rung carries its own falsifiable check.
- **The checkbox test stays necessary, never sufficient.** A checked box is an
  agent's claim about its own work — a precondition, not evidence.
- **Untracked directories get the two-path treatment** (§3), not a refusal.
  A tool that cannot touch the directory a project actually uses is the problem
  this plan exists to fix.
- **Rung A is one rung, not two halves.** Path existence is a precondition; the
  symbol check — present now, absent when the spec was written — is the proof.
  A spec naming nothing resolvable degrades to KEEP.
- **No commit-ancestor rung.** It cannot prove causation or survive a revert
  without inspecting the commit's content, which is Rung A. See §1.
- **`spec.directories` resolves the same way in every spec-aware skill.** A
  spec written to one location must not be swept from another.
- **No filename-slug PR matching.** Deferred; Rung A likely makes it
  unnecessary. See "Open Questions".
- **Additive under `schema-required: "^1"`.** A new optional slot inside the
  existing `spec` object is the same shape as the `pr.labels` addition in plan
  007. `schema-version` stays `1`.

---

## Proposed changes

### 1. An evidence ladder instead of one PR-keyed proof

Keep Step 2 (checkoff) as a precondition for all rungs. Replace Steps 3–4 with a
ladder: a spec is DELETE-ELIGIBLE when Step 2 passes **and any one rung**
returns a positive result. Every rung must be falsifiable; anything
indeterminate keeps the spec.

**Rung A — implementation present on the base branch (strongest).**
The spec names files and symbols. Resolve them against `origin/<base>`:

- every `file:line`-cited path in the spec still exists on the base branch
  (**necessary, never sufficient** — see below), and
- **every** symbol the spec says it adds (a class, a method, a test name, a
  migration) is present there — one absent symbol fails the rung, because a
  partly-shipped spec is live work, and
- **every task line contributes at least one candidate that was absent when the
  spec was written.** A symbol that already existed proves nothing; the spec
  asked for something new, so something new has to have appeared. Per task, not
  per spec — a spec-wide check lets one finished task carry an unfinished one
  that names only its pre-existing edit target. (Tightened after the first field
  report; see the shipped skill for the full rule and its cost.)

```bash
# the cited path is still on the base branch
git cat-file -e "origin/<base>:$CITED_PATH" && echo PRESENT || echo ABSENT
# the symbol is on the base branch now
git grep -q "$CITED_SYMBOL" origin/<base> -- "$CITED_PATH" && echo NOW_PRESENT || echo ABSENT
# and it was NOT there when the spec was written (the baseline that makes it proof).
# Use the PARENT of the spec's creation commit: a spec committed together with
# its first slice of implementation would otherwise read as pre-existing.
SPEC_BORN="$(git log --follow --diff-filter=A -1 --format=%H -- "$SPEC")"
BASE_REV="$(git rev-parse --verify -q "${SPEC_BORN}^")" || BASE_REV=""
if [ -z "$SPEC_BORN" ] || [ -z "$BASE_REV" ]; then
  echo NO_BASELINE            # → KEEP, never proof
else
  git grep -q "$CITED_SYMBOL" "$BASE_REV"; rc=$?
  case $rc in
    0) echo PRE_EXISTING ;;   # → not evidence
    1) echo NEW ;;            # → the rung's positive result
    *) echo NO_BASELINE ;;    # any other status is an error → KEEP
  esac
fi
```

**Resolve the baseline first, and fail closed on every error — including
`git grep`'s own.** `git grep` exits `1` for "no match" and other nonzero
statuses for real errors; an `if`/`else` on truthiness turns every one of those
into `NEW`, which is the positive result. Only `1` may mean `NEW`. A one-line
`[ -n "$X" ] && git grep … || echo NEW` chain prints `NEW` for an *empty*
`$SPEC_BORN` and for any git error, which turns "cannot evaluate" into "proof" —
the exact inversion this plan exists to prevent. `--diff-filter=A` returns
nothing after a rename (hence `--follow`) or on a shallow clone, and a spec in
the repository's root commit has no parent. Each of those is `NO_BASELINE` →
**KEEP**, reason `"no baseline to date the spec against — manual review"`.

All three were run against this repository at `e2a671d` and behave as written.

**An untracked spec has no creation commit, and no substitute for one.** An
mtime looks like a baseline and is not: a copy, a checkout, or a restore can
carry an old timestamp forward, and a baseline that is *too old* fails open —
every symbol introduced between that timestamp and the spec's real creation
reads as `NEW`. Git holds no trustworthy creation date for a file it does not
track, so **an untracked spec never reaches `DELETE-ELIGIBLE` through Rung A.**
It reaches `PROPOSED` at most (see below), which is a question to the user, not
a verdict. This is the honest cost of §3's untracked path and it should be
stated in the skill, not engineered around.

**Two ways this rung can lie, both closed above.**

- *Path existence alone.* Most specs modify files that already exist, so "every
  cited path is on the base branch" is satisfied by a spec whose work was never
  started. Path existence is a precondition, never the proof.
- *A symbol that predates the spec.* A spec naming a method that already
  existed would pass a naive presence check without a line of work being done.
  The `$SPEC_BORN` baseline is what closes this: at least one named symbol must
  have appeared **after** the spec was written. That baseline is the spec's
  creation commit's parent — which exists only for a tracked spec.

**What Rung A is, exactly: a text match, reported as one.** `git grep` proves
matching text exists on the base branch — not that it is the spec's
implementation. The match can sit in a comment, in documentation, in dead code,
or in an unrelated symbol that happens to share the name. Three rules keep that
honest instead of pretending otherwise:

- **Add a third verdict, and draw the line at recoverability.** `DELETE-ELIGIBLE`
  keeps meaning "the skill has proof and the deletion is recoverable" — a
  **tracked** spec whose symbols are baseline-verified, deleted through a
  reviewable PR that a revert undoes. `PROPOSED` means "here is the evidence,
  you decide", and it covers every case where a text match is the only proof and
  the deletion cannot be taken back: an **untracked** spec, always. Only
  `DELETE-ELIGIBLE` may be cleared by a batch confirmation; `PROPOSED` is
  answered one file at a time.
- **The report shows the evidence, not just the verdict.** Each Rung A spec
  lists the symbol it matched, the file it matched in, and the baseline commit
  it was absent at. The user confirms on evidence they can check in seconds, not
  on the word "eligible".
- **The irreversible path only ever acts on `PROPOSED`.** An untracked spec has
  no baseline, so it cannot be `DELETE-ELIGIBLE`; every untracked deletion is
  therefore a per-file question with its evidence line shown (§3). A user who
  does not recognise the evidence answers no.

A spec with no resolvable symbol is a **KEEP**, reason `"spec names nothing
checkable — manual review"` — a useful signal about the spec, not a fault in the
sweep.

With both checks in place, this observes the artifact instead of the paperwork:
a spec asking for a `markPublished()` method is proved by that method being
absent at the spec's baseline and present on `origin/main` now, whatever route
it took to get there.

**Rung B — commit-ancestor: rejected, and why it is not in this plan.**
The obvious second rung is "the commit that last touched a cited path is an
ancestor of the base branch". It does not survive scrutiny, and the plan
deliberately ships **two** rungs, not three:

- Ancestry plus ordering proves neither causation nor content. Any unrelated
  commit touching a cited file after the spec was written satisfies it, with
  the spec's work entirely undone.
- It cannot detect a revert. The revert commit itself touches the file and
  becomes the last-touching commit, so the rung passes again on code that was
  taken back out.

Both defects can only be closed by inspecting what the commit actually changed
— which is Rung A with extra steps. Direct-to-base workflows are therefore
covered by **Rung A**, which never needed a PR in the first place. Do not
reintroduce a commit-ancestor rung without a content check.

**Rung C — merged PR (today's Step 4, demoted).**
Unchanged in mechanism: the title-or-branch requirement, the ancestor check on
the merge commit, the revert check, the open-PR veto. It moves from "the proof"
to "one proof".

**Two rules that span the ladder:**

- **An open or draft PR still vetoes Rung A.** "PR stage is not implemented" is
  the load-bearing rule and it outranks Rung A: code can be on the base branch
  while a follow-up PR for the same spec is in review. A keyless spec has no key
  to search, so define the lookup by **cited-path overlap** instead — if any
  open PR touches a path the spec cites, the spec is KEEP:

  ```bash
  set -o pipefail
  PRS="$(gh pr list --state open --limit 100 --json number --jq '.[].number')" \
    || { echo VETO_UNEVALUABLE; exit 0; }
  [ "$(printf '%s\n' "$PRS" | grep -c .)" -ge 100 ] && echo VETO_UNEVALUABLE  # truncated
  for N in $PRS; do
    gh pr diff "$N" --name-only || { echo VETO_UNEVALUABLE; break; }
  done
  ```

  **Every failure path must reach `VETO_UNEVALUABLE`, which is KEEP**, reason
  `"cannot enumerate open PRs — manual review"`. A bare `for N in $(gh …)` loop
  swallows the failure: a `gh` that errors yields an empty list, the loop body
  never runs, and the veto reads as "no overlapping PR" — a wrong deletion
  dressed as a clean result. Capture and check the list before the loop, check
  every `gh pr diff`, and treat a result count equal to the limit as truncated.
- **Revert detection is now a content check, for both rungs.** Rung A is
  naturally revert-proof: a reverted implementation is an absent symbol, and an
  absent symbol fails the rung. Rung C is not — a `Revert "…"` title match only
  catches a revert that used the standard title, and a manual removal or a
  differently-named commit leaves the merge commit an ancestor while the code is
  gone. So **Rung C must run Rung A's presence check on `origin/<base>` before
  it may return a positive result**, and keeps the title match as a cheap
  early-out. A merged PR whose implementation is no longer present is a **KEEP**,
  reason `"merged then removed — manual review"`. This is also why the
  commit-ancestor rung is not in the plan: it is the one shape that could not
  perform this check at all.

**What this does to Step 3.** Step 3 stops being a hard stop. A missing issue key
removes **Rung C only**; the spec continues to Rung A. That single change is what
makes the skill useful in a keyless project.

### 2. `spec.directories` — more than one location

Add an ordered list to the schema's `spec` object, defaulting to the prefix
derived from `spec.filename_pattern` so existing projects are unaffected:

```php
'spec' => [
    'filename_pattern' => 'docs/specs/{slug}.md',
    'directories' => ['docs/specs', 'internal/specs'],
],
```

Schema slot (array, same shape as `research_docs`):

```json
"directories": {
  "type": "array",
  "render": ["inline", "bullets"],
  "items": { "type": "string" },
  "description": "Ordered list of directories holding spec files. Defaults to the literal path prefix of 'filename_pattern' before the first {…} placeholder. A directory may be untracked (gitignored); clean-specs treats those under a separate irreversible-deletion path. Each path is checked for existence by 'boost doctor --check-conventions'."
}
```

Step 1 enumerates each directory in turn and reports **per directory**, so the
reader sees which locations were swept. Two rules keep it honest:

- **An empty sweep of a configured directory is reported, not silent.**
  "0 specs found under `specs/`" is information; a blank report is not.
- **A configured directory that does not exist is a warning**, printed loudly —
  that is exactly the stale-default case this plan exists to catch.

### 3. Untracked directories get their own deletion path

This falls out of change 2 and must not ship without it. `git ls-files` is a
safety property today. The moment `spec.directories` admits a gitignored
directory, that net has a hole: `git rm` does not apply, the branch-and-PR flow
has nothing to commit, and **git-recoverability does not exist** — no revert, no
reflog, no checkout. `rm` is final.

**Classify per file, never per directory.** A directory can hold both tracked
and untracked Markdown, so a directory-level verdict would route a tracked file
into the irreversible path:

```bash
git ls-files --error-unmatch -- "$SPEC" >/dev/null 2>&1
case $? in
  0) echo TRACKED ;;
  1) echo UNTRACKED ;;
  *) echo CLASSIFY_FAILED ;;   # → KEEP and stop; never rm on a git error
esac
```

**Branch on the exit status, not on truthiness.** `&& TRACKED || UNTRACKED`
routes *any* nonzero exit — a broken index, a bad repository, an interrupted
call — into the irreversible path. Only the documented no-match status means
untracked; anything else stops the run. Enumerate candidates NUL-delimited
(`git ls-files -z`, `find -print0`) and quote every expansion: a spec filename
with a space, a newline, or a glob character must not word-split its way into
the wrong list.

Then split Step 6 by that per-file verdict:

- **Tracked** — unchanged: `git rm -- "$SPEC"`, branch, PR via `pull-requests`.
- **Untracked** — a **separate** confirmation that states plainly that the
  deletion is irreversible and names every file. No branch, no PR; a direct
  `rm -- "$SPEC"` after that confirmation. Never bundled into the tracked
  confirmation — the two carry different consequences, and one "yes" must not
  cover both.

**Confinement rules for the irreversible path.** `spec.directories` holds
arbitrary strings from a consumer's config, and `rm` does not forgive. Before
deleting, every candidate must satisfy all of:

- it is a **regular file** (not a symlink, directory, or device) ending in `.md`;
- its resolved real path is **inside the repository root** and **inside a
  configured directory** — reject anything absolute, containing `..`, or
  reaching outside through a symlink;
- it was re-enumerated and re-checked for eligibility **after** the report, per
  Step 6's fresh-state rule, which applies to untracked candidates exactly as it
  does to tracked ones. The confirmation lists that final set, and only that set
  is deleted;
- it still has the **same content hash** at `rm` time as it had in the
  confirmation. Record `shasum -a 256 -- "$SPEC"` (or `sha256sum`) per file in
  the confirmed set, re-check it immediately before deleting, and re-apply the
  regular-file and confinement checks at that moment. A mismatch means the file
  changed between the question and the answer — **KEEP** it, and say why. A
  recheck that happens only before the confirmation leaves the whole
  confirmation window open.

Pass `--` before every path in every command, so a filename that starts with a
dash is never read as a flag.

The Step 5 report groups by tracked/untracked for the same reason: the tracked
group can carry `DELETE-ELIGIBLE`, the untracked group tops out at `PROPOSED`.

### 4. Keep the sibling skills agreeing on where specs live

Verified at `e2a671d`, four skills name the specs location. Three derive it
from `filename_pattern`: `write-spec`, `pull-requests` (its step 11 spec
removal), and `eye-verification` (it renders a `spec.filename_pattern` token to
locate a spec's edge-case table). `implement-spec` is different — it takes the
spec path as its argument and only mentions `specs/*.md` in prose. With
`spec.directories` in play they need one resolution rule, or a spec is written
to one location and cleaned from another:

- **Reading skills** (`pull-requests` step 11, `eye-verification`,
  `clean-specs`) search **all** configured directories.
- **`write-spec` searches all, then writes to one.** Its duplicate check must
  cover **every** configured directory before it creates a spec, or a
  multi-directory project grows two specs for one feature in two locations.
  More than one match stops for user selection. The write target is the
  directory of `filename_pattern` when its prefix is in the list, otherwise the
  **first** entry — state that explicitly in `write-spec` as "ordered list,
  first is the default write target". A configuration whose `filename_pattern`
  prefix is absent from `directories` is **rejected, not redirected**: there is
  no defined way to re-root `docs/specs/{slug}.md` under a different directory,
  so `write-spec` stops and asks, and `boost doctor --check-conventions` reports
  it as an error. Silently writing the pattern's filename into the first
  configured directory is the ambiguity, not the fix.
- **`implement-spec` likely needs nothing.** Confirm it still resolves specs by
  argument only; if so, at most refresh its prose example. Do not invent a
  directory-resolution rule it does not have.

---

## Steps

1. Run the drift check above.
2. `resources/boost/conventions-schema.json` — add the `spec.directories` slot
   from §2. Do not touch `schema-version`.
3. `resources/boost/skills/clean-specs/SKILL.md` — **the stated bar first, then
   the procedure.** The frontmatter `description`, the intro paragraph, the
   `## Definition — "Fully Implemented"` section, and `## When to Use` all say
   today that a **merged PR** is required. Rung A accepts direct-to-base
   evidence with no PR at all, so leaving those untouched ships a skill that
   states two different deletion bars — and the frontmatter is the line an agent
   reads first. Restate the bar as "every box checked **and** the work is proven
   on the base branch", with the merged PR named as one accepted proof.
   Then the procedure: Step 1 (multi-directory, per-file tracked/untracked
   classification, per-directory reporting), Steps 3–4 (the ladder), Step 5
   (grouped report showing Rung A evidence), Step 6 (the two deletion paths),
   and the Guardrails (git-recoverability no longer holds everywhere; the
   open-PR veto outranks Rung A). Add a `spec.directories` conv token where the
   directory list is first named.
4. `resources/boost/skills/write-spec/SKILL.md` — the write-target rule (§4).
5. `resources/boost/skills/pull-requests/SKILL.md` (step 11) and
   `resources/boost/skills/eye-verification/SKILL.md` — search all configured
   directories.
6. `resources/boost/skills/implement-spec/SKILL.md` — verify first how it
   locates a spec. Change it only if it derives a directory; a path-argument
   skill needs no rule.
7. `README.md` — document the new slot wherever the `spec` slots are listed;
   leave the tag tables alone (no tag changes).
8. Run the test plan.

## Test plan

- `php .github/validate-skills.php` → all skills valid, exit 0.
- `php .github/validate-catalog.php` → passes, exit 0. This is the gate that
  matters: invariant **F** fails if the new `boost:conv path="spec.directories"`
  token has no schema slot, and **G** fails if a skill body gains a token
  without `metadata.schema-required`.
- Negative test for F: temporarily misspell the token path, confirm the
  validator catches it, restore.
- `composer validate` → valid.
- `python3 -c "import json;json.load(open('resources/boost/conventions-schema.json'))"`
  → parses.
- `vendor/bin/boost sync` rendered in **three** states, reading the rendered
  `clean-specs` body each time:
  1. no `spec.directories` configured — reads as a sensible single-directory
     default,
  2. one directory configured,
  3. two directories, one of them gitignored — the untracked path and its
     separate confirmation are visible in the rendered prose.
- `vendor/bin/boost doctor --check-conventions` → clean in all three states.

**The validators above check the catalog, not the decisions.** For an
irreversible deletion path that is not enough. Build a throwaway sandbox
repository and walk the rendered procedure by hand against each scenario,
recording the verdict. Every one must end in KEEP:

| Scenario | Required verdict |
|---|---|
| Spec renamed, so `--diff-filter=A` finds no creation commit | KEEP (`NO_BASELINE`) |
| Spec added in the repository's root commit (no parent) | KEEP (`NO_BASELINE`) |
| `git` or `gh` made to fail (bad repository, no network) | KEEP, never "no PR found" |
| Symbol present only in a comment or in unrelated code | reported with its evidence line, and refused for an untracked spec |
| An open PR past the `--limit` boundary | KEEP (`VETO_UNEVALUABLE`) |
| A directory holding both tracked and untracked specs | per-file split, tracked one never reaches `rm` |
| Spec filename with a space and with a newline | enumerated intact, no word-splitting |
| A symlink in a configured directory pointing outside the repository | refused by confinement |


One positive case is worth running too: a genuinely shipped spec must still come
out DELETE-ELIGIBLE, or the rung is decorative.

## Done criteria

- [x] A keyless spec no longer stops at Step 3; it reaches Rung A.
- [x] An open or draft PR still forces KEEP, including for a keyless spec, via
      cited-path overlap. An enumeration that cannot run also forces KEEP.
- [x] The frontmatter, intro, definition, and "When to Use" state the same
      deletion bar as the procedure — no leftover "a merged PR is required".
- [x] Every scenario in the test-plan table was walked in a sandbox repository
      and ended in KEEP.
- [x] A text-only match reports `PROPOSED`, never `DELETE-ELIGIBLE`, and an
      untracked spec can never be `DELETE-ELIGIBLE` at all.
- [x] Rung C confirms the implementation is still present on the base branch,
      not just that a `Revert "…"` title is absent.
- [x] Each confirmed untracked file is content-hashed at confirmation and
      re-checked immediately before `rm`.
- [x] Rung A cannot pass on a spec whose work never started: every named symbol
      is present on the base branch, and at least one was absent at the spec's
      creation commit.
- [x] No commit-ancestor rung was added back in.
- [x] Tracked/untracked is decided **per file**, and the irreversible path
      refuses anything that is not a regular `.md` file inside the repository
      and inside a configured directory.
- [x] Every configured directory is swept and reported, including an empty one;
      a missing configured directory is a loud warning.
- [x] Untracked deletions are irreversible-labelled, individually named, and
      confirmed separately from tracked deletions.
- [x] `write-spec` names one write target; the reading skills — including
      `eye-verification` — search all. `implement-spec` was checked, and changed
      only if it actually derives a directory.
- [x] Both validators and `composer validate` pass; `boost sync` +
      `boost doctor --check-conventions` are clean in all three config states.
- [x] `schema-version` is still `1`.

## STOP conditions

- **The rendered untracked path reads as a normal deletion.** If the
  irreversibility is not unmissable in the rendered prose, stop — shipping
  change 2 without a loud change 3 is strictly worse than shipping neither.
- **Invariant F or G fails and the fix is to weaken the validator.** Stop; the
  token or the slot is wrong, not the gate.
- **`spec.directories` turns out to need `schema-required: "^2"`.** The v2
  vocabulary effort is on hold. Stop and report rather than bumping the schema
  in this plan.
- **Rung A ships without its symbol check or without the `$SPEC_BORN`
  baseline.** Either is a bar-lowering change wearing the plan's title. Stop —
  a rung that passes on a never-started spec is worse than no rung.
- **A commit-ancestor rung reappears.** §1 rejects it on evidence. Adding it
  back needs a content check, which makes it Rung A. Stop.
- **A rung cannot be expressed as a falsifiable command.** Any rung that reduces
  to "the agent judges that it shipped" must not ship. Drop the rung.

## Open Questions

1. **How well does symbol extraction work in practice?** Rung A needs symbols
   pulled from the spec's prose, and its strength is capped by how well that
   works. The plan is deliberate that the cheap half — path existence — cannot
   stand alone (see §1), so the fallback for weak extraction is KEEP, not a
   looser rung. If that KEEP fires on most real specs, Rung A is mostly
   decorative and Rung C carries the skill; measure before adding complexity.
2. **Filename-slug PR matching for Rung C.** It would recover some PR proof for
   keyless projects, at the cost of a fuzzier match. Deferred deliberately —
   revisit only if Rung A proves insufficient.
3. **Should `boost doctor --check-conventions` flag a `filename_pattern` prefix
   that no tracked file matches?** That check would have caught the stale-default
   configuration on the day it drifted. It belongs in `boost-core`, not here.
