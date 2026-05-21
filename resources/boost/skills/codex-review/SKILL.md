---
name: codex-review
description: "Requests an independent code review from OpenAI Codex CLI, critically evaluates its findings, and applies warranted fixes. Activates when: the user says /codex-review, asks for a Codex review, or wants an external AI review of changes."
---

# Codex Code Review

Run an independent code review using OpenAI Codex CLI, then critically evaluate and apply warranted findings.

## Step 1: Determine what to review

Check what has changed:

```bash
git diff --stat HEAD
git diff --stat --staged
```

If there are uncommitted changes, review those (`--uncommitted`). If the working tree is clean, review the latest commit (`--commit HEAD`).

## Step 2: Run Codex review

Run the command matching what you're reviewing. The scope flags (`--uncommitted` / `--commit` / `--base`) cannot be combined with a custom prompt — Codex runs its built-in review and picks up project context from `AGENTS.md`.

**For uncommitted changes:**
```bash
codex exec review --full-auto --uncommitted
```

**For the latest commit:**
```bash
codex exec review --full-auto --commit HEAD
```

**For changes against a base branch:**
```bash
codex exec review --full-auto --base main
```

## Step 3: Critically evaluate findings

Codex findings are a second opinion, not gospel. You have greater context on the codebase — use it. For each finding:

1. **Is it a real bug?** — Verify by reading the code. Don't trust Codex's assessment blindly.
2. **Is it already tested?** — Check if existing tests cover the scenario.
3. **Is it a style preference?** — Skip. Don't change working code for style.
4. **Is it a false positive?** — Codex may misunderstand framework internals or the project's architecture. Verify against the actual behavior.
5. **Does it conflict with project conventions?** — Check sibling files. Established project patterns take precedence over Codex preferences.

Don't over-apply: a review that implements 2 real improvements is better than one that applies 10 questionable changes. For each finding, briefly note whether you're implementing or skipping it and why.

## Step 4: Apply warranted fixes

For findings that are genuine issues:

1. Fix the code
2. Verify with the project's tests and static analysis (see the `backend-quality` / `frontend-quality` skills for the relevant stack)

## Step 5: Report

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

## Step 6: Commit (if changes were applied)

If you applied any fixes, commit them separately so each review round stays traceable in git history. Only list the **implemented** changes in the commit message — keep dismissed findings and their rationale in the conversation for the user's reference:

```
Apply codex-review feedback

- <brief description of an applied change>
- <brief description of another applied change>
```

If no fixes were applied (all findings were dismissed), do not create a commit — just report the outcome so the user knows.