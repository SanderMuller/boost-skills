# Plan 002: CI fails when the README tables drift from the shipped catalog

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d850d7d..HEAD -- .github/validate-skills.php .github/workflows/validate-skills.yml README.md resources/boost`
> If those changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-fix-catalog-contract-drifts.md (the three known drifts must be fixed first, or this check fails on its first run)
- **Category**: tests
- **Planned at**: commit `d850d7d`, 2026-07-03
- **Research**: design questions (harness, engine reuse, skill-validator overlap, conv-token validation) were investigated and settled — see [`plans/002-research-notes.md`](002-research-notes.md). This plan incorporates those conclusions: plain-PHP standalone checker, and the conv-token + tag-vocabulary invariants are now **in** scope (Tier 2 below), not deferred.

## Why this matters

The only automated gate today (`.github/validate-skills.php`, run in CI) checks
that each `SKILL.md` is *well-formed* and that each `.boost-tags.yaml` parses —
it verifies **no cross-surface invariant**. So the README's Skills and
Guidelines tables (the tag contract consumers rely on) can silently disagree
with the skill frontmatter and the guidelines directory, and CI stays green.
Plan 001 fixes three such drifts that had already shipped. This plan adds a
checker so the next drift fails CI instead of reaching a consumer. It is the
prerequisite that makes future catalog edits safe.

## Current state

- `.github/validate-skills.php` is the existing checker. It is plain PHP (no
  test framework), `require`s `vendor/autoload.php`, discovers `SKILL.md`
  recursively under `resources/boost/skills/`, validates each via
  `Stolt\Ai\Skill\Validator`, then validates each
  `resources/boost/guidelines/.boost-tags.yaml` as a well-formed map. It prints
  `PASS/FAIL` lines and `exit`s non-zero on any failure. **This is the pattern
  to mirror** — a second plain-PHP script, not a new test framework.
- `.github/workflows/validate-skills.yml` runs it. Full current content:
  ```yaml
  name: Validate skills
  on:
    push:
      branches: [main]
    pull_request:
  permissions:
    contents: read
  env:
    BOOST_SKIP_AUTOSYNC: 1
  jobs:
    validate:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v7
        - uses: shivammathur/setup-php@v2
          with:
            php-version: '8.3'
        - run: composer install --no-interaction --no-progress
        - run: php .github/validate-skills.php
  ```
- **Skill frontmatter shape**: YAML frontmatter between `---` fences at the top
  of each `resources/boost/skills/<name>/SKILL.md`. Tags live on a line
  `  boost-tags: "php github release-automation"` under a `metadata:` key.
  Untagged skills omit the line entirely. `symfony/yaml` is already installed
  (transitive dep) — you may `Yaml::parse()` the frontmatter block instead of
  regex if you prefer; both are acceptable.
- **Guideline tag sidecar**: `resources/boost/guidelines/.boost-tags.yaml` is a
  map of `filename.md: "space delimited tags"`. Files not listed are untagged.
- **README tables to check against** (as of commit `d850d7d`, after Plan 001):
  - Skills table starts at `README.md:80` with header `| Skill | What it does | Tags |`; each data row is `| \`<name>\` | ... | <tags-cell> |` where `<tags-cell>` is space-separated `` `tag` `` tokens, or `—` when untagged.
  - Guidelines table starts at `README.md:235` with the same shape (`| \`<name>\` | ... | <tags> |`).

## Commands you will need

| Purpose             | Command                                             | Expected on success                    |
|---------------------|-----------------------------------------------------|----------------------------------------|
| Install deps        | `composer install --no-interaction --no-progress`   | exit 0, `vendor/` populated            |
| Lint your new script | `php -l .github/validate-catalog.php`              | `No syntax errors detected`            |
| Run existing gate   | `php .github/validate-skills.php`                   | exit 0, `29/29 skills valid`           |
| Run your new checker | `php .github/validate-catalog.php`                 | exit 0, prints per-skill PASS, ends OK |

No Pest/PHPUnit, no linter beyond `php -l`, no typecheck in this repo.

## Suggested executor toolkit

- `symfony/yaml` (`Symfony\Component\Yaml\Yaml`) is already on the autoloader —
  used by the existing validator. Reuse it for frontmatter/sidecar parsing.

## Scope

**In scope** (create/modify only these):
- `.github/validate-catalog.php` (create) — the new checker.
- `.github/workflows/validate-skills.yml` (modify) — add one step to run it.
- `README.md` — **only if** the checker surfaces a real drift you must fix to make it pass (there should be none after Plan 001; if there is, it's a genuine bug — fix the README row, not the checker).

**Out of scope** (do NOT touch):
- `.github/validate-skills.php` — leave the existing checker as-is; add a second one alongside it.
- Any skill/guideline body content, any generated file.
- The **Tier 3** invariants in "Maintenance notes" (README Slot-groups table ↔ schema; cross-skill reference resolution) — those are a follow-up plan, not this one.

## Steps

### Step 1: Write `.github/validate-catalog.php`

Create a plain-PHP script (mirror the header-comment + `require vendor/autoload.php` style of `.github/validate-skills.php`) that checks these two invariants and `exit`s non-zero on any violation, printing a clear `FAIL <what> — <detail>` line per violation and a summary:

**Invariant A — skill frontmatter ↔ README Skills table parity.** For every
directory under `resources/boost/skills/`:
- Read its `SKILL.md` frontmatter; extract `name` and the `metadata.boost-tags`
  token set (empty set if the line is absent).
- Assert `name` equals the directory name.
- Find the matching README Skills-table row (the row whose first backticked cell
  is the skill name). Assert exactly one row exists.
- Parse that row's Tags cell into a token set (`` `x` `` tokens; `—` → empty set).
- Assert the README token set **equals** the frontmatter token set.
- Also assert there is **no** README Skills row naming a skill directory that
  doesn't exist (no phantom rows).

**Invariant B — guideline files ↔ README Guidelines table ↔ sidecar parity.**
- Every `resources/boost/guidelines/*.md` file has exactly one README
  Guidelines-table row, and vice versa (no missing, no phantom).
- For each guideline listed in `.boost-tags.yaml`, its README tag cell token set
  equals the sidecar's token set. Guidelines absent from the sidecar must show
  `—` (untagged) in the README.

**Invariant C — tag vocabulary (Tier 2).** Every token used in any skill's
`metadata.boost-tags` and in `.boost-tags.yaml` must appear as a documented tag
in the README `## Tags` table (the first-column `` `tag` `` entries around
`README.md:120`). This guards the vocabulary itself against an undocumented or
typo'd tag (the opposite direction from Invariant A, which guards per-row
parity).

**Invariant D — conv tokens resolve to schema slots (Tier 2).** For every
`<!--boost:conv path="…"-->` token in any `SKILL.md` body, the `path` must
resolve against `resources/boost/conventions-schema.json`:
- Load the schema with `json_decode`; recursively collect the set of valid
  dotted slot paths from `properties` (descend nested `properties`).
- A token's **root segment** (before the first `.`) must be a top-level schema
  property.
- For a group whose schema node has `additionalProperties: false` (e.g. `jira`,
  `github`, `testing`, `pr`), the **full sub-path** must exist in that node's
  `properties` (so `jira.projct_key` fails).
- For a group with open `additionalProperties` (e.g. `mcp`, whose node is
  `additionalProperties: {type: string}`), validate the **root only** — any
  sub-key is allowed (`mcp.jira`, `mcp.anything`).
- Extract `path="…"` with a small local regex (boost-core's own token
  extractors are `private`, so don't try to import them). Reusing
  `ConventionsSchema::compose()` + `SlotResolver::resolve()` for exact engine
  parity is **optional and not needed for v1** — and note you must build the
  `VendorSchemaSource` from the repo's own schema file directly; do **not** use
  boost-core's `SchemaDiscovery`, which skips the repo-under-development's schema.

**Invariant E — schema-required ↔ conv usage (Tier 2).** A skill's frontmatter
carries `metadata.schema-required` **iff** its body uses at least one
`boost:conv` token. (Holds today: every conv-using skill declares it, no
conv-free skill does.) Flag either mismatch.

Parsing the README table: match lines beginning with `| \`` inside the relevant
table (you can bound each table by its header row and the first subsequent blank
line). Extract the first `` `...` `` as the name and all `` `...` `` tokens in the
last `|`-delimited cell as the tags. Skip the `|---|` separator row.

Print a summary like the existing script (`N/N skills consistent`,
`M/M guidelines consistent`) and `exit(violations === 0 ? 0 : 1)`.

**Verify**: `php -l .github/validate-catalog.php` → `No syntax errors detected`.

### Step 2: Run it against the (post-Plan-001) catalog

**Verify**: `composer install --no-interaction --no-progress` then
`php .github/validate-catalog.php` → exit 0, all rows consistent. If it reports
a violation, first confirm Plan 001 has landed (`grep -n '| \`pre-release\`' README.md`
should show `release-automation`); a violation on an *already-fixed* row means a
parsing bug in your checker — fix the checker. A violation on a *different* row
is a real drift — see STOP conditions.

### Step 3: Wire it into CI

In `.github/workflows/validate-skills.yml`, add a step after the existing
`php .github/validate-skills.php` step:
```yaml
        - run: php .github/validate-catalog.php
```
Keep it as a separate `run:` so a failure names which gate failed.

**Verify**: the workflow file still parses as YAML — `php -r "var_dump(is_array(\Symfony\Component\Yaml\Yaml::parseFile('.github/workflows/validate-skills.yml')));"` (after `composer install`) → `bool(true)`.

### Step 4: Prove the check actually catches drift (negative test)

Temporarily edit one README tag cell to a wrong value (e.g. remove a tag),
run `php .github/validate-catalog.php`, confirm it now **exits non-zero** and
names that row, then revert the edit and confirm it exits 0 again.

**Verify**: non-zero exit on the broken state, exit 0 after revert;
`git status --porcelain README.md` clean at the end of this step.

## Test plan

This plan *is* the test infrastructure, so the "test" is the negative test in
Step 4 plus the green run in Step 2. There is no pre-existing test file to model
after; model the script's structure on `.github/validate-skills.php`. Run the
Step 4 negative test for **each tier of invariant**, not just the tag cell:
also (temporarily) break one `boost:conv path="…"` to a bogus slot and confirm
Invariant D flags it, and add an undocumented tag to one skill and confirm
Invariant C flags it. Revert each after.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.github/validate-catalog.php` exists and `php -l` passes.
- [ ] `php .github/validate-catalog.php` exits 0 against the current catalog.
- [ ] `.github/workflows/validate-skills.yml` runs the new script (a `run:` step referencing it exists) and still parses as YAML.
- [ ] Negative test done: hand-breaking one README tag cell makes the checker exit non-zero (demonstrated, then reverted).
- [ ] `php .github/validate-skills.php` still exits 0 (existing gate untouched).
- [ ] `git status --porcelain` shows only the two intended files (+ README only if a real drift was fixed).
- [ ] `plans/README.md` status row for 002 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The checker finds a README↔frontmatter drift on a row **other than** the three fixed in Plan 001 — that's a real, previously-unknown drift; report it with the row and the mismatch rather than editing to force green.
- Plan 001 has **not** landed (the three drifts are still present) — the check will fail; either land 001 first or report back.
- The README table format at commit `HEAD` differs structurally from the excerpts in "Current state" (columns changed) so your parser can't locate the tables reliably.
- Making the check pass would require weakening it (e.g. skipping a skill) — that defeats the purpose; report instead.

## Maintenance notes

- **Deferred to a follow-up (Tier 3)**: (a) README `### Slot groups (v1)` table
  ↔ schema `properties`, including its "Used by skills" column ↔ actual conv
  usage; (b) cross-skill reference resolution — every ``the `X` skill`` mention
  resolves to a shipping skill under a compatible tag set (the REF-01/02 backlog
  findings). Both are valuable but larger; spec them once this checker exists.
- The conv-token check (Invariant D) uses a static JSON-walk for v1. If exact
  engine-resolution semantics ever matter (mode/type pins), a later pass can
  swap in `ConventionsSchema::compose()` + `SlotResolver::resolve()` against a
  `VendorSchemaSource` built from this repo's own schema — see
  `plans/002-research-notes.md` §4.
- If the team later adopts Pest (see Plan 006-adjacent note about unused
  `nunomaduro/collision`), these invariants can move into a test file; the
  plain-PHP script remains valid either way.
- Reviewer should scrutinize the README-table parser for brittleness against
  padding/alignment changes — prefer token-set comparison over exact-string.
