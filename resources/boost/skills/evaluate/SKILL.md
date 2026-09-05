---
name: evaluate
description: "Self-directed eval loop: review own implementation, fix issues found, re-evaluate until clean, then run code review. Fix yourself; only ask the user for decisions. Activates when: evaluating implementation, self-reviewing code, checking for issues, or when user mentions: evaluate, check implementation, self-review, verify implementation."
argument-hint: "[file path, feature name, or description of what to evaluate]"
metadata:
  boost-requires: "code-review codex-review comment-audit simplify-code test-value"
  schema-required: "^1"
---

# Evaluate Implementation

A self-directed loop: evaluate your own work, fix what you find, re-evaluate until clean, then run a code review for a fresh-eyes pass. Do not ask the user to fix things — fix them yourself.

## When to Use This Skill

- After implementing a feature or fixing a bug (all code is written)
- When the user says "evaluate", "check this", or "review your work"
- Before creating a PR or marking work as done

**Note:** This skill is a completion-level activity. It runs the full `backend-quality` skill (including static analysis and full test suite). Do not use this skill mid-feature — only when the implementation is done.

## Workflow

### Phase 1: Run Quality Checks (Skip If Recent)

Before running checks, review the current conversation for recent quality check results. **Skip checks that already passed clean and where no code changes were made since.**

**Skip criteria — all must be true:**
1. The check was run earlier in this conversation (not a previous session)
2. The check passed with zero errors/failures
3. No files of that type were added, removed, or changed after the check passed

**What counts as "recently passed":**
- Code style: ran with no changes needed
- Static analysis: ran with 0 errors
- Tests: ran with 0 failures (full suite or all relevant tests)
- Type checking: ran with 0 errors
- Linting: a full run ran with 0 errors (a scoped run on a subset of files does not count)

**If checks can be skipped**, state which specific checks you're skipping and why. Skipping is decided **per individual check**, not all-or-nothing for an entire skill:
> "Skipping code style and static analysis — both passed clean earlier with no backend changes since; re-running tests to verify behavior."

**If any doubt**, run the checks. It's better to re-run than to miss a failure.

**When the project runs `sandermuller/boost-pipeline`**, a recorded run counts as evidence, and
beats your own recollection. This applies only then — a project without the package runs its
checks as below, and a package repo usually has no `php artisan` to call.

Then ask it rather than reconstructing what changed since which check:

```bash
status=0; php artisan pipeline:verify --server-verified || status=$?; echo "exit: $status"
```

Keep the exit code visible, and keep the step from aborting. `|| true` reports 0 for a missing
command and for a failed check alike, and the rules below turn on that number. A bare `;` before
the `echo` loses the status under `set -e`.

**Ask `--server-verified`, never the bare call.** The bare call asks whether the whole tree is
verified, which is a gate's question. A walk that sequences agent steps can never answer yes: an
acknowledged step is a self-report, and the server never counts one as verified. This skill asks
the narrower question it can answer — what has already been checked.

**When the project declares several pipelines**, name the one to ask about:
<!--boost:conv path="quality.pipeline" mode="inline"-->not configured — ask without `--pipeline`<!--boost:conv:end-->.
Append `--pipeline=<name>` when a name is set. When none is set the command reports an error that
names the pipelines it found. Run the checks normally then, and never guess which one to trust.

Exit 0 means every check the pipeline ran passed against **the code currently on disk**. The tree
is fingerprinted, so this is a comparison rather than a judgement. It answers criterion 3 above
with a measurement instead of your memory. The message names the steps it counted:

> Run [r-4f2a] passed all 5 step(s) the server verified against this tree: [phpstan],
> [pint-test], [typecheck], [test-js], [lint-all].

Skip the mechanical checks those names cover, and run every check they do not. Deciding which
check an id covers is judgement, and judgement is this skill's half of the split. Do not add a
mapping, and do not read `receipt.json`. Say what was skipped and on whose authority:

> "Skipping code style, static analysis, type checking, linting and tests — `pipeline:verify
> --server-verified` exit 0 names [pint-test], [phpstan], [typecheck], [lint-all] and [test-js]
> as verified against this exact tree. Continuing to the review phases."

Name only what the message named. A check the names do not cover is a check nobody ran.

**Exit 0 is never a claim that the pipeline holds the checks you care about.** A pipeline that
declares no static analysis exits 0 without any. A step that rewrites the tree — a formatter, for
example — is left out of the names on purpose: it reports that it ran, never that the result is
correct. Skip only what the names cover.

Any non-zero exit means run the checks normally. It reports evidence too weak to skip anything
on. The causes differ — no run recorded, a run against different code, a walk that did not
finish, a step the server ran and failed, a run that verified nothing, or several pipelines with
none named. Treat them alike. Do not read the reason as a reason to skip anything.

This is the whole point of the split — the pipeline owns mechanical checks, this skill owns
judgement. Without it both run the same formatter, analyser and suite, and the project pays twice
for one answer.

**For every check still to run**, choose by which files changed:
- **Backend files changed** — use the `backend-quality` skill
- **JS/TS files changed** — use the `frontend-quality` skill

Fix all failures before continuing.

### Phase 2: Review for Issues

First, resolve the **evaluation scope** once — the set of changes this run is about — and reuse it for the rest of the skill (Phases 2 and 3). Resolve it in this order, stopping at the first that applies:

1. The commit range explicitly provided for this run.
2. Explicitly provided files, limited to the changes in them that belong to this task — intersect with the task's commits, or with the staged/uncommitted diff when there is no committed task work.
3. The task's committed history — against the base branch only when the branch contains nothing but this task, otherwise the specific commit range — plus any local edits on top.
4. The staged/uncommitted diff when all work is still local.
5. If none of these pins it down — committed task work mixed with unrelated changes you cannot separate — **stop and ask the user** which files or commit range to evaluate.

Never fall back to the whole-branch diff.

Read through all files in the resolved scope and check for:

| Category | What to look for |
|----------|-----------------|
| **Edge cases** | Null handling, empty collections, zero values, boundary conditions |
| **Race conditions** | Concurrent requests causing data corruption, non-atomic operations |
| **Security** | Missing auth checks, unvalidated input, XSS, SQL injection, type confusion |
| **Logic errors** | Wrong conditions, off-by-one errors, swallowed exceptions |
| **Missing tests** | Happy paths, failure paths, and edge cases that aren't tested — `test-value` carries the full method, in both directions |
| **Convention violations** | Deviations from project patterns (check sibling files) |
| **Cross-version compat** | Works across every runtime and dependency version the project supports |
| **Over-engineering** | Unrequested abstractions, speculative generality, premature flexibility; hand-rolled code a stdlib/native/framework feature or an already-installed dependency replaces; anything deletable without losing required behavior. `simplify-code` carries the full method, and the floor that stops a cut going too far |

**Brevity has a floor.** Shortening code is a win only when nothing required is lost. Never trade away input validation at trust boundaries, error / data-loss handling, security, accessibility, explicitly-requested functionality, or a test for non-trivial logic to make code smaller. Delete the unrequested, not the necessary — and apply these cuts through the Phase 4 fix loop like any other finding.

**DB-driven translation keys** (only when a project translation-key policy is configured):

<!--boost:conv path="translations" mode="yaml"-->not configured — skip this check<!--boost:conv:end-->

If a policy is shown above, flag any DB-driven translation key that does not match its `key_pattern`. Exempt file-based keys: top-level groups listed in `file_based_prefixes.framework_groups`, and — when `vendor_namespace_exempt` is true — any key matching a vendor namespace prefix like `package::` (keys validated by the framework's own file-based lang files are out of scope). If `rules_doc` is set, also apply its naming-quality guidance. When nothing is configured, skip this check.

**Fixture / code-sample anonymization** (only when a project anonymization policy is configured):

<!--boost:conv path="fixtures.anonymization" mode="yaml"-->not configured — skip this check<!--boost:conv:end-->

If a policy is shown above, scan the files **in the resolved evaluation scope** (do not broaden) that fall under its `scope` paths for proprietary product domain leaking into a publicly-shipped package: real product entity / class names, real table / column names, route keys, domain jargon, and comments copied from a host application. `src/` ships in the Composer dist archive — code-sample heredocs (e.g. rule `CodeSample` blocks) there are the worst leak surface; `tests/` is usually `export-ignore`d from the archive but still lives in version control. Scan both per the configured `scope`; never narrow to `tests/` alone. When `forbidden_terms` is set, treat any literal match as a deterministic blocking hit; otherwise apply the judgment criteria in the `guideline` doc. Treat every hit as a blocking issue carried into Phase 4 — apply the fix directly when it is an unambiguous rename to a placeholder (per the fix-don't-report ethos), and flag it for the user only when anonymizing needs a judgment call. When nothing is configured, skip this check.

### Phase 3: Audit Code Comments

Run the `comment-audit` skill over the **same evaluation scope resolved in Phase 2** (do not re-derive or broaden it). It owns the bar, the Remove / Replace / Trim ladder, the density signal, and the exemptions; invoked from here it applies its own verdicts. Keeping one copy of that method means the two cannot drift.

Its last rule matters for the phases after this one: a comment added by a later step — a fix in Phase 4, a review finding applied in Phase 6 or 7 — has not been audited. If you add or change a comment after this phase, re-run the audit over it before reporting.

### Phase 4: Fix Issues

For each issue found:

1. Fix it yourself — do not list it as a suggestion for the user
2. Run the affected tests again to verify the fix
3. If the fix requires a design decision, ask the user

### Phase 5: Re-evaluate (Loop Until Clean)

After fixing issues, re-run only the checks affected by your fixes (e.g., if you only fixed backend files, skip frontend checks). Repeat until a full pass finds no new issues. Only then move to Phase 6.

### Phase 6: Code Review

Once the evaluate-fix loop is clean, run the `code-review` skill for a structured review from a different angle (functionality, UX/UI, security, testing). Fix any findings from the code review and re-verify.

### Phase 7: Codex Review

Run the `codex-review` skill for a multi-model second opinion. Critically evaluate and implement any warranted feedback, then re-verify. This phase applies regardless of how evaluate was invoked — directly by the user or as the closeout step of another flow (e.g. right before PR creation).

**Skip this phase only when both are true** (the same dedup logic as Phase 1, and the same freshness window the `pull-requests` pre-PR gate checks):

1. `codex-review` already ran in this conversation and ended clean — no warranted findings remaining (every finding applied or dismissed with reasoning)
2. No task files were added, removed, or changed since that clean run — any file counts (code, docs, skills, config), not only code; only edits inside agent-managed paths are exempt, mirroring the gate's `since_last_code_change` semantics

If in doubt, run it. If `codex-review` cannot run (Codex CLI missing or unauthenticated), note that in the Phase 8 report instead of silently skipping.

### Phase 8: Report

Summarize what you found and fixed across all passes:

```markdown
## Evaluation Summary

### Issues Found & Fixed
1. **[Issue]** — [What was wrong and how you fixed it]

### Verified
- All tests pass (X tests, Y assertions)
- Static analysis clean
- Code style clean

### No Issues Found In
- [Categories that were clean]
```

If no issues were found, say so briefly and move on.

## Parallel Execution

The phase order above is the canonical flow. When the harness can run independent subtasks concurrently (subagents, parallel tasks, a background shell), use that capability — as an optimization, never a requirement:

- **Phase 1** — backend and frontend checks are independent toolchains; run them concurrently.
- **Phases 2 + 3, finding only** — the review dimensions and the comment inventory are read-only lenses over the same resolved scope; fan them out as parallel subtasks and merge the findings before fixing anything.
- **Phases 6 + 7** — the external review (Phase 7) may be launched in the background when Phase 6 starts, since both review the same scope. Trade-off: if Phase 6 findings change code, the external review is stale — the `codex-review` skill's re-review rules then apply.

Hard rules, regardless of harness:

- **Fan out read-only work only.** All edits — comment cleanups (Phase 3), issue fixes (Phase 4), re-evaluation fixes (Phase 5) — happen serially in the main context: parallel editors conflict, and design decisions go through the user.
- **Do not nest.** If this skill is already running inside a subagent, run sequentially.
- **Degrade gracefully.** Concurrency semantics differ per harness (some block until all subtasks finish, some delegate only on explicit request, some have none) — when unsure, the sequential order is always correct. Harnesses with a scripted workflow feature may consolidate the fan-out into one workflow run; that is an optional escalation, never a dependency.

## Guidelines

- **Fix, don't report** — the point of this skill is to catch and fix issues, not to generate a list for the user
- **Loop until clean** — do not stop after the first fix pass; re-evaluate until nothing remains
- **Be thorough but fast** — check all dimensions but don't over-analyze obvious code
- **Run tests after every fix** — don't batch fixes and hope they all work
- **Trust existing patterns** — if the codebase does something a certain way consistently, follow it
