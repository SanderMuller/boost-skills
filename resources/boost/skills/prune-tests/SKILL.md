---
name: prune-tests
description: "Command-only — invoke with `/prune-tests`; never activates on its own. Audits a PHPUnit suite for low-value tests (framework restatements, echoes, exact duplicates, redundant data-provider rows, tests of deployed migrations and one-offs), has an independent refuter check every proposed deletion, removes the approved tests with a companion script, and proves the result against a baseline before it opens a cleanup PR."
argument-hint: "[optional: target count] [optional: tests/ subdirectory]"
disable-model-invocation: true
metadata:
  boost-tags: "php"
  boost-requires: "test-value test-writing"
  schema-required: "^1"
---

# Prune Low-Value Tests

Remove PHPUnit tests that add no regression protection, from the whole suite or from the `tests/` subdirectory in the arguments. A number in the arguments is a target, not a quota.

**Precision beats recall.** A wrong deletion loses protection and nothing reports it. A missed deletion costs only CI time. When the audit falls short of the target, report the shortfall and ask the user. Never lower the bar to reach a number.

Read the `test-value` skill and the `test-writing` skill before you start. They own the rules; this skill gives the order of the work. The user's invocation approves deletions outside a change's scope, so `test-value` § Scope does not stop this skill. The PR holds only this cleanup.

## When to use this skill

- The user runs `/prune-tests` to clean up a whole PHPUnit suite, or one directory of it.

Not for judging the tests of one change: `test-value` does that.

**PHPUnit only.** The companion script removes class methods, and the baseline step reads `phpunit --list-tests`. Neither works for Pest closures. The project's backend runner is <!--boost:conv path="testing.backend_framework" mode="inline"-->the runner the project uses — detect it from composer.json scripts or whether vendor/bin/pest vs vendor/bin/phpunit is present<!--boost:conv:end-->. When that is Pest, or the suite is mostly `test()` / `it()` closures, stop and tell the user.

## The companion script

`boost sync` emits `scripts/remove-test-methods.php` beside the rendered `SKILL.md` in each agent's skill directory. Under Claude Code it is at `.claude/skills/prune-tests/scripts/remove-test-methods.php` (swap the skills-dir prefix for another agent). When this skill runs as `prune-tests-user`, from a user-scope sync, the script is at `~/.claude/skills/prune-tests-user/scripts/remove-test-methods.php`. Commands run from the project root, so use that full path. Below, `<script>` is that path. Run it with `php <script>`.

## 1. Set up

1. Ask the user once: does this cleanup get an issue key, or is it a chore without one? Name the branch per the project's branch convention; without one, use `chore/remove-low-value-tests`. Fetch the base branch, <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end-->, and branch from `origin/<base>`.
2. Make a fresh work directory for each run, and keep every file below in it. A shared `/tmp` path picks up ledgers from an earlier run or another clone:
   ```bash
   AUDIT=/tmp/test-audit-$(basename "$(git rev-parse --show-toplevel)")-$(date +%s); mkdir -p "$AUDIT"; echo "$AUDIT"
   ```
3. Record the baseline. `--list-tests` prints class names, so convert them to paths. The `sed` below assumes the `Tests\` namespace maps to `tests/`. Check the `autoload-dev` PSR-4 map in `composer.json` and adjust it when the project maps differently. The companion script accepts only paths under `tests/`. When the tests live elsewhere, stop and tell the user. A data-provider row ends in `"row key"` or `#0`. With a subdirectory in the arguments, keep only its lines (`grep '^tests/<dir>/'`) here and in every later step:
   ```bash
   vendor/bin/phpunit --list-tests 2>/dev/null | grep '^ - ' \
     | sed -E 's/^ - Tests\\//; s/\\/\//g; s/::/.php::/; s/^/tests\//' | sort > "$AUDIT/cases-before.txt"
   sed -E 's/(::[A-Za-z0-9_]+).*/\1/' "$AUDIT/cases-before.txt" | sort -u > "$AUDIT/methods-before.txt"
   ```
4. Run the full suite once with `|| true`, and keep the output. Failures that exist now are not yours. When other agents run tests in parallel, use a database of your own so their runs do not change your result.
5. Split the test files into chunks of about 15 files. Take the files from the baseline (`cut -d: -f1 "$AUDIT/methods-before.txt" | sort -u`), not from a glob of `tests/`, which can also hold browser tests and helpers.
   - Put the files changed since the last audit in chunks of their own, because no earlier audit read them. Find the newest audit merge with `git log origin/<base> --oneline --grep "low-value" | head -1`, then list the files with `git diff --name-only <sha>..origin/<base> -- tests`. When there is no earlier audit, skip this.
   - Put the security folders in a separate security pass: the folders under `tests/` that test authentication, authorization, policies, billing and the public API (for example `Auth`, `Policies`, `Billing`, `Api`). Ask the user which folders count when the names do not make it clear.
   - An abstract parent or a trait that defines a test lists it once per concrete file. Judge it in the parent, where it counts once per subclass. A parent in a security folder goes to the security pass.

## 2. Propose — one auditor per chunk

Dispatch read-only agents in parallel, one per chunk (under Claude Code, `general-purpose` agents). Each writes a ledger to `$AUDIT/pass-<n>-<chunk>.md` and nothing else. Give each agent the brief below, the chunk's file list, and the items already proposed, so passes do not repeat.

Without subagents, audit the chunks yourself, one at a time. Say in the final report that the proposals and the refutation came from one context. That loses the independent second opinion step 3 exists for.

**Auditor brief:**

- Do not edit any repository file, change git state, or run tests. Write only the ledger.
- Read every file in the chunk in full, and the production code each test runs. Do not skip files by name.
- A test qualifies only for one of these categories:
  - `framework` — asserts Laravel, PHP or package behaviour: a built-in cast round-trip, a relation type, a built-in rule tested again per field, a route-model-binding 404, a fillable echo, a plain admin-panel column. A custom cast, rule, macro, query builder method, closure or branch is application logic: keep.
  - `trivial` — echoes a getter, a constant, a constructor argument, an enum label, or a job's `$tries` or `$queue`; checks `instanceof` on an object it just built; or asserts something that cannot fail.
  - `redundant` — another test runs the same branch (same fixture state, flag and role) and asserts the same or a stronger outcome. Cite it as `file:line` and name its assertion.
  - `dispatch-only` — asserts only that a job or event was dispatched, when another test runs the job and asserts its effect and a sibling still proves the dispatch.
  - `redundant-row` — a data-provider row over a value the code does not branch on. Keep one row per branch plus the real boundaries (empty, null, zero, maximum). Keep exhaustiveness guards (every enum case, every class).
  - `migration` — tests a migration that production already ran. The base branch or a release tag does not prove that, because a deploy can lag behind both. Keep the test unless the user or a deploy record the project keeps confirms that production ran it.
  - `dev-only` — tests code that never runs in production. Keep the one environment-guard test of a tool that writes or deletes data.
  - `one-off` — tests a one-off admin action, backfill or repair command. List these under a separate `## one-off` heading.
- Never propose a test whose assertion decides one of the items below. The rule protects the assertion, not the file: a constructor echo inside a policy test is still a candidate.
  - access: policies, gates, middleware, guest redirects, a 401, 403 or 404 for another user, tenancy, single sign-on, impersonation, signed URLs, tokens, sanitizers, CSP, rate limits
  - a calculated result a user sees or relies on, such as a score, a total or a status
  - a public or third-party API, webhook or payload shape
  - billing amounts, subscriptions, invoices
  - deletion, retention, anonymisation
  - a bug reproduction (an issue key or a regression comment nearby)
  - a query-count or N+1 guard
  - the only test of a branch, a custom validation rule, or an error path
- A test that covers a real scenario but asserts too little is not a deletion. List it under `## rewrite` at the end; it becomes a follow-up.
- When unsure, keep.
- Ledger line format, with the method and the row exactly as `--list-tests` prints them after the path conversion: `- tests/Path/FooTest.php::method | category | one-line reason | covering: tests/Path/BarTest.php:123 (or n/a)`. For a row: `- tests/Path/FooTest.php::method"row key" | redundant-row | …`.

**Security pass:** the same brief, plus: keep every assertion of an access decision or an amount, even when it looks repetitive. Propose only DTO or factory echoes, framework restatements, and exact duplicates (same fixture, same request, same assertions).

Run a second and a third pass over the chunks that returned the most, with the items already proposed excluded. Stop when a pass returns little.

## 3. Refute — one independent refuter per batch

Join the ledgers of this run, split them into batches of about 80 lines, and dispatch a fresh read-only agent per batch. Tell it that each reason and each covering test in the ledger is a claim to check, not a fact.

**Refuter brief:** You guard the suite. For each item, read the test, its whole file and the production code, and decide on your own. Give `DELETE-OK` only when the test or row adds no regression protection. For a `redundant` claim, you must also find and read the covering test, and its setup must take the same branch. Otherwise give `KEEP`, and name the branch the test alone protects. Always keep the protected assertions the auditor brief lists. Output `path::method | DELETE-OK or KEEP | reason | covering file:line`.

Then do these steps yourself:

1. Keep only the `DELETE-OK` items.
2. **Check every covering citation** of a `redundant` and a `dispatch-only` item: the file exists, the line falls inside a test method, and that method is not on the delete list.
3. **Drop chained deletions.** When item A cites B as its covering test and B is also on the list, keep both, or delete only one after you read both. A pair that cites each other deletes the branch.
4. Read the test and the cited covering test for a sample of each category. A refuter's verdict is a lead, not a fact.
5. Ask the user about every `one-off` item, and whether production ran it. Delete the one-off action or command, its registration, and its test together. Ask before you widen the bar, for example for copies of a guest-redirect test, or duplicates a reviewer wants to keep.

## 4. Remove

1. Write the approved methods to a list with bare `tests/…Test.php::method` lines: no ledger columns, no rows. From the project root, run `php <script> <list>`.
   - It stops before any write when a line is malformed or names a missing file.
   - It leaves a file unchanged when the result does not parse.
   - Otherwise it removes what it can, and exits 1 with each line it could not remove, for example an inherited test that lives in a parent.
   - Do not run the same list again: a method it already removed then reports as not in the file. Handle the failed lines by hand.
2. Remove data-provider rows and inherited tests by hand. When a provider is shared, give the test a local provider instead of changing the shared one. The script keeps a plain `//` or `/* */` comment above a removed method, and a docblock above such a comment. Delete them when they described only that method.
3. Remove imports, providers, traits and helpers that are now unused, and delete files left with no tests. Then format: when the project enables Rector (`quality.rector` = <!--boost:conv path="quality.rector" mode="inline"-->false<!--boost:conv:end-->), run `vendor/bin/rector process` first, then `vendor/bin/pint --dirty --format agent`, or the project's own formatter.
4. Prove that only the approved items went:
   - Make both lists again as in step 1.3 (`cases-after.txt`, `methods-after.txt`). `comm -23` of the method lists must equal the approved methods; a parent method shows once per concrete subclass. `comm -23` of the case lists must hold only the rows of those methods plus the approved rows.
   - Removing a test method does not fail the suite, so diff the method names of every changed file against the base:
     ```bash
     diff <(git show origin/<base>:<file> | perl -nle 'print $1 if /^\s*public function (\w+)\(/' | sort) \
          <(perl -nle 'print $1 if /^\s*public function (\w+)\(/' <file> | sort)
     ```
     Each missing name must be an approved method, or a provider or helper you removed on purpose. Use `perl`, not `grep -oP`: macOS ships BSD grep, which has no `-P`.

## 5. Verify

1. Run static analysis (`vendor/bin/phpstan analyse` or the project's own command) with `|| true`, then the full suite with `|| true`. Compare both against the baseline run. A new failure can mean a remaining test depended on state a deleted test set up. Restore the deleted test rather than patch the remaining one.
2. Dispatch the `test-coverage-auditor` and `security-reviewer` subagents over the deletion diff where the session has them. Give them the diff, not your conclusions. Trace each test they say protects a branch no remaining test reaches, and restore it when the trace confirms that. Without these subagents, walk the deletion diff yourself for both questions, and say in the report that this check was not independent.
3. Note the follow-ups you found: the `## rewrite` items, a test that cannot fail on its own branch, a gap in production code. Do not fix them here.

## 6. Ship

1. Commit with a message in the project's commit format, for example `Remove <n> low-value tests and <m> provider rows`. Keep the words `low-value` in the subject: the next run finds this audit with `--grep "low-value"` (step 1.5). Sign it when the repository signs commits, and never fall back to an unsigned commit. Put a one-off deletion in a separate commit.
2. Open the PR through the `pull-requests` skill where the project has it. Without it, push the branch and give the user the totals, the ledger and the follow-ups to open the PR on the project's host. Say in the report that this skips the `pull-requests` preflight and gates. The PR body states the totals (methods, rows, cases), the method, the protected categories, and the follow-ups.
3. Once the PR exists, post the ledger as PR comments, grouped by category: one line per removal with its reason and its covering test. A reviewer must be able to check every deletion without the session. On GitHub a comment holds at most 65,536 characters, so split a long ledger over several comments.
4. Report to the user: the totals against the target, what you restored and why, the follow-ups, and the PR link.
