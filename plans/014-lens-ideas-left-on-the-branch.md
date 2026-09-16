# Plan 014: Three lens ideas that only exist on a superseded branch

> **Executor instructions**: Read §2 before deciding anything. Each item is
> independent — take one, all three, or reject any with a recorded reason.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git log --oneline origin/feature/review-lens-skills --not main` and
> `git show main:resources/boost/skills/evaluate/SKILL.md | sed -n '/Phase 3/,/Phase 4/p'`.
> If `main` has since extracted its comment gate, item 1 is void.

## Status

- **Priority**: P3
- **Effort**: S per item
- **Risk**: LOW — each item is a skill-text change with no code behind it
- **Depends on**: nothing
- **Planned at**: 2026-09-16, at the merge that resolved the branch overlap

## 1. Where these came from

A branch cut on 2026-09-02 built three review lenses on 09-05: `comment-audit`,
`simplify-code`, and a `test-value`. `main` then continued the same work without
the branch — `test-value` and `php-generics` on 09-07, three review subagents on
09-08, and `simplify-shape` plus a tightened inline comment gate on 09-10.

The merge on 2026-09-16 resolved every conflict to `main` and dropped the
branch's two extra skills, because `main`'s versions are later drafts of the
same material and the whole catalogue already points at `main`'s names. The
branch survives at `origin/feature/review-lens-skills`; read the files there
rather than reconstructing them.

Three ideas on that branch have no equivalent on `main`. They are recorded here
so the merge does not bury them.

## 2. The three items

### Item 1 — the comment gate as its own skill

`evaluate` Phase 3 carries the full comment method inline: the two-part bar, the
Remove / Replace / Trim ladder, the density signal, the exemptions, and the
re-run rule. The branch moved that text to a `comment-audit` skill and left
Phase 3 as a handover, so one copy of the method serves `evaluate`, a reviewer,
and a direct `/comment-audit` call.

**Decide**: is the duplication real today? `evaluate` is the only caller now, and
a skill with one caller costs a file and a catalogue row. The argument for
extraction is a second caller — a review pipeline, or a user who wants the audit
alone.

### Item 2 — report-only mode for a parallel lens pipeline

The branch's lenses each carried a mode switch: when several judgement lenses run
over one tree and a later step applies every finding at once, the lens **reports
and does not edit**, because a cut applied mid-pass gets judged by the next lens
as code somebody wrote. `main`'s subagents solve the same fan-out problem a
different way, so check `test-coverage-auditor` and its siblings before adding a
mode that duplicates them.

### Item 3 — Cut as a named step, not inline prose

`main` splits the work in two: the cutting pass lives in `evaluate`'s
over-engineering row and its "Brevity has a floor" paragraph, and `simplify-shape`
owns the shaping ladder. The branch's `simplify-code` ran both as one skill,
Cut then Shape, with the rule that cutting comes first because shaping code you
are about to delete is wasted work. That ordering rule is the part `main` states
least clearly.

**Cheapest version of this item**: add the ordering sentence to
`simplify-shape`, and leave the split alone.

## 3. Verification

- `php .github/validate-skills.php` and `php .github/validate-catalog.php` pass.
- A new or renamed skill needs its README inventory row; CI checks the table
  against the shipped catalogue.

## 4. STOP conditions

- The branch is gone from the remote. Stop and report — the source text for all
  three items lives there.
- An item would re-create a skill name `main` already uses. Re-read §1: the
  earlier draft lost for a reason.
