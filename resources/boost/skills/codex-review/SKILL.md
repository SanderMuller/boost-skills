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

If there are uncommitted changes, review those. If the working tree is clean, review the latest commit. The exact invocation depends on the invocation mode below.

## Step 2: Run Codex review

This project's Codex invocation mode is <!--boost:conv path="codex.invocation_mode" mode="inline"-->plugin<!--boost:conv:end-->. Follow the matching path below: `plugin` (the canonical path, default) or `bare_cli` (the opt-in fallback for environments where the plugin can't be installed).

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

If the resolution returns nothing, the plugin is not installed — fall back to the **Plugin install** steps earlier in this skill.

#### Preflight — start from a fresh broker before every launch

**Codex here is best-effort, not dependable — the in-house `code-review` skill is the reliable second opinion.** Two upstream `codex-plugin-cc` facts force this: the companion **hard-codes broker reuse** (`reuseExistingBroker: true` in `lib/codex.mjs`; no env or flag disables it) and **has no completion timeout**. The dominant, reproducible hang is a **stale broker session** — the reuse path reconnects to `broker.json`'s endpoint with **no liveness check**, so once that broker dies the file still points at a dead socket and every relaunch hangs at connect. `pkill` removes the process but leaves the file behind, which is exactly why kill-and-retry alone never fixes it. Clear the session each launch — a fresh broker costs a couple of seconds; a stale one hangs forever:

```bash
LIB="$(dirname "$COMPANION")/lib"

# 1. Cancel every non-terminal job by its real id from `status --json` — any kind/id shape is covered
#    (`review-…` AND multi-segment `adversarial-review-…`; a text-scraping regex truncates the latter
#    and can mis-match id-shaped tokens inside a summary).
node "$COMPANION" status --json 2>/dev/null | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{ try {
    const j=JSON.parse(s);
    [...(j.running||[]), ...(j.recent||[])]
      .filter(x => x && x.status !== "completed" && x.status !== "cancelled")
      .forEach(x => console.log(x.id));
  } catch {} })' | while read -r J; do [ -n "$J" ] && node "$COMPANION" cancel "$J" >/dev/null 2>&1 || true; done

# 2. THE LOAD-BEARING STEP: clear the per-cwd broker session via the companion's OWN path logic.
#    clearBrokerSession resolves the state dir ($CLAUDE_PLUGIN_DATA/state or $TMPDIR/codex-companion,
#    named <slug>-<sha256(realpath)[:16]>) reliably across machines — a hand-built tmp glob silently
#    no-ops for some setups.
node --input-type=module -e "import('file://$LIB/broker-lifecycle.mjs').then(m => m.clearBrokerSession(process.cwd())).catch(() => {})" 2>/dev/null || true

# 3. Kill any leftover broker process; the next launch spawns a fresh one from the global npm CLI.
pkill -U "$(id -u)" -f "codex app-server" 2>/dev/null || true
```

- **One attempt, then fall back — do not loop.** Run one clean review after this preflight. If the poll loop below still times out (`CODEX_TIMED_OUT=true`), treat Codex as unavailable and recover (Bare-CLI path, then in-house `code-review`). Relaunching a hung review just stacks more stuck jobs (step 1) — it never un-wedges one.
- The step-3 `pkill` is scoped to your user but drops **all** your `codex app-server` brokers — including any other in-flight Codex job — so don't run the preflight while a separate review you care about is mid-flight.
- **Trust the working dir** (one-time setup, not a per-run cause). Codex stalls on the project-trust gate *before the turn runs* if the cwd isn't a trusted project in `~/.codex/config.toml` (`[projects."<path>"]` / `trust_level = "trusted"`). Ephemeral clone paths (throwaway hashes, e.g. Polyscope clones) are **not** auto-trusted — trust the dir once. If it's already trusted and still hangs, it's the broker session, not trust.
- **Version skew is a red herring.** The fresh broker spawns from whatever `codex` is on `PATH`, so it is self-consistent regardless of any desktop-app version — chasing versions is why an earlier version of this guidance "fixed" the hang on one machine while peers still hung. Keep the CLI current as hygiene (`npm i -g @openai/codex`) if you like, but don't chase versions to explain a hang.

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
<!--boost:conv path="branches.patterns" mode="yaml"-->none — no branch patterns configured<!--boost:conv:end-->
```

If no pattern matches (or none are configured), fall back to the default base branch <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end-->. Same resolution the `pull-requests` skill uses.

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

**Critical:** if `CODEX_TIMED_OUT=true`, the plugin hung (see "Why the plugin can hang" below). Do **NOT** call `result` afterwards — it returns the most recent *finished* job, which can be a stale unrelated review, and applying that as the current job mixes unrelated feedback into the conversation. Instead, clean up so the wedged broker does not poison the next run, then fall back — never leave the user blocked on a hung job:

```bash
LIB="$(dirname "$COMPANION")/lib"
# Cancel every non-terminal job (real ids from --json, any kind shape), then clear the dead-socket
# pointer — same load-bearing clearBrokerSession the preflight uses; cancel + pkill alone leave broker.json behind.
node "$COMPANION" status --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);[...(j.running||[]),...(j.recent||[])].filter(x=>x&&x.status!=="completed"&&x.status!=="cancelled").forEach(x=>console.log(x.id));}catch{}})' | while read -r J; do [ -n "$J" ] && node "$COMPANION" cancel "$J" >/dev/null 2>&1 || true; done
node --input-type=module -e "import('file://$LIB/broker-lifecycle.mjs').then(m => m.clearBrokerSession(process.cwd())).catch(() => {})" 2>/dev/null || true
pkill -U "$(id -u)" -f "codex app-server" 2>/dev/null || true
```

Then get the second opinion another way, in order of preference:

1. **Re-run via the Bare-CLI path** (below). It is synchronous with no broker / `turn/completed` dependency, so it is immune to this hang — the preferred recovery, and it usually just works. **Match the original review scope**: `codex exec review --uncommitted` if the timed-out run was a working-tree review, or `codex exec review --base <base>` if it was a branch-vs-base review. Recovering with the wrong scope (e.g. `--base` after a working-tree run) silently reviews the wrong diff — dropping the uncommitted changes the original pass was meant to cover.
2. If the CLI itself cannot run (auth failure, capacity, not installed), **fall back to the in-house `code-review` skill** for second-opinion coverage and tell the user Codex was unavailable.

#### Retrieving results

Only when `CODEX_TIMED_OUT=false`:

```bash
node "$COMPANION" result 2>&1 || true
```

If the output mentions a file path (long reviews truncate in stdout), load the full content via the `Read` tool — don't try to scroll the truncated output.

#### Why the plugin can hang

The companion ends a review by awaiting a root-thread `turn/completed` notification with **no wall-clock or idle timeout**. The codex app-server protocol has no at-least-once delivery or replay, so a single dropped `turn/completed` — from a broker/proxy disconnect or a payload shape the matcher misses — leaves the companion waiting **forever** (on `cancel` it logs `thread not found` because the turn actually finished server-side). Large diffs lengthen the turn and widen the window for a dropped event.

**Real-world triggers, observed and verified:** the dominant, reproducible one is a **stale broker session** — the reuse path (hard-coded `reuseExistingBroker: true`, no env disables it) reconnects to `broker.json`'s endpoint with **no liveness check** (the spawn path's `ensureBrokerSession` *does* probe; the bug is that reuse skips it), and `pkill` leaves the file behind, so every relaunch hangs at connect until the session is cleared. Secondary: stale jobs queued ahead of new ones (bare `cancel` releases only the latest; match any job-id shape, not the `review-` prefix). Residual: a genuine thread-start stall from a fully clean slate (the upstream no-timeout dropped-event bug). **Version skew is not a real trigger** — the fresh broker spawns from the global npm CLI, self-consistent regardless of the desktop app. This is an upstream `codex-plugin-cc` bug we cannot fix from the skill (reuse should liveness-check; the completion wait should have a timeout). The guards: clear the broker session via `clearBrokerSession` every launch (**Preflight**), a **one-attempt** budget, and the **Polling-step fallback** (cancel all jobs + clear the session + switch to the Bare-CLI path, then in-house `code-review`). Codex is best-effort here — never block delivery on it.

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

Synchronous — review ties up the agent session for the full review window (typically 2-5 min). No background queueing or polling loop (those are plugin-only features). Because it has no broker or `turn/completed` dependency, this path is **immune to the plugin hang** — it is the recommended recovery when a `plugin`-mode review times out. Stdout output can truncate on very long reviews; redirect to a file (`> codex-review.out`) if needed.

### Cross-cutting concerns (apply identically under both invocation modes)

- **Auth failure** — if `codex` is installed but reports an auth failure (whether surfaced by the plugin's companion script or by bare-CLI directly), leave the review unrun and surface it to the user. Don't try to authenticate on their behalf — `codex login` is interactive and binds to their session.
- **Capacity / transient failures** — if the review fails on model capacity, rate limiting, or a transient error, retry the same command a few times with the same engine and model. Never substitute a different review engine or fall back to reviewing the code yourself under this skill's name — the whole value here is the independent second opinion. If retries keep failing, leave the review unrun and surface it to the user.
- **Project-specific overrides doc** — <!--boost:conv path="codex.setup_doc" mode="inline"-->none — the path-specific playbooks above are self-contained<!--boost:conv:end-->. If a path is shown, load that file for project-specific overrides (custom auth flow, focus areas, exclusions) regardless of invocation mode. Most consumers leave it unset.
- **`pr.gates skill_invoked: codex-review` interaction** — if the codex review can't run (auth failure, plugin missing under `invocation_mode: plugin`, codex CLI missing under `invocation_mode: bare_cli`), the `pr.gates` `on_missing: stop_and_request` policy means the vendor `pull-requests` skill should leave the gate's checklist item unchecked + note the unrun-reason rather than blocking PR creation entirely.

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

## Step 7: Commit (if changes were applied)

This step applies when the reviewed scope was **committed work** (a commit or branch vs base): commit the applied fixes separately so each review round stays traceable in git history. When the reviewed scope was the **uncommitted working tree**, leave the fixes uncommitted — they are part of the same in-progress change the user has not committed yet, and committing would sweep up unrelated work-in-progress. Only commit a working-tree review's fixes when the user explicitly asks.

Only list the **implemented** changes in the commit message — keep dismissed findings and their rationale in the conversation for the user's reference:

```
Apply codex-review feedback

- <brief description of an applied change>
- <brief description of another applied change>
```

If no fixes were applied (all findings were dismissed), do not create a commit — just report the outcome so the user knows.
