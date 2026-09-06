---
name: pull-requests
description: "Creates and manages your own GitHub PRs via the gh CLI — analyze commits, write the PR description, create, verify, request review, route by risk. Activates when: creating or opening a PR, submitting work for review, writing or updating a PR description, or when user mentions: create PR, open PR, submit for review, write PR description, update PR, pull request. NOT for applying reviewer comments — use pr-review-feedback."
argument-hint: "[PR number or target branch]"
metadata:
  boost-tags: "github"
  boost-requires: "resolve-conflicts"
  schema-required: "^1"
---

# Pull Request Management

CRUD-style management of your own pull requests with the GitHub `gh` CLI: create a PR, write its description, verify it, request review, and route the review based on risk. This skill is for authoring and updating PRs — for applying feedback from a review, use the `pr-review-feedback` skill instead.

## How to Create PRs

### Base-branch resolution

This skill resolves the PR base branch from the project's configured branch patterns:

```boost:conv
<!--boost:conv path="branches.patterns" mode="yaml"-->none — no branch patterns configured<!--boost:conv:end-->
```

Scan those patterns in declared order against the current branch name; first match wins, and its `base` field is the target base. If no pattern matches (or none are configured), the base is the default base branch <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end--> (ask the user if neither is available).

### Repository

The PR's repository is `<owner>/<repo>` where `<owner>` is <!--boost:conv path="github.owner" mode="inline"-->inferred from the git remote (`git remote get-url origin`)<!--boost:conv:end--> and `<repo>` is <!--boost:conv path="github.repo" mode="inline"-->inferred from the git remote<!--boost:conv:end-->. The `gh pr` commands below auto-detect this from the remote; the raw `gh api repos/<owner>/<repo>/...` calls need it spelled out — substitute the resolved values.

### Preflight Checklist

Before creating the PR, verify all of the following:

1. **An issue is associated with this work** — applies **only when the project's branch patterns include an `{issue_key}` placeholder** (i.e. the project links PRs to a tracker). Resolve the issue **before** naming the branch, because its key feeds the branch name, the PR title, and the template's issue reference. Determine it in this order:
   - If the current branch already carries an issue key (it matches an `{issue_key}` pattern above), use that key — done.
   - Else if the issue is already known this session (the user named it, or it is unambiguous from the conversation), use it — verify it exists (see **Verifying / creating against the tracker** below).
   - Else **ask the user with `AskUserQuestion`** — "Which issue is this PR for?" — with these options:
     1. **Name the existing issue** — the user supplies the number/key; verify it exists (see **Verifying / creating against the tracker** below).
     2. **Create one now** — create it in the project's tracker (see **Verifying / creating against the tracker** below); capture the new key/number.
     3. **Chore — no issue** — only when the project defines a no-`{issue_key}` branch pattern (e.g. `chore/{slug}`). Proceed without an issue key; the title and template issue references are then omitted.
   - Once resolved, the issue number drives steps 2–3 below.
   - If the project's branch patterns contain **no** `{issue_key}` placeholder at all, skip this step — the project does not link PRs to issues.
2. **The current branch matches one of the configured branch patterns above** (if any). Resolve the base per **Base-branch resolution** above.
   - If the current branch is named correctly but the branch has **no upstream** (never pushed): proceed.
   - If the branch is named correctly and **already has an upstream or an open PR**: proceed (PR update flow, see [How to Work on Existing PRs](#how-to-work-on-existing-prs)).
   - If the branch name does **not** match any pattern AND has no upstream: rename it with `git branch -m <new-name>`, picking a name that matches the most specific pattern that fits the work — incorporating the issue key resolved in step 1 when using an `{issue_key}` pattern (e.g. `feature/1234-add-export`).
   - If the branch name does **not** match any pattern AND has an upstream: **STOP** and ask the user to rename it manually — never auto-rename a pushed branch.
3. **The PR title will follow the configured title format** (see [PR Title](#pr-title) below).
4. **The project's PR template will be read fresh** at creation time from the configured template path (see [PR template](#pr-template) below) if the file exists — never hardcode a template.
5. **If the changes touch PHP and the project enables Rector** (`quality.rector` = <!--boost:conv path="quality.rector" mode="inline"-->false<!--boost:conv:end-->): run `vendor/bin/rector process` until it reports no changes, then run `vendor/bin/pint --dirty --format agent` (Rector's output is not style-clean — always Pint after Rector) before creating the PR. This is the same completion-time policy the `backend-quality` skill applies.
6. **Frontend changes have been eye-verified** — if the diff changes UI that renders to users (JS/TS that drives the DOM, or a server-rendered template/component), the change should have been driven and *seen* in a real browser before the PR goes up: the `frontend-quality` skill's eye-verify step, or a dedicated eye-verification flow if the project has one. Author-side gate — **advisory, not blocking**; if it was skipped, recommend eye-verifying. For visual changes, add a screenshot to the PR description (redact any sensitive or personal data first; see [PR Description](#pr-description) for how to embed it). If the eye-verify or screenshot harness can't run this session, don't silently drop it — note the deferral in the PR (why it was skipped) and recommend the author capture it before the PR reaches a human reviewer.
7. **The branch is current with its base** — sync the base in before opening the PR. Resolve the base per **Base-branch resolution** above (the matched `branches.patterns` base, else the default base branch <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end-->), then **use the `resolve-conflicts` skill** to run that merge — it owns the merge end to end (clean-tree preflight, resolution, and the post-merge verification that a conflict-free auto-merge still needs) and leaves the merge committed but unpushed. CI runs against the pushed tip, so a branch behind its base is tested against stale target code and a green run can hide a conflict or a break the merge surfaces. Push the merge before creating the PR.
8. **A mandated PR label is resolved** — applies **only when the project configures a PR-label policy** (`pr.labels`; see [PR Labels](#pr-labels) below). Decide which option applies before creation, asking the author in the step-6 batch when the evidence does not settle it. If no policy is configured, skip this step — the project mandates no label.

#### Verifying / creating against the tracker

Which tool resolves the issue depends on the key style the project's `{issue_key}` patterns use — `gh issue` only ever reads or writes **GitHub** issues, so never run it against a non-GitHub key:

- **Bare GitHub issue number** (e.g. `1234`): verify with `gh issue view <number> --json number,title,state`; create with `gh issue create --title "<title>" --body "<why>"` (add `--label` / `--assignee` / `--project` per project convention), capturing the new number from the URL it prints.
- **Jira-style key** (e.g. `HPB-1234`): verify and create through the project's Jira tooling — the read-only `mcp__<jira>__jira_get_issue` tool (substitute `<jira>` with your Jira MCP namespace <!--boost:conv path="mcp.jira" mode="inline"-->mcp-atlassian<!--boost:conv:end-->) to confirm an existing one, and the `jira-create` skill to open a new one. Do not use `gh issue` for these, nor `jira-updates` — that is a post-PR mutation flow, not a pre-PR lookup.

---

Use the `gh` CLI to create pull requests. Always use `--json <fields>` filters to keep responses small — never fetch full PR payloads when only specific fields are needed.

1. Get the current branch name from git.
2. Resolve the base branch (see **Base-branch resolution** above).
3. Analyze the commits with `git log origin/<base>..HEAD --oneline`.
4. Get the diff summary with `git diff origin/<base>...HEAD --stat` (and the full diff where more context is needed).

   Compare against the remote-tracking `origin/<base>`, not the local `<base>` branch: preflight item 7 fetched `origin/<base>` and merged it into the branch, so a stale local `<base>` would make the log and diff sweep in unrelated upstream commits. (`git fetch origin <base>` updates `origin/<base>` but not a checked-out-elsewhere local `<base>`.)
5. **Run the pre-PR gates** (see [Pre-PR Gates](#pre-pr-gates) below). If any gate fails with `on_missing: stop_and_request`, stop the PR flow and follow the gate's instruction.
6. **Resolve risk + any mandated label + ask for description direction, batching whatever questions remain into one `AskUserQuestion` call** (see [Risk Assessment](#risk-assessment-before-pr-creation), [PR Labels](#pr-labels) and [Ask the User for a Direction](#ask-the-user-for-a-direction) below). Risk handling depends on the project's model: when `pr.risk` tiers are configured the agent **scores the tier** (invoking the `assessment_skill` if set) — **no risk question is rendered**; otherwise the generic Low/Medium/High risk question is asked. A label question is rendered only when a `pr.labels` policy is configured *and* its evidence ladder left the choice uncertain. Render whichever questions remain in a single batch: the generic risk question (only when no tiers are configured) + the label question (only when unresolved) + the direction question. Drop the direction question when the user already supplied direction this turn — if that leaves nothing to ask, skip the call entirely.
7. Create the PR. If the configured PR template file (see [PR template](#pr-template)) exists, read it fresh, fill in each section, and write the body to a temp file. Then run:
   ```bash
   gh pr create --draft --base <resolved-base> \
     --title "<title>" \
     --body-file /tmp/pr-body.md
   ```
   When the project configures a PR-label policy (see [PR Labels](#pr-labels)), add `--label "<resolved-name>"` to that command, passing the option's `name` verbatim. Omit the flag entirely when no policy is configured. The vocabulary is expected to already exist in the tracker; if the create call rejects the label as unknown, report that rather than retrying without the flag (which produces an unlabelled PR under a mandate) or creating a label to match (which makes a typo permanent).

   The command prints the PR URL on success — capture the PR number from it.
8. **Post-creation verification** — immediately after the PR is created, fetch only the fields needed in a single call:
   ```bash
   gh pr view <pr-number> --json title,body,headRefName,number,url
   ```
   Then assert against the JSON:
   1. `title` matches the intended title — if wrong, patch with `gh api -X PATCH "repos/<owner>/<repo>/pulls/<pr-number>" -f title="<correct title>"`.
   2. `body` is non-empty and, when a template was used, contains the section headings present in the template when it was read — if wrong, patch with `gh api -X PATCH "repos/<owner>/<repo>/pulls/<pr-number>" -F "body=@/tmp/pr-body.md"`.
   3. `headRefName` matches the intended feature branch.
   If any assertion fails, fix it inline before continuing. Use the REST API for body/title patches rather than `gh pr edit` — `gh pr edit --body-file` hits a Projects (classic) GraphQL deprecation path in some `gh` versions.
9. **Request review** — request a reviewer on the PR (an automated reviewer if the project uses one, and/or human reviewers). Use `gh pr edit <pr-number> --add-reviewer <login>` or the project's configured review mechanism.
10. **Handle review based on risk level**:
    - **If `pr.risk` tiers are configured** (see [Risk Assessment](#risk-assessment-before-pr-creation)): route per the matched tier — a tier with `human_reviewers: 0` and no `require_codeowners` → mark ready via [Marking a PR Draft / Ready](#marking-a-pr-draft--ready) (its zero-unresolved-bot-threads precondition applies here too); a tier needing one or more human reviewers (or `require_codeowners`) → leave it a draft, request the tier's reviewers, and tell the user which approvals it needs.
    - **Otherwise** (generic assessment): **Low** → mark ready immediately via [Marking a PR Draft / Ready](#marking-a-pr-draft--ready); **Medium/High** → a human reviewer must also review, so leave it a draft and tell the user to assign one.
11. **Remove the implemented spec file — detect it, don't recall it.** When the branch implemented a spec from the project's specs directory (the `write-spec` / `implement-spec` flow), the spec has served its purpose once the PR captures the work; deleting it from memory is how specs leak onto the base branch. Skip this step entirely if the project doesn't use specs. (Resolve the spec directories from `spec.directories` when configured — <!--boost:conv path="spec.directories" mode="inline"-->specs/<!--boost:conv:end--> — otherwise derive the single directory from `spec.filename_pattern`: the literal prefix before the first `{…}` placeholder, `specs/` by default. Search **every** resolved directory; a project may keep specs in more than one, and the globs below must cover all of them. **A resolved directory that does not exist is a warning, not a silent pass** — the same drift `clean-specs` warns about. When the project keeps specs somewhere the configuration does not name, this check globs an empty path and reports nothing, which reads exactly like "no spec leaked" on a branch whose whole purpose was removing one.)
    - **List** every spec the branch changed against `origin/<base>` (the base resolved above — preflight item 7 already fetched and merged it, so it is current), **with its status letter** so a stray *deletion* of an unrelated spec is caught too, not only an added/modified/renamed one:
      ```bash
      # One pathspec pair per resolved directory — every configured directory must be
      # in the command, or a spec living in the one you left out rides along unseen.
      git diff --name-status --diff-filter=ACMRD origin/<base>...HEAD \
        -- 'specs/*.md' 'specs/**/*.md'
      # e.g. with spec.directories = [docs/specs, internal/specs]:
      #   … -- 'docs/specs/*.md' 'docs/specs/**/*.md' 'internal/specs/*.md' 'internal/specs/**/*.md'
      ```
    - **The branch's own spec** (its `{issue_key}` matches the branch's issue key, or the single spec you implemented) → unless the user chose to keep it (`implement-spec` Step 4 leaves this to the user), `git rm` it, commit the deletion, and push so the removal is part of the PR (reviewers see what was built). How it shows in the diff depends on where the spec was born: a spec **created on this branch** (the usual `write-spec` flow) that you then removed nets to **no entry at all** (the add and the delete cancel); one that already existed on `origin/<base>` shows as `D`. If the user **kept** it, it shows as `A` (born on the branch) or `M` (was on base).
    - **Every other entry is a leak** — an unrelated in-flight spec swept in by a broad `git add -A` (`A`/`M`/`R`), or an unrelated spec wrongly removed (`D`). None may ride along, but **don't discard content you might still need** getting them out: if the unwanted change is only staged/working-tree, `git restore --staged <spec>` drops it from the PR while keeping your local copy; a spec newly added on this branch → `git rm --cached <spec>` (same effect). Only when the change is already committed on the branch — its content preserved elsewhere (the real work lives on its own branch) — reset this branch's copy with `git checkout origin/<base> -- <spec>` and commit; copy the file aside first if it holds local-only edits. Never force-push to strip it.
    - **Verify** — the real invariant is that **no spec other than the branch's own** appears in the list; the branch's own may show as `D`/`A`/`M` or not at all per the case above. Re-run the command and confirm every remaining line belongs to the branch's own spec. If this runs after step 10 already marked a low-risk PR ready and the check fails, move it back to draft (`gh pr ready --undo <pr-number>`) until fixed, so a review-ready PR never carries a spec leak. Any unexpected line means a spec was left in, swept in, or wrongly deleted — fix it and re-push before review.
    - A spec that nonetheless reaches the base branch (this step skipped, or a spec swept in later) is caught post-merge by the `/clean-specs` command.

## Pre-PR Gates

This project's configured pre-PR gates:

```boost:conv
<!--boost:conv path="pr.gates" mode="yaml"-->none — no pre-PR gates<!--boost:conv:end-->
```

The gates are a typed-policy array. Each gate has a `type` discriminator dispatching to one of three closed-vocabulary handlers + an `mcp_tool` open extension. Enforce each gate in declared order. When a gate fails, the `on_missing` policy determines flow: `stop_and_request` halts PR creation; `warn` prints a warning and continues to the next gate; `skip` silently continues. Only `stop_and_request` halts the flow — subsequent gates still run under `warn` / `skip`. The gate-type reference below explains each `type`.

### Gate types

#### `type: skill_invoked`

Vendor verifies the named skill was invoked in the current conversation. Used for "must have run codex-review before opening PR" or similar in-conversation policy.

```yaml
- type: skill_invoked
  skill: codex-review
  window: since_last_code_change   # or: in_session (default)
  on_missing: stop_and_request     # default; or: warn / skip
```

- `window: in_session` — skill must have been invoked anywhere in the current conversation.
- `window: since_last_code_change` — skill must have been invoked AFTER the most recent `Edit`/`Write` tool call to a file NOT inside boost-core's managed agent paths (returned by `vendor/bin/boost paths --managed` — typically `.ai/`, `.claude/`, `.github/skills/`, `.agents/`). Editing skill files or agent-managed paths does not reset the gate.

When the gated skill is `codex-review` and the PR template carries a codex-review checkbox, satisfying the gate is not enough to tick it — the checkbox is proof-gated on the review's commit SHA. See [Codex-review checklist item](#codex-review-checklist-item).

#### `type: shell_command`

Vendor runs the named shell command and checks the exit code. Used for "must pass `composer test` before opening PR" or similar local-pass-fail policy.

```yaml
- type: shell_command
  command: composer test
  expect_exit_code: 0              # default
  on_missing: stop_and_request     # default; or: warn / skip
```

Vendor invokes the command via the Bash tool, captures exit code. Gate passes when `actual exit code == expect_exit_code`. Gate fails when: exit code differs (including command-not-found, which exits 127); the command crashes or times out; or the Bash tool returns an error invoking the command.

#### `type: mcp_tool`

Vendor invokes the named MCP tool with the declared args. Used for policy that doesn't fit the closed enum — e.g. "check Slack #qa-approval for a thumbs-up" via a host-registered MCP tool.

```yaml
- type: mcp_tool
  tool: qa-approval-check
  args: { channel: "#qa-approved", min_approvals: 1 }
  on_missing: stop_and_request     # default; or: warn / skip
```

Vendor invokes `mcp__<tool>__<...>`. If the tool needs a server-name prefix, resolve it from the project's MCP server-name mappings:

```boost:conv
<!--boost:conv path="mcp" mode="yaml"-->none — gate tools are already fully qualified<!--boost:conv:end-->
```

(e.g. a gate `tool: jira-status-check` keyed to the `jira` mapping above invokes `mcp__<jira-value>__jira-status-check`.) Gate passes when the MCP tool returns a success-shape response (no exception, no error field). Gate fails when: the tool throws an exception; the tool returns a structured error response; the tool is not available in the consumer's MCP namespace; or the args fail the tool's own validation.

### `on_missing` behavior

- `stop_and_request` (default) — halt PR creation, tell the user what's missing and how to address it (e.g. "Run `/codex-review` first, then re-run this skill").
- `warn` — print a warning but proceed with PR creation.
- `skip` — silently skip the failing gate, proceed.

### Missing-gates UX

If no pre-PR gates are configured (the gates list above resolves to "none"), the gates step is skipped silently — no enforcement, no prompt. If a project wants to add gates, tell them to declare `pr.gates` in their `boost.php`'s `->withConventions([...])` array and re-sync.

## How to Work on Existing PRs

When making changes to an existing PR you authored:

1. **Get the branch and its base** — fetch just the fields needed, no full payload:
   ```bash
   gh pr view <pr-number> --json headRefName,baseRefName
   ```
   `headRefName` is the branch to check out; `baseRefName` is the target to sync from before pushing — it is this PR's resolved base, so use it directly rather than re-deriving one.
2. **Switch to the branch**: `git checkout <branch-name>`.
3. **Pull latest changes**: `git pull origin <branch-name>`.
4. **Make the changes**: edit code, write/update tests, run the project's quality checks.
5. **Commit changes**: create meaningful commits following the project's commit conventions, once the changes pass the project's checks — see *A Commit Is a Claim Too* in the `verification-before-completion` guideline.
6. **Sync the base in before pushing**: **use the `resolve-conflicts` skill** to merge `origin/<base>` (the `baseRefName` from step 1); it handles the preflight, any conflicts, and the post-merge verification a clean merge still needs. CI runs against the pushed tip, so a branch behind its base is tested against stale target code and a green run can hide a conflict.
7. **Push to remote**: `git push origin <branch-name>`.

### Marking a PR Draft / Ready

This skill owns both directions — `gh pr ready <pr-number>` and `gh pr ready --undo <pr-number>`. No other skill calls them directly.

**Ready is a claim that reviewers are the only thing left, so it has one precondition: zero unresolved bot/self review threads.** Check before every mark-ready, including the auto-ready in create-flow step 10 (a freshly created PR has none yet — the check costs one call and catches the re-ready case):

```bash
gh api graphql \
  -F owner='{owner}' -F repo='{repo}' -F number=<NUMBER> \
  -f query='
query ($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes { isResolved comments(first: 100) { totalCount nodes { author { login } } } }
      }
    }
  }
}' --jq '{
  hasNextPage: .data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage,
  endCursor: .data.repository.pullRequest.reviewThreads.pageInfo.endCursor,
  unresolved: [.data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved | not)
    | {authors: ([.comments.nodes[].author.login] | unique),
       fetched: (.comments.nodes | length), total: .comments.totalCount}]
}'
```

If `hasNextPage` is `true`, page with `after: "<endCursor>"` and merge before judging — a truncated list hides unresolved bot threads and passes the check falsely. Likewise, an entry whose `total` exceeds `fetched` has comments you have not seen, so its author set proves nothing — page that thread's comments before judging it.

Any entry whose authors are all bots or your own login (see `pr-review-feedback` § Author Classification) blocks ready — hand it to `pr-review-feedback` to close the loop first. Unresolved **colleague** threads do not block: they are the review conversation itself. That holds regardless of the project's `review.colleague_gate` setting — this check is deliberately decoupled from it.

**Draft means work is in flight on this PR** — including a bot review thread a human took over and is still working (`pr-review-feedback` Phase 6, deferred outcome). Mark it draft for the duration and back to ready once the thread is closed.

### Finding the PR

If you only have:
- **An issue key**: `gh pr list --search "<ISSUE-KEY> in:title" --json number,headRefName,state,url` — returns slim JSON with the fields typically needed next (number to reference, branch to check out, state to gate behavior).
- **A branch name**: `gh pr list --head <branch-name> --json number,headRefName,state,url`.

## Required Information — Ask If Missing

**Always ask the user for missing information rather than guessing.**

Before creating a PR, ensure you have:

| Required                   | Ask if missing                                          |
|----------------------------|---------------------------------------------------------|
| Commits/changes to include | "Which commits or branch should I analyze for this PR?" |
| Target branch              | If the branch-pattern resolution doesn't yield one and no default base branch is configured, ask the user |

If the user hasn't provided:
- **Security implications** → Ask: "Are there any security or privacy considerations I should mention?"
- **Testing steps** → Ask: "What are the steps to test this change?"

## Ask the User for a Direction

The author knows the PR's intent in a way the diff cannot reveal — which user value matters most, which constraint forced the design, what to downplay. Before drafting any description body, ask them in their own words.

### When to ask

- **By default**, on every PR creation, batched together with the other still-open questions in the single step-6 `AskUserQuestion` render (see [Batching with the risk-level question](#batching-with-the-risk-level-question)), before drafting the body.
- **Skip** only when the user already supplied a direction in the current turn (e.g. their request was "create a PR — focus on the cross-tenant isolation, that's the headline").

### How to ask

Ask the direction as a single open-ended question with a small set of pre-filled starter options the user can pick or override with free text. Phrase it like a smart colleague asking before they start writing:

> *"In one or two sentences, what's the most important thing this PR delivers, and what should the description emphasise? (Reply 'use the diff' to leave the angle to the assistant.)"*

Offer 2–3 short starter options derived from the analysis you already did in steps 1–4 (commits, diff, any linked issue), each phrased as a candidate angle the description could take — e.g. "Frame around the new viewer-facing capability (X)", "Frame around the migration safety / rollout plan", "Frame around the performance win (~Nx faster)", "Use the diff — no specific angle". The user picks one, edits one, or types free text; the "Other" escape hatch is always present.

### How to use the answer

1. **Treat the user's input as the spine of the summary** — the opening sentence reflects their framing, not the first commit message.
2. **Reconcile against the analysis** — if the user emphasises something the diff does not back up (e.g. "focus on the security hardening" but no security-touching files changed), surface the mismatch before drafting. Never silently invent support for the framing.
3. **Stay within the [Why, Not What](#writing-the-description-why-not-what) rules** — the direction sets *what to emphasise*; it does not relax the bans on class names, file paths, commit recaps, or reviewer choreography.
4. **One-shot only** — do not loop the user through revisions of the summary afterward. Draft, create the PR, let them edit if needed.

Treat all of the following as "no direction" and fall through to diff-driven drafting (applying the Why, Not What rules): explicit "use the diff", empty/whitespace input, non-substantive replies ("idk", "whatever", "you decide"), and the `Use the diff — no specific angle` starter option.

### Batching with the risk-level question

Step 6 renders the still-open questions in a single `AskUserQuestion` call. Possible questions:

- **Question 1 — Risk level** (`header: "Risk level"`, `multiSelect: false`): asked **only** when no `pr.risk` tiers are configured — the generic `Low` / `Medium` / `High`, with your recommendation. When `pr.risk` tiers are configured, the tier is scored by the agent (per [Risk Assessment](#risk-assessment-before-pr-creation)), not asked — omit this question.
- **Question 2 — PR label** (`header: "PR label"`, `multiSelect: false`): asked **only** when a `pr.labels` policy is configured and its evidence ladder (see [PR Labels](#pr-labels)) left the choice uncertain. Use the policy's `rule` as the question text and its `options` as the choices, each `name` verbatim with its `when` as the description; mark the `on_doubt` option as the fallback for an uncertain author, and add a no-label choice when `require_exactly_one` is false. Never drop this question by picking `on_doubt` yourself.
- **Question 3 — Description direction** (`header: "PR angle"`, `multiSelect: false`): 2–3 starter framings derived from the diff/issue plus `Use the diff — no specific angle`. The user picks, edits, or uses "Other" for free text.

Order when more than one is present: risk first, label second, direction third. Render only the questions that remain open — drop Question 1 when `pr.risk` tiers are configured (tier-scored), drop Question 2 when no label policy is configured or the evidence already settled it, drop Question 3 when the user already supplied direction this turn, and skip the call entirely when none remains.

## Risk Assessment Before PR Creation

**Always assess the risk level before creating a PR.** It determines the review process (step 10). Whether risk is *asked* or *scored* depends on configuration (below): when `pr.risk` tiers are configured the agent scores the tier — no user risk question; otherwise the generic risk question is asked and batched with whatever other questions remain open in one `AskUserQuestion` call (see [Batching with the risk-level question](#batching-with-the-risk-level-question)).

<!--boost:conv path="pr.risk" mode="yaml"-->No project risk tiers configured.<!--boost:conv:end-->

**If risk tiers are configured above**, score the PR against them — invoke the project's `assessment_skill` if set (consulting its `matrix_doc`) — then apply the matched tier's `label`, request its `human_reviewers` / `require_codeowners` and `ai_reviewers`, surface any `extra` required actions, and route per that tier. This replaces the generic question below.

**Otherwise**, present a summary of the changes and ask the user to rate the risk **Low / Medium / High** with `AskUserQuestion` (include your own recommendation), based on these factors:

| Factor | What to consider |
|--------|-----------------|
| **Security** | Auth changes, permission logic, input handling, data exposure |
| **Dependencies** | New packages, version upgrades, removed dependencies |
| **Database migrations** | Schema changes, column modifications, index changes |
| **Data migrations** | Existing data transformations, backfills, data format changes |
| **Non-reversible actions** | Destructive operations, external API calls, sent notifications |

Weigh each factor as **residual** risk — what remains after the checks that run on every change (the test suite, CI, any staging/QA verification, and reviewers) — not raw impact in isolation. A failure that is loud, reproducible, and instantly reversible (a broken button, a failed build, a wrong label) is caught and rolled back, so it ranks lower than one the checks can't see: silent data corruption, a confidentiality leak, or an irreversible action (sent emails, charged cards, destroyed data). Score the change's actual behaviour, not the sensitivity of the file it sits in — a narrow, well-tested change on a shared path is not automatically high risk.

- **Low**: Purely additive, isolated, no security or data impact — and any failure would be loud and reversible, caught by tests / CI / QA. Author plus any automated review is sufficient.
- **Medium**: Touches existing behavior, adds migrations, or affects integrations. A human reviewer should review.
- **High**: Security-sensitive, silent or hard-to-detect, data-migrating, or non-reversible. A human reviewer **must** review.

## PR Labels

Some projects mandate a label on every PR, drawn from a fixed vocabulary and chosen by a question the diff cannot answer. This project's policy:

```boost:conv
<!--boost:conv path="pr.labels" mode="yaml"-->No project PR-label policy configured.<!--boost:conv:end-->
```

**If no policy is configured above, there is no label step.** Skip the rest of this section, add no `--label` flag, and never invent a label.

**If a policy is configured**, resolve the label before the PR is created (preflight item 8) and pass it to `gh pr create` (step 7).

This is independent of `pr.risk`. A tier's own `label` is risk-routing metadata applied by tier score; this slot is an author-declared policy. A project may configure either, both, or neither — with both, a PR carries both labels.

### Applying the name

Apply the option's `name` **verbatim** — exact spelling, casing, spacing, and language. Never translate it, re-case it, abbreviate it, expand it, or apply a name absent from `options`. These vocabularies are typically aggregated outside the repo, where a deviating name does not fail loudly; it just stops counting, and the repo silently drops out of the aggregation.

`require_exactly_one: true` (the default) means exactly one option — never zero, never two. `false` means at most one: the label is encouraged, not mandatory, so a PR may go up without one.

Two configurations are unusable: an empty `options` list, and more than one option setting `on_doubt`. Neither is yours to repair — report the problem to the user and ask which label to apply. Do not pick one. Check both here rather than assuming the schema caught them: it rejects an empty `options` but cannot express the `on_doubt` count, and a config it does reject still renders.

### Resolving which option applies

`rule` is the question that decides it. Work down this ladder and stop at the first rung that settles it **with certainty**:

1. **The work happened in this session** — you have first-hand knowledge of how the change was made, so answer `rule` from that and apply the matching option. No question needed.
2. **The branch predates this session** — repository evidence (the commit history from `git log origin/<base>..HEAD`, commit trailers, commit authorship, the diff itself) is an **input**, not an answer: it establishes that something was involved, not the specific fact `rule` turns on. Read `rule_doc`, if configured, when the case is not obvious.
3. **Anything short of certain — ask the author.** Render the question in the step-6 `AskUserQuestion` batch (see [Batching with the risk-level question](#batching-with-the-risk-level-question)), offering the `options` verbatim. Under `require_exactly_one: false`, add a no-label choice — the policy allows zero, so the question must let the author say so.

`on_doubt` marks the option the **author** falls back to when *they* are uncertain. It is not a shortcut for the agent: never apply it to avoid asking. Uncertainty on your side means rung 3, not `on_doubt`.

`exempt_bot_authors: true` skips this whole section for bot-authored PRs. Resolve that from the tracker's own bot flag, never by matching author names — on GitHub, `author.is_bot` from `gh pr view --json author`. That field needs a PR to read, so it applies in the [existing-PR flow](#how-to-work-on-existing-prs); at creation time the author is whichever account `gh` is authenticated as, and the exemption bites only if that account is itself a bot.

### Enforcement

This skill applies the label; it does not enforce it. Nothing here blocks a PR that ends up unlabelled — a project needing a hard gate adds its own CI check on the PR event.

## PR Title

Follow the configured PR title format: <!--boost:conv path="pr.title_format" mode="inline"-->none configured — ask the user once per session for the desired title format<!--boost:conv:end-->. Recognized placeholders:

- `{issue_key}` — the tracker issue key. Resolved from the branch name's issue segment when the branch matches an `{issue_key}` pattern — a Jira-style key (`HPB-1234`) or a bare GitHub issue number (`1234`), whichever the project's patterns use.
- `{short_title}` — concise summary of the change, imperative mood ("Add feature" not "Added feature").

If a placeholder resolves empty (e.g. a chore branch with no issue key), the placeholder is omitted along with any now-redundant decoration around it — a single adjacent dash or `#`, and any brackets left wrapping nothing. Examples: `[HPB-XXXX] Short title` with no issue → `Short title`; `[#{issue_key}] {short_title}` → `[#1234] Add export` when resolved, or `Add export` when not.

General guidance regardless of format:
- Use imperative mood.
- Keep the title concise (aim for under 70 characters).

## PR template

The project's PR template path is <!--boost:conv path="pr.template_path" mode="inline"-->.github/pull_request_template.md<!--boost:conv:end-->. If that file exists, **read it fresh** at PR-creation time and fill in each section. Do not hardcode the template — always read the file to get the current version. If the file is absent, skip template injection.

### Codex-review checklist item

If the template contains a codex-review checklist item — a checkbox asserting an independent Codex review ran — it is **proof-gated**: a tick is a verifiable claim, not a courtesy. Only mark it `[x]` when a dedicated codex-review commit exists on the branch (the `codex-review` skill's [Step 7](../codex-review/SKILL.md#step-7-commit--leave-a-dedicated-codex-review-commit-as-proof) leaves one — the fixes commit, or an empty `Codex review: clean, no changes` commit for a clean round), and **append that commit's short SHA** to the item as the proof. Never check it without a SHA — an unreferenced tick is an unauditable claim.

```
- [x] Codex reviewed — <short-sha>
```

If the review didn't run or couldn't complete — the `pr.gates` `on_missing` case (auth failure, plugin/CLI missing) — leave it unchecked and note the unrun-reason inline, so the gap is visible rather than silently ticked:

```
- [ ] Codex reviewed — not run: <reason>
```

## PR Description

If there is no template, write a clear description that covers:
- **Summary** — 1-3 sentences. Lead with the user-facing change and the motivation, not the implementation — see [Writing the Description: Why, Not What](#writing-the-description-why-not-what).
- **Testing** — clear steps a reviewer or QA can follow to verify the change. For UI changes, note that it was eye-verified in a browser and embed a screenshot in the PR **body** (not a comment), redacting sensitive or personal data first. Commit the image as a file rather than inlining a base64 `data:` URI — common hosts (GitHub among them) strip those, so the image renders blank. In a **private** repo the usual raw hosts (`raw.githubusercontent`, gists) don't render for reviewers either — but a committed PNG referenced by its branch blob URL (`https://github.com/<owner>/<repo>/blob/<branch>/<path>.png?raw=true`) *does* render inline for authenticated repo members; the no-file fallback is to drag-drop the image into the description in the browser, which yields an inline `user-attachments` URL with nothing committed. When an approved design exists, include it alongside — design above implementation — so reviewers compare the two and a missing design is visible rather than silently skipped.
- **Security & privacy** — describe any security considerations, or state "No security implications".
- **Risk assessment** — record the agreed risk level, e.g. `**Risk assessment**: Medium`, with a short explanation of the contributing factors.

## Writing the Description: Why, Not What

A PR description is read by reviewers, future maintainers, and release-notes writers — not by people grepping for class names. The anchor is the commit-craft canon **why, not what**: the diff already says *what* changed; the description must say *why*, and what it enables. Lead with the problem solved and the user-visible behaviour change. AI tends to over-address: list everything, in fancy language, with the most words on the most obvious parts. Don't.

### How much to say about each change

| Type of change | Treatment |
|---|---|
| Obvious from the diff (rename, formatting, dependency bump with no behaviour change, file move, test added for existing code) | **Omit.** Mentioning it wastes the reviewer's time. |
| Easy to miss (deliberate behaviour tweak, renamed user-facing label, changed config default) | **One plain sentence.** No mechanism, no class names. |
| Non-obvious or risk-bearing (new model relationship, breaking API change, migration needing deploy ordering, security-sensitive path) | **Elaborate** — still plain language. Explain *why* and the *implication*, not the syntax. |

Per sentence, ask: *would the reviewer be worse off without this?* If no, cut it.

### Rules for the summary

1. **Open with the user-facing change or outcome**, not the implementation. A reviewer should recognise the feature from the first sentence without reading the diff.
2. **Name the capability**, not the moving parts.
3. **State the motivation in one clause** — what was broken, slow, missing, or risky before this change. If you can't state the motivation, you don't yet understand the PR; go back and work it out.
4. **Keep the summary to 1-3 sentences.** Longer detail belongs in the testing and security sections.

### Banned in the summary

| Don't write | Write instead |
|---|---|
| Class, trait, or method names | The feature name and what it does for the user |
| File paths or directory names | The product surface it touches (a settings page, an API endpoint, the dashboard) |
| Package names with version arrows (`foo 1.0 → 2.0`) | Why the bump matters — a security fix, a new capability, a compatibility need |
| Refactor framing ("factors out", "extracts", "consolidates") | The behaviour change the refactor enables; if there is none, say "no behaviour change" |
| Commit-by-commit recaps ("9 commits: 1. …, 2. …") | A single narrative paragraph |

### Plain language — no AI mumbo jumbo

Write like you'd describe it to a teammate over coffee. Audience by PR type: user-facing PRs must be readable by a product owner, designer, or QA without a glossary; infrastructure / migration / security PRs must be readable by another engineer not in your subsystem (subsystem terminology is fine, AI-narrator phrasing is not). Banned in the summary and other sections, even when technically accurate:

| Don't write (correct, but hard to read) | Write instead |
|---|---|
| "strengthens 13 weak tests via data-provider collapses" | "tightens 13 tests by replacing repeated assertions with a single data provider" |
| "producing a flurry of unrelated feedback toasts" | "showing several unrelated toast notifications at once" |
| "defers an unconditional transcription-service computed into the QA-only debug block" | "only loads the transcription service when the QA debug panel is open" |

- **No compound-noun stacks** ("transcription-service computed") — break into verb + object.
- **No metaphors** ("flurry of", "cascade of", "fan out to") — say what actually happens.
- **No diff-only jargon** ("computed", "selector", "reducer") unless the audience is exclusively engineers in that subsystem.

This is the same standard the `humanizer` skill applies to prose — if a description reads like an AI narrating a diff, run it through that lens before submitting.

### Keep the rest of the description signal, not noise

**Omit needless words.** Every sentence that doesn't change what a reviewer does should be cut. Do **not** pad the description with:
- **An implementation or commit summary** — reviewers can read `git log`; the description is not a changelog.
- **A `Files changed:` list** — the Files tab and `gh pr view --json files` already show this.
- **Reviewer-pass choreography** ("Pass 1 found 3 issues, Pass 2 …") — if a specific finding shaped the design, fold it into the risk or security note as a one-line rationale.
- **A blow-by-blow of quality gates** — one line is enough ("style, static analysis, and the full test suite: clean").

What *does* belong beyond the summary:
- **Risk assessment** with the specific factors that drove the rating (one line each).
- **Edge cases handled** — the notable edge cases the change covers (from the spec's Edge Cases table if a spec was implemented); write "None" when there are none.
- **Known limitations / follow-ups** the reviewer should be aware of.
- **Deferred scope** that was intentionally cut.
- **Deploy-ordering or environment requirements** that gate the merge.

### Quick test before submitting

Re-read the **whole description** and ask:
1. For user-facing PRs: would a product owner or designer understand what this delivers? For infra / migration / security PRs: would the on-call engineer understand the operational impact?
2. For user-facing PRs: could the summary be reused almost verbatim in release notes? (Skip for internal-only PRs.)
3. Does it answer *why now* — not just *what changed*?
4. Does it sound like a human, or like an AI narrating a diff? Compound-noun stacks and "flurry of"-style metaphors are a fail regardless of audience.
5. For every sentence: would the reviewer be worse off without it? If no, delete it.

If any answer is no, rewrite or cut before creating the PR.
