---
name: pull-requests
description: "Creates and manages your own GitHub PRs via the gh CLI — analyze commits, write the PR description, create, verify, request review, route by risk. Activates when: creating or opening a PR, submitting work for review, writing or updating a PR description, or when user mentions: create PR, open PR, submit for review, write PR description, update PR, pull request. NOT for applying reviewer comments — use pr-review-feedback."
argument-hint: "[PR number or target branch]"
metadata:
  boost-tags: "github"
  schema-required: "^1"
---

# Pull Request Management

CRUD-style management of your own pull requests with the GitHub `gh` CLI: create a PR, write its description, verify it, request review, and route the review based on risk. This skill is for authoring and updating PRs — for applying feedback from a review, use the `pr-review-feedback` skill instead.

## How to Create PRs

### Base-branch resolution

This skill resolves the PR base branch from the project's configured branch patterns:

```boost:conv
<!--boost:conv path="branches.patterns" mode="yaml" fallback="none — no branch patterns configured"-->
```

Scan those patterns in declared order against the current branch name; first match wins, and its `base` field is the target base. If no pattern matches (or none are configured), the base is the default base branch <!--boost:conv path="github.default_base_branch" mode="inline" fallback="main"--> (ask the user if neither is available).

### Repository

The PR's repository is `<owner>/<repo>` where `<owner>` is <!--boost:conv path="github.owner" mode="inline" fallback="inferred from the git remote (`git remote get-url origin`)"--> and `<repo>` is <!--boost:conv path="github.repo" mode="inline" fallback="inferred from the git remote"-->. The `gh pr` commands below auto-detect this from the remote; the raw `gh api repos/<owner>/<repo>/...` calls need it spelled out — substitute the resolved values.

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
5. **If the changes touch PHP and the project enables Rector** (`quality.rector` = <!--boost:conv path="quality.rector" mode="inline" fallback="false"-->): run `vendor/bin/rector process` until it reports no changes, then run `vendor/bin/pint --dirty --format agent` (Rector's output is not style-clean — always Pint after Rector) before creating the PR. This is the same completion-time policy the `backend-quality` skill applies.

#### Verifying / creating against the tracker

Which tool resolves the issue depends on the key style the project's `{issue_key}` patterns use — `gh issue` only ever reads or writes **GitHub** issues, so never run it against a non-GitHub key:

- **Bare GitHub issue number** (e.g. `1234`): verify with `gh issue view <number> --json number,title,state`; create with `gh issue create --title "<title>" --body "<why>"` (add `--label` / `--assignee` / `--project` per project convention), capturing the new number from the URL it prints.
- **Jira-style key** (e.g. `HPB-1234`): verify and create through the project's Jira tooling — the read-only `mcp__<jira>__jira_get_issue` tool (substitute `<jira>` with your Jira MCP namespace <!--boost:conv path="mcp.jira" mode="inline" fallback="mcp-atlassian"-->) to confirm an existing one, and the `jira-create` skill to open a new one. Do not use `gh issue` for these, nor `jira-updates` — that is a post-PR mutation flow, not a pre-PR lookup.

---

Use the `gh` CLI to create pull requests. Always use `--json <fields>` filters to keep responses small — never fetch full PR payloads when only specific fields are needed.

1. Get the current branch name from git.
2. Resolve the base branch (see **Base-branch resolution** above).
3. Analyze the commits with `git log <base>..HEAD --oneline`.
4. Get the diff summary with `git diff <base>...HEAD --stat` (and the full diff where more context is needed).
5. **Run the pre-PR gates** (see [Pre-PR Gates](#pre-pr-gates) below). If any gate fails with `on_missing: stop_and_request`, stop the PR flow and follow the gate's instruction.
6. **Resolve risk + ask for description direction, batching whatever questions remain into one `AskUserQuestion` call** (see [Risk Assessment](#risk-assessment-before-pr-creation) and [Ask the User for a Direction](#ask-the-user-for-a-direction) below). Risk handling depends on the project's model: when `pr.risk` tiers are configured the agent **scores the tier** (invoking the `assessment_skill` if set) — **no risk question is rendered**; otherwise the generic Low/Medium/High risk question is asked. Render whichever questions remain in a single batch: the generic risk question (only when no tiers are configured) + the direction question. Drop the direction question when the user already supplied direction this turn — if that leaves nothing to ask (tier-scored or no risk question, plus pre-supplied direction), skip the call entirely.
7. Create the PR. If the configured PR template file (see [PR template](#pr-template)) exists, read it fresh, fill in each section, and write the body to a temp file. Then run:
   ```bash
   gh pr create --draft --base <resolved-base> \
     --title "<title>" \
     --body-file /tmp/pr-body.md
   ```
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
    - **If `pr.risk` tiers are configured** (see [Risk Assessment](#risk-assessment-before-pr-creation)): route per the matched tier — a tier with `human_reviewers: 0` and no `require_codeowners` → mark ready with `gh pr ready <pr-number>`; a tier needing one or more human reviewers (or `require_codeowners`) → leave it a draft, request the tier's reviewers, and tell the user which approvals it needs.
    - **Otherwise** (generic assessment): **Low** → mark ready immediately with `gh pr ready <pr-number>`; **Medium/High** → a human reviewer must also review, so leave it a draft and tell the user to assign one.

## Pre-PR Gates

This project's configured pre-PR gates:

```boost:conv
<!--boost:conv path="pr.gates" mode="yaml" fallback="none — no pre-PR gates"-->
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
<!--boost:conv path="mcp" mode="yaml" fallback="none — gate tools are already fully qualified"-->
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

1. **Get the branch name only** — fetch just the field needed, no full payload:
   ```bash
   gh pr view <pr-number> --json headRefName --jq '.headRefName'
   ```
2. **Switch to the branch**: `git checkout <branch-name>`.
3. **Pull latest changes**: `git pull origin <branch-name>`.
4. **Make the changes**: edit code, write/update tests, run the project's quality checks.
5. **Commit changes**: create meaningful commits following the project's commit conventions.
6. **Push to remote**: `git push origin <branch-name>`.

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

- **By default**, on every PR creation, batched together with the risk-level question in the single step-6 `AskUserQuestion` render (see [Batching with the risk-level question](#batching-with-the-risk-level-question)), before drafting the body.
- **Skip** only when the user already supplied a direction in the current turn (e.g. their request was "create a PR — focus on the cross-tenant isolation, that's the headline").

### How to ask

Ask the direction as a single open-ended question with a small set of pre-filled starter options the user can pick or override with free text. Phrase it like a smart colleague asking before they start writing:

> *"In one or two sentences, what's the most important thing this PR delivers, and what should the description emphasise? (You can also say 'use the diff' to let me decide.)"*

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
- **Question 2 — Description direction** (`header: "PR angle"`, `multiSelect: false`): 2–3 starter framings derived from the diff/issue plus `Use the diff — no specific angle`. The user picks, edits, or uses "Other" for free text.

Order when both are present: risk first, direction second. Render only the questions that remain open — drop Question 1 when `pr.risk` tiers are configured (tier-scored), drop Question 2 when the user already supplied direction this turn, and skip the call entirely when neither remains.

## Risk Assessment Before PR Creation

**Always assess the risk level before creating a PR.** It determines the review process (step 10). Whether risk is *asked* or *scored* depends on configuration (below): when `pr.risk` tiers are configured the agent scores the tier — no user risk question; otherwise the generic risk question is asked and batched with the description-direction question in one `AskUserQuestion` call (see [Batching with the risk-level question](#batching-with-the-risk-level-question)).

<!--boost:conv path="pr.risk" mode="yaml" fallback="No project risk tiers configured."-->

**If risk tiers are configured above**, score the PR against them — invoke the project's `assessment_skill` if set (consulting its `matrix_doc`) — then apply the matched tier's `label`, request its `human_reviewers` / `require_codeowners` and `ai_reviewers`, surface any `extra` required actions, and route per that tier. This replaces the generic question below.

**Otherwise**, present a summary of the changes and ask the user to rate the risk **Low / Medium / High** with `AskUserQuestion` (include your own recommendation), based on these factors:

| Factor | What to consider |
|--------|-----------------|
| **Security** | Auth changes, permission logic, input handling, data exposure |
| **Dependencies** | New packages, version upgrades, removed dependencies |
| **Database migrations** | Schema changes, column modifications, index changes |
| **Data migrations** | Existing data transformations, backfills, data format changes |
| **Non-reversible actions** | Destructive operations, external API calls, sent notifications |

- **Low**: Purely additive, isolated, no security or data impact. Author plus any automated review is sufficient.
- **Medium**: Touches existing behavior, adds migrations, or affects integrations. A human reviewer should review.
- **High**: Security-sensitive, data migrations, or non-reversible actions. A human reviewer **must** review.

## PR Title

Follow the configured PR title format: <!--boost:conv path="pr.title_format" mode="inline" fallback="none configured — ask the user once per session for the desired title format"-->. Recognized placeholders:

- `{issue_key}` — the tracker issue key. Resolved from the branch name's issue segment when the branch matches an `{issue_key}` pattern — a Jira-style key (`HPB-1234`) or a bare GitHub issue number (`1234`), whichever the project's patterns use.
- `{short_title}` — concise summary of the change, imperative mood ("Add feature" not "Added feature").

If a placeholder resolves empty (e.g. a chore branch with no issue key), the placeholder is omitted along with any now-redundant decoration around it — a single adjacent dash or `#`, and any brackets left wrapping nothing. Examples: `[HPB-XXXX] Short title` with no issue → `Short title`; `[#{issue_key}] {short_title}` → `[#1234] Add export` when resolved, or `Add export` when not.

General guidance regardless of format:
- Use imperative mood.
- Keep the title concise (aim for under 70 characters).

## PR template

The project's PR template path is <!--boost:conv path="pr.template_path" mode="inline" fallback=".github/pull_request_template.md"-->. If that file exists, **read it fresh** at PR-creation time and fill in each section. Do not hardcode the template — always read the file to get the current version. If the file is absent, skip template injection.

## PR Description

If there is no template, write a clear description that covers:
- **Summary** — 1-3 sentences. Lead with the user-facing change and the motivation, not the implementation — see [Writing the Description: Why, Not What](#writing-the-description-why-not-what).
- **Testing** — clear steps a reviewer or QA can follow to verify the change.
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
