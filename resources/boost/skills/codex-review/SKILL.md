---
name: codex-review
description: "Requests an independent code review from OpenAI Codex CLI, critically evaluates its findings, applies warranted fixes, and re-reviews until clean. Activates when: the user says /codex-review, asks for a Codex review, or wants an external AI review of changes."
metadata:
  schema-required: "^1"
---

# Codex Code Review

Run an independent code review using OpenAI Codex, critically evaluate and apply warranted findings, and re-review after fixes until a round comes back clean.

## Step 1: Determine what to review

Check what has changed:

```bash
git diff --stat HEAD
git diff --stat --staged
```

If there are uncommitted changes, review those. If the working tree is clean, review the latest commit. Which target flag that maps to is in [Step 2b](#2b-resolve-the-target).

## Step 2: Run the bounded Codex wrapper

Codex runs through one bounded, broker-free wrapper script this skill ships: `scripts/run-codex-review.mjs`. It calls the native `codex exec` CLI **directly** — no Claude Code plugin, no broker session — under a hard timeout that kills the whole process tree, writing *this* run's result / events / stderr into a fresh temp dir and printing a JSON report. (An unfocused run uses the `codex exec review` subcommand; a focused run uses `codex exec` with the target described in the prompt, since the CLI rejects a custom prompt alongside `review`'s target flags.)

That design removes both failure modes the old plugin path suffered: it **cannot hang** (the timeout fires and reaps the process, exit code 124), and it **cannot read a stale prior job's output** (results only ever come from this run's own files). So there is no broker session to clear, no poll loop, and no "is this result from my run?" ambiguity — a failure is a real failure, handled once and fallen back on, never a wedged broker to retry. (The plugin-broker hangs this replaces are tracked upstream: [anthropics/claude-code#48520](https://github.com/anthropics/claude-code/issues/48520), [openai/codex-plugin-cc#277](https://github.com/openai/codex-plugin-cc/issues/277) / [#258](https://github.com/openai/codex-plugin-cc/issues/258) / [#250](https://github.com/openai/codex-plugin-cc/issues/250), [openai/codex#25061](https://github.com/openai/codex/issues/25061).)

The wrapper is a **companion file emitted beside this skill**: `boost sync` writes it into each agent's skill directory next to the rendered `SKILL.md`, so it is already on disk — nothing to materialize. Under Claude Code it lands at `.claude/skills/codex-review/scripts/run-codex-review.mjs` (swap the skills-dir prefix for another agent). In the commands below, `<wrapper>` is that path. Emitted assets carry no executable bit, so always invoke via `node <wrapper>`, never `<wrapper>` directly.

### 2a. Preflight — Codex CLI

The wrapper needs the OpenAI Codex CLI on `PATH`:

```bash
npm install -g @openai/codex
```

Requires a ChatGPT subscription (Free tier is sufficient) **or** an OpenAI API key. If the CLI is installed but not authenticated, the user runs `codex login` in their own terminal — it is interactive and binds to their session, so never run it on their behalf (suggest `!codex login` if you want the output captured here). The wrapper's own preflight fails fast with an actionable message when `codex` is missing or not in a Git repo, so you don't need to pre-check those yourself.

### 2b. Resolve the target

Resolve `<base>` the same way the `pull-requests` skill does — scan the configured branch patterns in declared order; the first pattern matching the current branch name wins, and its `base` field is the base:

```boost:conv
<!--boost:conv path="branches.patterns" mode="yaml"-->none — no branch patterns configured<!--boost:conv:end-->
```

If no pattern matches (or none are configured), fall back to the default base branch <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end-->.

Then pick the invocation by scope and whether the user supplied a focus argument (`<wrapper>` is the emitted path from the [Step 2](#step-2-run-the-bounded-codex-wrapper) intro):

| Scope | Focus argument | Command |
|---|---|---|
| Feature branch vs base branch | None | `node <wrapper> --base <base>` |
| Feature branch vs base branch | Yes | `node <wrapper> --base <base> --prompt-file <focus-file>` |
| Uncommitted working tree only | None | `node <wrapper> --uncommitted` |
| Uncommitted working tree only | Yes | `node <wrapper> --uncommitted --prompt-file <focus-file>` |
| A single commit | None | `node <wrapper> --commit <sha>` |

- **Prefer passing the target explicitly** (above) so the base matches your project's branch conventions. Invoked with no target flag, the wrapper infers one — a feature branch that differs from the repo's default branch → that branch diff, otherwise the uncommitted working tree — but the explicit form is the documented path.
- **Pass the focus through a file, not by interpolating it into the shell command.** Write the user's focus text **verbatim** to a temp file (with the `Write` tool, or a quoted-delimiter `<<'EOF'` heredoc) and pass it via `--prompt-file <focus-file>`. Never build `--prompt "<focus>"` inline — a focus containing `"`, `$`, a backtick, or other shell metacharacters would mangle the `node <wrapper>` command or execute unintended syntax. `--prompt-file` keeps the focus out of the shell entirely (the wrapper then forwards it to Codex itself).
- The default timeout is 15 minutes; override per-run with `--timeout-ms <ms>`, or set `CODEX_REVIEW_TIMEOUT_MS` in the environment (floor 1000ms), for a very large diff. The flag wins over the env var.
- The wrapper runs Codex in a read-only sandbox and passes `--ignore-user-config` so a stalled inherited MCP probe can't wedge startup. Pass `--use-user-config` only if a project deliberately needs the user's Codex config.

### 2c. Read the result

The wrapper prints a JSON report to stdout. Branch on it — do **not** read Codex output any other way:

- **`ok: true`** — read the file at the report's `resultFile` path with the `Read` tool (that is the full review; `resultPreview` is truncated to 500 chars). This is what Step 3 evaluates.
- **`ok: false` with `timedOut: true`** (exit code 124) — the review exceeded the timeout. There is nothing stale to salvage (each run's files are isolated), so don't try. Surface it to the user and **fall back to the in-house `code-review` skill** for second-opinion coverage.
- **`ok: false` otherwise** — inspect `stderrPreview`, `terminalEventErrors`, and `error`. An auth or capacity failure is handled under [Cross-cutting concerns](#cross-cutting-concerns); any other failure — surface it and fall back to the in-house `code-review` skill.

**One attempt, then fall back — do not loop the wrapper.** It cannot hang, so a failure is a genuine failure (auth, capacity, a real Codex error), not a transient wedge that a re-run clears.

### Cross-cutting concerns

- **Auth failure** — if `codex` is installed but reports an auth failure (surfaced in the wrapper's `stderrPreview` / `error`), leave the review unrun and surface it to the user. Don't try to authenticate on their behalf — `codex login` is interactive and binds to their session.
- **Capacity / transient failures** — if the review fails on model capacity, rate limiting, or a transient error, re-run the same wrapper command a few times. Never substitute a different review engine or fall back to reviewing the code yourself under this skill's name — the whole value here is the independent second opinion. If retries keep failing, leave the review unrun and surface it to the user (the in-house `code-review` skill is the reliable second opinion when Codex is unavailable).
- **Project-specific overrides doc** — <!--boost:conv path="codex.setup_doc" mode="inline"-->none — the steps above are self-contained<!--boost:conv:end-->. If a path is shown, load that file for project-specific overrides (custom auth flow, focus areas, exclusions). Most consumers leave it unset.
- **`pr.gates skill_invoked: codex-review` interaction** — if the codex review can't run (codex CLI missing or unauthenticated), the `pr.gates` `on_missing: stop_and_request` policy means the vendor `pull-requests` skill should leave the gate's checklist item unchecked + note the unrun-reason rather than blocking PR creation entirely. The **checked** form of that item requires the Step 7 proof-commit SHA — a tick is only valid with a commit reference, never on its own.

## Step 3: Critically evaluate findings

Codex findings are a second opinion, not gospel. You have greater context on the codebase — use it. For each finding:

1. **Is it a real bug?** — Verify by reading the code. Don't trust Codex's assessment blindly.
2. **Is it already tested?** — Check if existing tests cover the scenario.
3. **Is it a style preference?** — Skip. Don't change working code for style.
4. **Is it a false positive?** — Codex may misunderstand framework internals or the project's architecture. Verify against the actual behavior.
5. **Does it conflict with the project's established patterns?** — Check sibling files. Established project patterns take precedence over Codex preferences.

Don't over-apply: a review that implements 2 real improvements is better than one that applies 10 questionable changes. For each finding, briefly note whether you're implementing or skipping it and why.

## Step 4: Apply warranted fixes

For findings that are genuine issues:

1. Fix the code
2. **Sweep for siblings** — when an accepted finding reveals a bug class or repeated pattern, check the rest of the reviewed scope for other instances and fix them in the same pass. Stay within the scope under review; instances elsewhere in the codebase are follow-up territory, not this change.
3. Verify with the project's tests and static analysis (see the `backend-quality` / `frontend-quality` skills for the relevant stack)

## Step 5: Re-review until clean

A review is stale the moment a fix changes any file. If Step 4 changed any files, run the review again and repeat Steps 3–4 on the new findings. Loop until a round comes back clean: no warranted findings, where findings dismissed with reasoning count as handled. A review that predates the last file change is stale — the same staleness a `pr.gates` freshness window (`window: since_last_code_change`) guards against.

Re-review the change's **current state**, not the original target:

- Original scope was the **uncommitted working tree** → leave the round's fixes uncommitted and re-run the working-tree review; it covers the original change plus the fixes.
- Original scope was **committed work** (a commit or branch vs base) → commit the round's fixes first (Step 7 format), then re-review the full range including the fix commit — the same base for a branch review, or the originally reviewed commit's parent as base when a single commit was reviewed. Re-running the original mode unchanged would re-review the unfixed code and re-surface the same findings.

Stop rules:

- **A clean round is final.** Never run an extra review to confirm a clean result or to get a nicer closing line.
- **A dismissals-only round is final.** If a round changed no code (all findings dismissed), there is nothing to re-review — stop.
- **Cap at 3 review rounds.** If warranted findings keep surfacing after three rounds, stop and surface the remaining findings to the user rather than looping further.

## Step 6: Report

Summarize to the user:

```markdown
## Codex Review Summary

### Applied
- [Issue] — [What was wrong and how you fixed it]

### Dismissed
- [Finding] — [Why it was dismissed: false positive / already tested / style preference]

### No Issues
- [Categories that were clean]
```

## Step 7: Commit — leave a dedicated codex-review commit as proof

A codex review that gates a PR must leave **one dedicated, single-purpose commit** on the branch: an auditable record that the review ran. That commit's SHA is the proof the PR-template codex-review checkbox references (see the `pull-requests` skill's [Codex-review checklist item](../pull-requests/SKILL.md#codex-review-checklist-item)) — the checkbox is never checked without it. A clean review is not exempt: "no findings" is itself a result worth recording, so it still gets a commit.

**Committed-work scope** (a commit or branch vs base):

- **Fixes were applied** — commit them separately so each review round stays traceable in git history. List only the **implemented** changes in the message; keep dismissed findings and their rationale in the conversation for the user's reference:

  ```
  Apply codex-review feedback

  - <brief description of an applied change>
  - <brief description of another applied change>
  ```

- **No fixes applied** (a clean round, or every finding dismissed) — record an **empty proof commit** rather than skipping the commit, so a clean review still leaves a referenceable SHA:

  ```bash
  git commit --allow-empty -m "Codex review: clean, no changes"
  ```

Either way, capture the resulting short SHA (`git rev-parse --short HEAD`) — it is what the codex-review checkbox states.

**Working-tree scope** (uncommitted changes): leave the round's fixes uncommitted — they are part of the same in-progress change the user has not committed yet, and committing would sweep up unrelated work-in-progress. Only commit a working-tree review's fixes when the user explicitly asks. When such a review gates a PR, the dedicated proof commit (an empty commit as above) is made once the change is committed for the PR, so the checkbox still gets a SHA.
