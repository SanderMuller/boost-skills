---
name: final-verification-review
description: "Pre-PR closeout verdict: runs the full evaluate loop (incl. Codex review), then dry-runs the pull-requests preflight and pre-PR gates without creating a PR, and reports READY or NOT READY with what's missing. Activates when: work is done and a PR is next, final verification, final check, closeout check, or when user mentions: final-verification-review, final review, ship check, ready to ship, ready for PR."
argument-hint: "[file path, feature name, or commit range]"
metadata:
  boost-tags: "github"
  schema-required: "^1"
---

# Final Verification Review

A thin closeout orchestrator for the moment implementation work is done and opening a PR is the next step. It verifies the **code** (the full `evaluate` loop), then verifies the **PR preconditions** (the `pull-requests` preflight and pre-PR gates, check-only), and ends with a single READY / NOT READY verdict.

This skill **never creates the PR** — when the verdict is READY, hand off to the `pull-requests` skill.

## When to Use This Skill

- Implementation work is finished and a PR is the next step
- The user asks for a final check / "are we ready to ship?"

Do NOT use for:
- Creating or updating the PR itself — use `pull-requests`
- Applying reviewer comments — use `pr-review-feedback`
- Mid-feature spot checks — use `backend-quality` / `frontend-quality` directly

## Step 1: Verify the Code — Run `evaluate`

Invoke the `evaluate` skill in full. It owns the entire code-verification loop — quality checks, self-review, comment audit, fix-until-clean, `code-review`, and `codex-review` (per its Phase 7 dedup rules). Do not pre-skip any of its phases here; its own skip criteria decide what can be deduped.

Carry two things forward into the verdict:

- The evaluation summary (issues found and fixed, what was verified)
- Anything evaluate could not resolve itself (open design decisions, a Codex review that could not run)

## Step 2: Dry-Run the PR Preflight (Check-Only)

Everything in this step is **report-only**: never rename branches, never push, never create anything, and never halt — a failing check becomes a NOT READY item instead.

### 2a. Branch and base

This project's branch patterns:

```boost:conv
<!--boost:conv path="branches.patterns" mode="yaml" fallback="none — no branch patterns configured"-->
```

Scan in declared order; the first pattern matching the current branch name wins, and its `base` field is the base. When no patterns are configured, the base is the default base branch <!--boost:conv path="github.default_base_branch" mode="inline" fallback="main"-->. Same resolution the `pull-requests` and `codex-review` skills use.

When patterns are configured but the current branch matches none, do not fall back silently — mirror the `pull-requests` preflight outcome in the verdict:

- Branch **not yet pushed** (no upstream) → PR time will rename it to a matching name; report the upcoming rename as a non-blocking note.
- Branch **already pushed** → `/pull-requests` will stop and require a manual rename; report this as a blocking NOT READY item.

Report the matched pattern (or the rename situation) and which base the PR will target.

### 2b. Work state

- `git status` — uncommitted or untracked work belonging to this task means the PR diff would be incomplete. Report it.
- `git log <base>..HEAD --oneline` — an empty commit range means there is nothing to open a PR for. Unpushed commits are not blocking (they just need to reach the remote by the time the PR is opened), but report them.

### 2c. Pre-PR gates

This project's configured pre-PR gates:

```boost:conv
<!--boost:conv path="pr.gates" mode="yaml" fallback="none — no pre-PR gates"-->
```

Evaluate each gate in declared order exactly as the `pull-requests` skill defines them (`skill_invoked`, `shell_command`, `mcp_tool`), but in check-only mode:

- Report PASS / FAIL per gate.
- Ignore `on_missing` for flow control — never halt — but report what the policy would do at PR time (`stop_and_request` blocks, `warn` proceeds, `skip` is silent).
- For `skill_invoked` with `window: since_last_code_change`: assess from the current conversation whether the named skill ran after the most recent task-file edit (any non-managed file counts — code, docs, skills — not only code). Step 1's evaluate run typically satisfies a `codex-review` gate — unless its Phase 7 dedup-skipped against a clean run that predates a later edit.

If no gates are configured, say so and move on.

### 2d. Title format and template

Two preflight items from the `pull-requests` skill are creation-time commitments; verify their preconditions now:

- **Template** — if the project configures a PR template path (see the `pull-requests` skill), check that the file exists; a missing template would otherwise only surface at creation time.
- **Title format** — report the configured title format in the verdict so the eventual PR title is written against it; if enough is known about the task (e.g. an issue key the format requires), flag anything already missing.

## Step 3: Verdict

```markdown
## Final Verification — READY / NOT READY

### Code (evaluate)
- [N issues found & fixed / clean on first pass]; tests, static analysis, style verified

### PR preflight
- Branch `feature/x` matches `<pattern>` → base `main` — PASS
- All task work committed — PASS
- Gate `skill_invoked: codex-review` — PASS (ran clean after last edit)
- Gate `shell_command: composer test` — PASS (exit 0)

### Blocking (only when NOT READY)
1. [Exact missing item + the action that resolves it, e.g. "run `/codex-review` — last run predates the latest edit"]

Next: run `/pull-requests` to open the PR.
```

The verdict is point-in-time: any task-file edit after this run stales it (the same `since_last_code_change` semantics the gates use). Say so when relevant.

## Guidelines

- **Orchestrate, don't duplicate** — code verification belongs to `evaluate`, gate definitions to `pull-requests`. If those skills change, this one must not need to.
- **Check-only on preflight** — Step 1 fixes code (that is evaluate's job); Step 2 fixes nothing and reports everything.
- **One verdict** — the user should know at a glance whether `/pull-requests` will sail through, or what to do first.
