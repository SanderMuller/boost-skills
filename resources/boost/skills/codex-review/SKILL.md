---
name: codex-review
description: "Requests an independent code review from OpenAI Codex CLI, critically evaluates its findings, and applies warranted fixes. Activates when: the user says /codex-review, asks for a Codex review, or wants an external AI review of changes."
metadata:
  schema-required: "^1"
---

# Codex Code Review

Run an independent code review using OpenAI Codex, then critically evaluate and apply warranted findings.

## Step 1: Determine what to review

Check what has changed:

```bash
git diff --stat HEAD
git diff --stat --staged
```

If there are uncommitted changes, review those. If the working tree is clean, review the latest commit. The exact invocation depends on the invocation mode below.

## Step 2: Run Codex review

This project's Codex invocation mode is <!--boost:conv path="codex.invocation_mode" mode="inline" fallback="plugin"-->. Follow the matching path below: `plugin` (the canonical path, default) or `bare_cli` (the opt-in fallback for environments where the plugin can't be installed).

### Plugin path (`invocation_mode: plugin`, default)

The `openai/codex-plugin-cc` plugin ships a companion script (`codex-companion.mjs`) that wraps `@openai/codex` with background queueing, project-aware diff scoping, focus-argument handling, and stable file-based result retrieval. Two pieces must both be installed:

| Piece | What it is | Install path |
|---|---|---|
| `codex-plugin-cc` plugin | Claude Code plugin that exposes `/codex:*` slash commands and ships the companion script | Marketplace install (steps below) |
| `@openai/codex` global CLI | The underlying OpenAI Codex CLI | `npm install -g @openai/codex` |

The skill never invokes `codex` directly — it calls the companion script (`codex-companion.mjs`) shipped by the plugin. The companion script wraps `codex` with the aforementioned ergonomics.

#### Plugin install

If `/codex:review` is not available in this session:

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

`/codex:setup` is the plugin's own one-time bootstrap; it confirms the companion script is reachable and walks through authentication.

#### Codex CLI install

If the companion script reports `Codex CLI is not installed`:

```bash
npm install -g @openai/codex
```

Requires a ChatGPT subscription (Free tier is sufficient) **or** an OpenAI API key. If the CLI is installed but not authenticated, the user can run `codex login` in their own terminal (suggest via `!codex login` from this session if you want the output captured here).

#### Companion script path

Resolve the latest installed copy at invocation time — version path varies as the plugin updates:

```bash
COMPANION=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1)
```

If the resolution returns nothing, the plugin is not installed — fall back to the **Plugin install** section above.

#### Invocation patterns

Pick one of four shapes depending on review scope and whether the user supplied a focus argument:

| Scope | Focus argument | Command |
|---|---|---|
| Feature branch vs base branch | None | `node "$COMPANION" review --base <base> --background` |
| Feature branch vs base branch | Yes | `FOCUS="<user input>"; node "$COMPANION" adversarial-review --base <base> --background "$FOCUS"` |
| Uncommitted working tree only | None | `node "$COMPANION" review --scope working-tree --background` |
| Uncommitted working tree only | Yes | `FOCUS="<user input>"; node "$COMPANION" adversarial-review --scope working-tree --background "$FOCUS"` |

Substitute `<base>` with the resolved base branch. Scan the configured branch patterns in declared order; the first pattern matching the current branch name wins, and its `base` field is the base:

```boost:conv
<!--boost:conv path="branches.patterns" mode="yaml" fallback="none — no branch patterns configured"-->
```

If no pattern matches (or none are configured), fall back to the default base branch <!--boost:conv path="github.default_base_branch" mode="inline" fallback="main"-->. Same resolution the `pull-requests` skill uses.

**Always quote** `FOCUS` as a shell variable — never interpolate user input directly into the command line.

Use `adversarial-review` whenever a focus argument is present; the bare `review` subcommand has no focus parameter.

#### Polling

The companion runs Codex in the background. Poll until the job leaves the `running` / `queued` state:

```bash
CODEX_TIMED_OUT=true
for i in $(seq 1 15); do
  sleep 20
  STATUS=$(node "$COMPANION" status 2>&1)
  if ! echo "$STATUS" | grep -qE "\| running \||\| queued \|"; then
    CODEX_TIMED_OUT=false
    break
  fi
  echo "Still running... ($i/15)"
done
```

15 iterations × 20 seconds = 5-minute ceiling. If the loop exits with `CODEX_TIMED_OUT=true`, the review has not completed.

**Critical:** if `CODEX_TIMED_OUT=true`, do **NOT** call `result` afterwards. The `result` subcommand returns the most recent *finished* job, which can be a stale unrelated review — applying that as if it were the current job will mix unrelated feedback into the conversation. Tell the user the review is still running and stop.

#### Retrieving results

Only when `CODEX_TIMED_OUT=false`:

```bash
node "$COMPANION" result 2>&1 || true
```

If the output mentions a file path (long reviews truncate in stdout), load the full content via the `Read` tool — don't try to scroll the truncated output.

### Bare-CLI path (`invocation_mode: bare_cli`, opt-in fallback)

For environments where the plugin can't be installed (service-account CI runners with no per-user `.claude/plugins/` cache, headless agents, locked-down environments), invoke `codex` directly. Install: `npm install -g @openai/codex`; auth: `codex login` (interactive, in the user's own terminal).

The scope flags (`--uncommitted` / `--commit` / `--base`) cannot be combined with a custom prompt — Codex runs its built-in review and picks up project context from `AGENTS.md`.

**For uncommitted changes:**
```bash
codex exec review --full-auto --uncommitted
```

**For the latest commit:**
```bash
codex exec review --full-auto --commit HEAD
```

**For changes against a base branch** (resolve `<base>` the same way as the plugin path — branch patterns first, then the default base branch):
```bash
codex exec review --full-auto --base <base>
```

Synchronous — review ties up the agent session for the full review window (typically 2-5 min). No background queueing or polling loop (those are plugin-only features). Stdout output can truncate on very long reviews; redirect to a file (`> codex-review.out`) if needed.

### Cross-cutting concerns (apply identically under both invocation modes)

- **Auth failure** — if `codex` is installed but reports an auth failure (whether surfaced by the plugin's companion script or by bare-CLI directly), leave the review unrun and surface it to the user. Don't try to authenticate on their behalf — `codex login` is interactive and binds to their session.
- **Project-specific overrides doc** — <!--boost:conv path="codex.setup_doc" mode="inline" fallback="none — the path-specific playbooks above are self-contained"-->. If a path is shown, load that file for project-specific overrides (custom auth flow, focus areas, exclusions) regardless of invocation mode. Most consumers leave it unset.
- **`pr.gates skill_invoked: codex-review` interaction** — if the codex review can't run (auth failure, plugin missing under `invocation_mode: plugin`, codex CLI missing under `invocation_mode: bare_cli`), the `pr.gates` `on_missing: stop_and_request` policy means the vendor `pull-requests` skill should leave the gate's checklist item unchecked + note the unrun-reason rather than blocking PR creation entirely.

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
