---
name: final-verification-review
description: "Closeout verdict before shipping: runs the full evaluate loop (incl. Codex review), then dry-runs the closeout preflight check-only — the pull-requests preflight + gates in a PR flow, or the direct commit/release preconditions in a no-PR flow — and reports READY or NOT READY with what's missing. Creates nothing. Activates when: work is done and a commit/PR/release is next, final verification, final check, closeout check, or when user mentions: final-verification-review, final review, ship check, ready to ship, ready for PR, ready to commit."
argument-hint: "[file path, feature name, or commit range]"
metadata:
  boost-tags: "github"
  schema-required: "^1"
---

# Final Verification Review

A thin closeout orchestrator for the moment implementation work is done and shipping is the next step. It verifies the **code** (the full `evaluate` loop), then verifies the **closeout preconditions** (check-only), and ends with a single READY / NOT READY verdict. It works in two flows:

- **PR flow** — the change ships via a pull request. The closeout preflight is the `pull-requests` preflight + pre-PR gates; READY hands off to `pull-requests`.
- **No-PR flow** — the change ships by committing directly to a target branch, optionally cutting a release. The closeout preflight checks the commit/release preconditions; READY hands off to a commit (and `pre-release` when a release follows).

This skill **creates nothing** — it never branches, commits, pushes, opens a PR, or tags. It reports, and hands off.

## When to Use This Skill

- Implementation work is finished and the next step is a commit, a PR, or a release
- The user asks for a final check / "are we ready to ship?"

Do NOT use for:
- Creating or updating the PR itself — use `pull-requests`
- Applying reviewer comments — use `pr-review-feedback`
- Mid-feature spot checks — use `backend-quality` / `frontend-quality` directly

## Step 1: Verify the Code — Run `evaluate`

Invoke the `evaluate` skill in full. It owns the entire code-verification loop — quality checks, self-review, comment audit, fix-until-clean, `code-review`, `codex-review` (per its Phase 7 dedup rules), and any project-configured evaluate checks (e.g. the `fixtures.anonymization` gate). Those run **inside** this evaluate pass — do not re-run them in Step 2, and do not pre-skip any of evaluate's phases here; its own skip criteria decide what can be deduped.

Carry two things forward into the verdict:

- The evaluation summary (issues found and fixed, what was verified)
- Anything evaluate could not resolve itself (open design decisions, a Codex review that could not run)

## Step 2: Dry-Run the Closeout Preflight (Check-Only)

Everything in this step is **report-only**: never rename branches, never commit, never push, never create anything, and never halt — a failing check becomes a NOT READY item instead.

**Resolve the closeout flow first**, because it changes what "ready" means:

- **PR flow** — default when PR machinery is configured (`branches.patterns` or any `pr.*` slot is set) or the user is on / heading to a feature branch. Run checks 2a–2d below as written.
- **No-PR flow** — the change ships by committing straight to a target branch (and optionally a release), no PR. Use when no PR machinery is configured, when the work lands on the default/release branch directly, or when the user asks for it (e.g. invoked with "without PR" / "no-pr" / "release"). Apply the **No-PR flow** note under each check.

When the signals conflict, state which flow you picked and why; the user can re-run with an explicit `pr` / `no-pr` argument. The gate checks (2c) are flow-agnostic; only the branch/work-state interpretation (2a, 2b) and the PR-only items (2d) differ.

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

**No-PR flow:** the branch logic inverts — being **on the target branch** is the correct state, not a problem. Confirm the current branch is the one the change ships to (the default base branch <!--boost:conv path="github.default_base_branch" mode="inline" fallback="main"--> or a release branch), not a stale feature branch. There is no feature-branch requirement and no rename concern.

### 2b. Work state

- `git status` — uncommitted or untracked work belonging to this task means the PR diff would be incomplete. Report it.
- `git log <base>..HEAD --oneline` — an empty commit range means there is nothing to open a PR for. Unpushed commits are not blocking (they just need to reach the remote by the time the PR is opened), but report them.

**No-PR flow:** uncommitted work is **expected** here — it is the deliverable about to be committed — so it is *not* blocking; still report `git status` so the user commits the complete set, and call out anything untracked that should be included or ignored. There is no "empty commit range" requirement (the work may be entirely uncommitted). If a release follows, also check `git log <last-tag>..HEAD` is the intended set.

### 2c. Closeout gates (flow-agnostic)

This project's configured pre-PR gates:

```boost:conv
<!--boost:conv path="pr.gates" mode="yaml" fallback="none — no pre-PR gates"-->
```

These gates are flow-agnostic — they gate the PR in a PR flow and the commit/release in a no-PR flow. The gate vocabulary (`skill_invoked` / `shell_command` / `mcp_tool`) and `on_missing` policy are exactly what the `pull-requests` skill defines. Evaluate each in declared order, check-only:

- Report PASS / FAIL per gate.
- Ignore `on_missing` for flow control — never halt — but report what the policy would do at closeout (`stop_and_request` blocks the PR/commit, `warn` proceeds, `skip` is silent).
- For `skill_invoked` with `window: since_last_code_change`: assess from the current conversation whether the named skill ran after the most recent task-file edit (any non-managed file counts — code, docs, skills — not only code). Step 1's evaluate run typically satisfies a `codex-review` gate — unless its Phase 7 dedup-skipped against a clean run that predates a later edit.

If no gates are configured, say so and move on.

### 2d. Endpoint-specific preconditions

**PR flow** — two `pull-requests` preflight items are creation-time commitments; verify their preconditions now:

- **Template** — if the project configures a PR template path (see the `pull-requests` skill), check that the file exists; a missing template would otherwise only surface at creation time.
- **Title format** — report the configured title format in the verdict so the eventual PR title is written against it; if enough is known about the task (e.g. an issue key the format requires), flag anything already missing.

**No-PR flow** — there is no PR title or template. If the endpoint is a **release**, the next step is the `pre-release` skill (its gauntlet, CI gate, and tag handoff own the release preconditions) — this skill does not duplicate those; just confirm the change is the intended release scope. If the endpoint is a **plain commit to the target branch**, there are no extra preconditions beyond 2a–2c.

## Parallel Closeout

The step order above is the canonical flow. When the harness can run independent tasks concurrently (subagents, parallel tasks, a background shell), overlap the independent parts — as an optimization, never a requirement:

- **Within Step 2** — 2a through 2d are independent checks; run them concurrently.
- **Step 2 alongside Step 1's tail** — Step 2 is read-only, so it may start once Step 1's fix loop has stopped changing files (evaluate's remaining passes are verification). Two caveats: a `skill_invoked` gate (2c) can only be settled after the review it checks has run, and any later file change from Step 1 stales Step 2 — re-run the affected checks.
- **Dedup across lanes** — a `shell_command` gate that duplicates a check evaluate already ran clean (e.g. the test suite) does not need a fresh run unless files changed since.

Fan out read-only work only — nothing in this skill's own steps mutates the repo. Harnesses with a scripted workflow feature may consolidate this fan-out into one workflow run; that is an optional escalation, never a dependency.

## Step 3: Verdict

State the flow you resolved, then report. PR-flow example:

```markdown
## Final Verification — READY / NOT READY  (PR flow)

### Code (evaluate)
- [N issues found & fixed / clean on first pass]; tests, static analysis, style verified

### Closeout preflight
- Branch `feature/x` matches `<pattern>` → base `main` — PASS
- All task work committed — PASS
- Gate `skill_invoked: codex-review` — PASS (ran clean after last edit)
- Gate `shell_command: composer test` — PASS (exit 0)

### Blocking (only when NOT READY)
1. [Exact missing item + the action that resolves it, e.g. "run `/codex-review` — last run predates the latest edit"]

Next: run `/pull-requests` to open the PR.
```

No-PR-flow example (same code section; preflight and next step differ):

```markdown
## Final Verification — READY / NOT READY  (no-PR flow)

### Code (evaluate)
- [clean / N fixed]; tests, static analysis, style verified

### Closeout preflight
- On target branch `main` — PASS
- Work uncommitted (N files) — expected, ready to commit (not blocking)
- Gate `skill_invoked: codex-review` — PASS (ran clean after last edit)

### Blocking (only when NOT READY)
1. [Exact missing item + the action that resolves it]

Next: commit to `main` (then `/pre-release` if this ships as a release).
```

Pick the **Next** line from the resolved flow: `/pull-requests` (PR), or commit-to-target-branch — and `/pre-release` when a release follows (no-PR).

The verdict is point-in-time: any task-file edit after this run stales it (the same `since_last_code_change` semantics the gates use). Say so when relevant.

## Guidelines

- **Orchestrate, don't duplicate** — code verification belongs to `evaluate`, gate definitions to `pull-requests`. If those skills change, this one must not need to.
- **Check-only on preflight** — Step 1 fixes code (that is evaluate's job); Step 2 fixes nothing and reports everything.
- **One verdict** — the user should know at a glance whether `/pull-requests` will sail through, or what to do first.
