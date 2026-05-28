---
name: codex-review
description: "Requests an independent code review from OpenAI Codex CLI, critically evaluates its findings, and applies warranted fixes. Activates when: the user says /codex-review, asks for a Codex review, or wants an external AI review of changes."
metadata:
  schema-required: "^1"
---

# Codex Code Review

Run an independent code review using OpenAI Codex, then critically evaluate and apply warranted findings.

## Project Conventions slots

This skill reads the following slots from the `## Project Conventions` block in `CLAUDE.md`:

| Slot | Used for | If missing |
|---|---|---|
| `$.codex.invocation_mode` | Selects invocation path: `plugin` (companion script) or `bare_cli` (`codex` directly) | Default `plugin` per schema |
| `$.codex.setup_doc` | Path to project-owned doc with install + auth + project-specific invocation patterns | Reference the upstream install paths inline (plugin marketplace add, or `npm install -g @openai/codex`) |

The Project Conventions block validates against `sandermuller/boost-skills`'s `conventions-schema.json` v1; `vendor/bin/boost validate` flags missing-required slots before they surface here.

## Step 1: Determine what to review

Check what has changed:

```bash
git diff --stat HEAD
git diff --stat --staged
```

If there are uncommitted changes, review those (`--uncommitted`). If the working tree is clean, review the latest commit (`--commit HEAD`).

## Step 2: Run Codex review

The invocation path depends on `$.codex.invocation_mode`. Plugin is the default + canonical path; bare CLI is the opt-in fallback for environments where the plugin can't be installed.

### Plugin path (`invocation_mode: plugin`, default)

The `openai/codex-plugin-cc` plugin ships a companion script (`codex-companion.mjs`) that wraps the underlying `@openai/codex` CLI with background queueing, project-aware diff scoping, focus-argument handling, and stable file-based result retrieval. Install both pieces per `$.codex.setup_doc` (if declared) or upstream-canonical:

- Plugin: `/plugin marketplace add openai/codex-plugin-cc` (Claude Code marketplace install) + one-time `/codex:setup` auth walkthrough.
- Underlying CLI: `npm install -g @openai/codex`.

Companion script path is resolved by the plugin; consult `$.codex.setup_doc` for the project-specific invocation patterns + paths.

Common invocations through the companion script (substitute `<companion>` with the resolved path from `$.codex.setup_doc`):

```bash
# Review uncommitted changes (background mode)
<companion> review --uncommitted --background

# Review the latest commit
<companion> review --commit HEAD --background

# Review against a base branch
<companion> review --base main --background

# Adversarial / focused review
<companion> adversarial-review <focus-string> --background
```

After kicking off a background review, poll for completion + retrieve the result:

```bash
<companion> status            # poll loop until terminal (typically 2-5 min)
<companion> result            # reads from a stable file, no stdout truncation
```

The polling loop typically completes in 2-5 minutes for non-trivial diffs. The companion script handles auth refresh + result-file rotation transparently.

### Bare-CLI path (`invocation_mode: bare_cli`, opt-in fallback)

For environments where the plugin can't be installed (service-account CI runners with no per-user `.claude/plugins/` cache, headless agents, locked-down environments), invoke `codex` directly. Install: `npm install -g @openai/codex`; auth: `codex login` (interactive).

The scope flags (`--uncommitted` / `--commit` / `--base`) cannot be combined with a custom prompt — Codex runs its built-in review and picks up project context from `AGENTS.md`.

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

Synchronous — review ties up the agent session for the full review window (typically 2-5 min). Stdout output can truncate on very long reviews; redirect to a file (`> codex-review.out`) if needed.

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
