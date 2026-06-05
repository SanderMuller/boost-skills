---
name: evaluate
description: "Self-directed eval loop: review own implementation, fix issues found, re-evaluate until clean, then run code review. Fix yourself; only ask the user for decisions. Activates when: evaluating implementation, self-reviewing code, checking for issues, or when user mentions: evaluate, check implementation, self-review, verify implementation."
argument-hint: "[file path, feature name, or description of what to evaluate]"
metadata:
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

**Otherwise**, run checks based on which files were changed:
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
| **Missing tests** | Happy paths, failure paths, and edge cases that aren't tested |
| **Convention violations** | Deviations from project patterns (check sibling files) |
| **Cross-version compat** | Works across every runtime and dependency version the project supports |

**DB-driven translation keys** (only when a project translation-key policy is configured):

<!--boost:conv path="translations" mode="yaml" fallback="not configured — skip this check"-->

If a policy is shown above, flag any DB-driven translation key that does not match its `key_pattern`. Exempt file-based keys: top-level groups listed in `file_based_prefixes.framework_groups`, and — when `vendor_namespace_exempt` is true — any key matching a vendor namespace prefix like `package::` (keys validated by the framework's own file-based lang files are out of scope). If `rules_doc` is set, also apply its naming-quality guidance. When nothing is configured, skip this check.

### Phase 3: Audit Code Comments

Within the **same evaluation scope resolved in Phase 2** (do not re-derive or broaden it), find every comment **added or changed** in this work. This covers **all** comment syntaxes in the changed languages, not only the obvious ones: docblocks and `//` / `#` / `/* */`, and template comments (`{{-- --}}`, `<!-- -->`). Do not skip template comments. Never judge pre-existing comments outside that scope.

A comment earns its place **only when both** are true:
1. It explains a non-obvious WHY — a hidden constraint, edge case, or external workaround a reader cannot derive from the code itself.
2. There is no better way to write the code that would make the comment unnecessary.

For each added/changed comment, apply this decision ladder **in order** and stop at the first that fits:

| Verdict | When | Action |
|---------|------|--------|
| **Remove** | Comment restates what the code already says, narrates the obvious, or is a leftover (commented-out code, "TODO" with no tracking link, scaffolding chatter) | Delete it |
| **Replace with better code** | The need for the comment disappears if the code is rewritten — rename a variable/method/class, extract a well-named private method, or split a long function | Rewrite the code, drop the comment, re-run affected tests |
| **Trim / compact** | The WHY is genuinely needed but the comment is verbose, repeats itself, or buries the point | Reduce to the minimal sentence(s) that carry the constraint |
| **Keep as-is** | Already minimal and explains a real non-obvious WHY | Leave it |

Prefer **Remove** and **Replace** over **Trim** — a comment that can be designed away is better than a shorter comment. Default to no comment; the bar to keep one is high.

Exempt — do not touch:
- Comments required by tooling or convention (e.g. static-analysis annotations, `@var` and type-hint docblocks the project's conventions mandate, IDE/linter directives, license headers).
- Comments outside the current diff (pre-existing code you did not modify).

Apply the Remove/Replace/Trim edits as part of this phase (this is your own work), then continue to Phase 4. If a rewrite needs a design decision, ask the user.

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

If in doubt, run it. If `codex-review` cannot run (CLI or plugin missing, auth failure), note that in the Phase 8 report instead of silently skipping.

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
