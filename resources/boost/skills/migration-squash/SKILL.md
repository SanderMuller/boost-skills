---
name: migration-squash
description: "Create or review a Laravel migration squash (schema:dump --prune into a single schema baseline). Holds the conventions and the verification checklist that catches an incomplete, contaminated, or data-losing dump before it breaks fresh installs. Activates when: squashing migrations, running schema:dump, reviewing a squash PR, pruning migrations, resetting a migration baseline, or when user mentions: squash migrations, schema:dump, schema dump prune, mysql-schema, migration baseline, prune migrations, review a squash PR."
metadata:
  boost-tags: "laravel"
---

# Migration Squash — Create & Review

A squash folds every migration file into one schema baseline and **deletes the migration files**. The dump becomes the only record of that schema afterwards, so a wrong dump silently breaks every fresh install. This skill holds the conventions and the checks that catch the defects squash PRs actually ship with.

## When to use this skill

- Creating a migration squash
- **Reviewing a "Squash migrations" PR before merge** — run every check below
- Any change touching the tracked schema dump or `schema:dump --prune`

## Conventions (non-obvious — get these wrong and it breaks)

- **Squash at a sync point.** A squash rewrites the baseline that *every* branch builds from, so do it when the target branch and the active development branch are aligned — not mid-flight while feature branches carry migrations the baseline won't include. The target branch is whichever branch the baseline represents (commonly the default/release branch — base-branch resolution is the same one the `pull-requests` skill uses).
- **Know which file is tracked, and how it's loaded.** Laravel's `schema:dump` writes `database/schema/<connection>-schema.sql` (e.g. `mysql-schema.sql`) and `MigrateCommand::schemaPath()` loads that file on a fresh `migrate`. That standard `.sql` file is the tracked baseline for most projects — verify which path your project commits before you start.
  - **Optional project variant:** some projects track a non-default filename (e.g. `mysql-schema.dump`) because `schemaPath()` prefers a `.dump` over a `.sql`. If yours does, the process gains a rename step: dump → **rename the written `.sql` to the tracked name**. Skipping the rename leaves an untracked `.sql` plus a stale tracked file. If your project tracks the standard `.sql`, there is no rename.
- **CI may not load the schema on a squash PR.** Confirm which of your checks actually rebuild a DB from the baseline. If a squash PR targets a branch your test workflows skip (or only external scanners like Snyk report), then *none* of them load the schema — an incomplete or contaminated dump passes green and the checks below are the **only** gate.

## Creating a squash correctly

The dump copies your **local DB's** schema and `migrations` table verbatim, so it is only correct if that DB matches the target branch's migration set **exactly** — not *behind* (missing recent migrations → incomplete dump) and not *ahead* (your everyday DB usually carries development-branch-only migrations → contaminated dump). Do the pre-flight before dumping.

### Pre-flight — make the DB match the target exactly

```bash
git checkout <target-branch> && git pull
```

**Safest: dump from a clean, target-only DB**, not your day-to-day dev DB (which is almost always migrated to a development branch). Point `DB_DATABASE` at a throwaway database, then rebuild it as pure target state by loading the current baseline and running the target branch's migrations onto it. This is the test-runner-style "build it fresh, throw it away" path the `database-safety` guideline blesses — never wipe or `migrate:fresh` a dev or shared DB to do this.

**If you must dump from your working DB, verify it first:**

```bash
# 1. Not BEHIND — no target migration left unapplied:
php artisan migrate:status | grep -iq pending && echo "BEHIND: run php artisan migrate" || echo "not behind"
php artisan migrate

# 2. Not AHEAD — your DB must not have applied any migration the target lacks (e.g. a dev branch's).
#    Empty output = clean; any line = contamination, do NOT dump from this DB.
comm -13 <(git ls-tree -r --name-only origin/<target-branch> database/migrations/ | sed 's#.*/##;s#\.php$##' | sort) \
         <(git ls-tree -r --name-only origin/<dev-branch>    database/migrations/ | sed 's#.*/##;s#\.php$##' | sort) \
| while read -r m; do
    php artisan tinker --execute "echo DB::table('migrations')->where('migration','$m')->exists() ? 'AHEAD/contaminated: $m'.PHP_EOL : '';"
  done
```

### Dump, (rename,) clean up

```bash
php artisan schema:dump --prune     # writes <connection>-schema.sql, deletes migration files
# Optional project variant — only if your project tracks a non-default schema filename:
# mv database/schema/mysql-schema.sql database/schema/mysql-schema.dump
```

If the squash prunes any **data-migration** (one that seeded or transformed rows, not just schema), those rows are **not** in `schema:dump`'s output — add them to whatever seeds that table on a fresh DB (a seeder, a factory, or your schema-load hook), or the next fresh build / CI loses them (see review check #5).

Then remove any test that `require`s a now-deleted migration file by path, create the branch, and open the PR — verifying your own dump against the review checklist below before pushing.

## Reviewing / verifying a squash — run EVERY check

Capture the candidate schema dump's **contents** in `DUMP` (the checks below pipe `$DUMP`, not a path). Substitute `<PR>` with the PR number and `<schema-path>` with your tracked baseline file. The fetch and base-check commands below assume the change is a **GitHub** PR (`gh` + the `pull/<PR>/head` ref); on another host, check out the candidate branch however that host exposes it and substitute its ref for `pr-<PR>` (and read the target from the host's PR view) — or just review your **local working tree** with the alternative shown:

```bash
git fetch origin "pull/<PR>/head:pr-<PR>" && DUMP=$(git show "pr-<PR>:<schema-path>")   # GitHub
# or local working tree:  DUMP=$(cat <schema-path>)
```

**1. Target branch is correct** — confirm the candidate targets the baseline's branch. On GitHub:

```bash
gh pr view "<PR>" --json baseRefName -q .baseRefName   # expect: the baseline's target branch
```

On another host, read the PR's target from its UI/API, or skip this check when reviewing a local working tree you already know the base of.

**2. The tracked schema file changed, with no stray untracked dump** — the PR/working tree must modify the tracked baseline file and leave **no** untracked schema file (e.g. a `mysql-schema.sql` left behind when the project tracks a renamed file).

**3. Completeness — no recent migrations missing (the most common defect).** Every deleted migration must be recorded in the dump, and the newest migrations' columns must be present. A DB behind HEAD yields a dump missing the latest migrations' *schema and records*; merging then deletes those files while their schema is absent from the baseline → fresh installs miss tables/columns and the app breaks against its own schema.

```bash
# every migration on the target must be recorded in the dump:
for f in $(git ls-tree -r --name-only origin/<target-branch> database/migrations/); do
  n=$(basename "$f" .php)
  printf '%s' "$DUMP" | grep -q "$n" || echo "MISSING RECORD: $n"
done
# record-count sanity: prior baseline records + folded-in file count ≈ new dump records
# (the INSERT pattern below is MySQL-flavoured — adjust the grep for your driver's dump format)
echo "new dump:   $(printf '%s' "$DUMP" | grep -c 'INSERT INTO `migrations`')"
echo "baseline:   $(git show origin/<target-branch>:<schema-path> | grep -c 'INSERT INTO `migrations`')"
echo "+ files:    $(git ls-tree -r --name-only origin/<target-branch> database/migrations/ | wc -l)"
# spot-check a few of the newest migrations' columns actually exist in the dump:
printf '%s' "$DUMP" | grep -c "<a_column_added_by_the_latest_migration>"   # expect > 0
```

**4. Contamination — no other-branch migrations leaked in.** The dump must not contain migrations the target doesn't have (e.g. dev-branch-only ones).

```bash
# migrations present on the dev branch but absent on the target:
comm -13 <(git ls-tree -r --name-only origin/<target-branch> database/migrations/ | sed 's#.*/##;s#\.php$##' | sort) \
         <(git ls-tree -r --name-only origin/<dev-branch>    database/migrations/ | sed 's#.*/##;s#\.php$##' | sort)
# each such migration's name AND its columns must NOT appear in the dump:
printf '%s' "$DUMP" | grep -c "<a_dev_only_migration_name_or_column>"   # expect 0
```

**5. Data migrations — seeded rows preserved.** `schema:dump` captures table *structure* and the `migrations` table, but **not** the data rows any other table holds. So a pruned *data-migration* (one that `INSERT`s/`UPDATE`s rows) loses its rows on a fresh DB unless they are also carried into whatever seeds that table. Find the data-migrations among the pruned files and confirm their rows still land on a fresh DB:

```bash
# data-migrations among the files THIS PR deletes (they write rows, not just schema):
for f in $(git diff --name-only --diff-filter=D origin/<target-branch> "pr-<PR>" -- database/migrations/); do
  git show "origin/<target-branch>:$f" | grep -Eq 'DB::table|->insert\(|->update\(|->upsert\(' && echo "DATA MIGRATION: $f"
done
# for each, its rows must be present on a fresh DB — in the schema dump's own INSERTs, or in
# the relevant seeder. Grep the right seed for a value the data-migration inserts:
grep -c "<a value the data-migration inserts>" "<seeder-or-seed-dump-path>"   # expect > 0
```

**6. Prove it loads a complete schema (definitive).** A fresh test DB loads the baseline (plus any schema-load seeders) with an empty migrations dir. Run the **full suite** — a single trivial test does not touch the seeded data, so it cannot catch a dropped data-migration (#5); those regressions only surface in tests that assert on seeded rows (e.g. `Failed asserting that actual size 0 matches expected size 2`). The test runner owns its databases, so recreating them here is safe (per the `database-safety` guideline):

```bash
php artisan test --parallel --recreate-databases
```

**7. Obsolete migration tests removed** — no test `require`s a deleted migration file (it would fatal with "file not found").

## Failure modes seen in real squash PRs

| Symptom | Cause | Catch with |
|---|---|---|
| Untracked schema `.sql` left beside a stale tracked dump | forgot the rename (projects tracking a non-default filename) | check #2 |
| Fresh installs miss tables/columns | dumped from a DB **behind** the target HEAD | check #3 |
| Baseline has extra/unreleased columns | dumped from a **dev-branch-migrated** DB | check #4 |
| Fresh-DB / CI tests fail asserting on seeded rows (`size 0`) | a pruned **data-migration**'s rows weren't carried into the dump or a seeder | checks #5, #6 |
| Tests fatal "file not found" | a test `require`s a deleted migration | check #7 |

## Related

- A migration squash does **not** back-merge anything. If a hotfix landed directly on the target branch, confirm it's also merged into the development branch separately — otherwise dev / staging / CI still run the old versions.
- Migrations themselves must be idempotent and self-contained — see the `migrations` guideline.
- Never wipe, reset, or `migrate:fresh` a dev or shared database to build a clean dump — see the `database-safety` guideline; use a throwaway DB or the test runner's own lifecycle.
