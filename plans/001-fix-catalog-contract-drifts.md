# Plan 001: README tag/inventory tables match the shipped catalog

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d850d7d..HEAD -- README.md resources/boost/skills/pre-release/SKILL.md resources/boost/skills/jira-updates/SKILL.md resources/boost/guidelines`
> If any of those files changed since this plan was written, compare the
> "Current state" excerpts below against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / correctness
- **Planned at**: commit `d850d7d`, 2026-07-03

## Why this matters

`README.md` is the human-facing tag contract for this package: consumers read
its Skills and Guidelines tables to decide which `->withTags(...)` to declare
and what content will sync into their agents. Three rows currently disagree
with the shipped source of truth (skill frontmatter / the guidelines
directory), so a consumer who trusts the README will mis-declare tags and
silently not receive content:

1. `pre-release` is documented with fewer tags than it actually requires — a
   consumer declaring only the documented tags won't get the skill.
2. `jira-updates` is documented with an extra tag it doesn't carry.
3. The `signed-commits` guideline ships but is missing from the Guidelines
   inventory the README presents as complete.

These are one-line edits. After they land, Plan 002 adds an automated check so
they can't recur.

## Current state

Facts, inlined. All line numbers are as of commit `d850d7d`.

**Frontmatter is the source of truth for what actually syncs.**

- `resources/boost/skills/pre-release/SKILL.md:5` declares:
  ```
    boost-tags: "php github release-automation"
  ```
- `resources/boost/skills/jira-updates/SKILL.md:5` declares:
  ```
    boost-tags: "jira"
  ```
  Its body uses **no** GitHub tooling — verified: `grep -niE 'gh |github|pull.request' resources/boost/skills/jira-updates/SKILL.md` returns nothing. It uses only Jira MCP operations.

**The README rows that disagree:**

- `README.md:99` (Skills table, `jira-updates` row) currently ends with the Tags cell `` `jira` `github` ``:
  ```
  | `jira-updates`         | Update a Jira issue after its PR is created; post Blocked-by-Question comments.                      | `jira` `github` |
  ```
- `README.md:102` (Skills table, `pre-release` row) currently ends with the Tags cell `` `php` `github` ``:
  ```
  | `pre-release`          | Pre-push gauntlet: Rector, Pint, full test suite, PHPStan, and a doc-staleness audit.                | `php` `github`  |
  ```

**The Guidelines table** (`README.md:235-243`) has 7 rows but the directory has 8 files (`ls resources/boost/guidelines/*.md`). Missing row: `signed-commits`. The file `resources/boost/guidelines/signed-commits.md` exists, is untagged (absent from `resources/boost/guidelines/.boost-tags.yaml`, so it ships everywhere), and is already present as a "Signed Commits" section in the generated root `CLAUDE.md`. The table's current tail:
```
| `phpstan-fixing`                  | Fixing a PHPStan error — write a failing test first when it maps to a runtime bug.       | `php`      |
| `single-issue-scope`              | Keep each session, branch, and PR focused on exactly one issue.                          | `single-issue-scope` (opt-in) |
| `verification-before-completion`  | Run the verification command and read its output before claiming work is done.           | —          |
```

**Convention to match**: skill/guideline tag tokens in README tables are wrapped in single backticks and separated by a space (`` `php` `github` ``); an untagged row uses an em-dash `—`. Column alignment uses padding spaces — match the surrounding rows' visual alignment as closely as practical, but exact padding is cosmetic and not verified.

## Commands you will need

| Purpose             | Command                                             | Expected on success                         |
|---------------------|-----------------------------------------------------|---------------------------------------------|
| Install deps        | `composer install --no-interaction --no-progress`   | exit 0, `vendor/` populated                 |
| Validate the catalog | `php .github/validate-skills.php`                  | exit 0, ends `29/29 skills valid` + manifests valid |

This repo has **no** PHPUnit/Pest suite, no linter, and no typecheck — do not
look for `composer test`/`pint`/`phpstan`; they don't exist here. The only
gate is `validate-skills.php`. README edits don't affect it, but run it once at
the end to confirm nothing else broke.

## Scope

**In scope** (the only files you may modify):
- `README.md` — three table cells/rows only.

**Out of scope** (do NOT touch):
- `resources/boost/skills/pre-release/SKILL.md`, `.../jira-updates/SKILL.md` — the frontmatter is correct; the README is what's wrong. Do not "fix" the frontmatter to match the README.
- Any other README section, any other skill/guideline, any generated file (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`).

## Git workflow

- Branch: `advisor/001-catalog-contract-drifts`
- One commit is fine; message style follows the repo (imperative, e.g. `README: align pre-release/jira-updates tags + add signed-commits row`). Recent examples: `git log --oneline -5`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `release-automation` to the `pre-release` Tags cell

In `README.md:102`, change the Tags cell from `` `php` `github` `` to
`` `php` `github` `release-automation` `` so it matches the frontmatter.

**Verify**: `grep -n '| `pre-release`' README.md` → the row's last column shows all three: `` `php` `github` `release-automation` ``.

### Step 2: Remove `github` from the `jira-updates` Tags cell

In `README.md:99`, change the Tags cell from `` `jira` `github` `` to `` `jira` `` so it matches the frontmatter.

**Verify**: `grep -n '| `jira-updates`' README.md` → the row's last column shows only `` `jira` ``.

### Step 3: Insert the `signed-commits` guideline row

In the Guidelines table (`README.md:235-243`), add a row for `signed-commits`, placed alphabetically between `phpstan-fixing` and `single-issue-scope`. Use tag `—` (it ships everywhere). Suggested row:

```
| `signed-commits`                  | Never fall back to an unsigned commit when signing is enabled — surface the failure to fix it instead. | —          |
```

**Verify**: `grep -c 'signed-commits' README.md` → `≥ 1`; and the Guidelines table now has 8 data rows (one per file in `resources/boost/guidelines/`).

## Test plan

There is no unit-test harness in this repo yet (Plan 002 adds catalog
invariant checks — this plan is its first passing case). Manual verification:

- `ls resources/boost/guidelines/*.md | wc -l` → `8`, and every one of those 8 basenames (without `.md`) appears in the README Guidelines table.
- The two Skills-table tag cells now string-match their frontmatter `boost-tags` sets.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n '| `pre-release`' README.md` shows `release-automation` in the row.
- [ ] `grep -n '| `jira-updates`' README.md` shows the row's tag cell as `` `jira` `` with no `github`.
- [ ] `grep -c 'signed-commits' README.md` returns `≥ 1`.
- [ ] `php .github/validate-skills.php` exits 0 (unchanged — sanity check).
- [ ] `git status --porcelain` shows only `README.md` modified.
- [ ] `plans/README.md` status row for 001 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `jira-updates` body **does** invoke `gh` or GitHub APIs (re-run the grep in "Current state"). If so, the fix direction may be reversed — the frontmatter might need `github` added instead — and this is a judgment call for the maintainer.
- The README table structure has changed since commit `d850d7d` (columns added/reordered) so the excerpts above no longer match.
- `php .github/validate-skills.php` fails after your edit (it shouldn't — README isn't validated; a failure means something else drifted).

## Maintenance notes

- After Plan 002 lands, this class of drift is caught automatically; until then, any new skill/guideline needs a matching README row added by hand.
- Reviewer should confirm the tag cells are *set-equal* to the frontmatter, not just "close".
