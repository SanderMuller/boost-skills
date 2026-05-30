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

## Project Conventions slots

This skill reads the following slots from your project's **Project Conventions** — declared in `boost.php` via `->withConventions([...])` and rendered into `CLAUDE.md` at sync time (requires `sandermuller/boost-core ^0.9`):

| Slot | Used for | If missing |
|---|---|---|
| `$.github.owner` | GitHub owner (user or org) for PR creation | Ask user once per session |
| `$.github.repo` | GitHub repository name | Ask user once per session |
| `$.github.default_base_branch` | Fallback base branch when no pattern matches | Default `main` per schema |
| `$.branches.patterns` | Typed array of `{pattern, base}` for branch-name → base-branch resolution | Skip pattern-matching, fall through to `$.github.default_base_branch` (or ask user if absent) |
| `$.pr.title_format` | PR title template (placeholders: `{issue_key}`, `{short_title}`) | Ask user for the title format once per session |
| `$.pr.template_path` | Path to PR template (read fresh at creation time) | Default `.github/pull_request_template.md` per schema; if file absent, skip template injection |
| `$.pr.gates` | Typed array of pre-PR gates (`skill_invoked` / `shell_command` / `mcp_tool`) | Skip the gates step entirely (no enforcement) |

Your conventions validate against `sandermuller/boost-skills`'s `conventions-schema.json` v1; `vendor/bin/boost validate` flags missing required slots.

## How to Create PRs

### Preflight Checklist

Before creating the PR, verify all of the following:

1. **The current branch matches a pattern in `$.branches.patterns`** (if declared). For each pattern in declared order, attempt to match the current branch name. First match wins; the matched pattern's `base` field is the target base branch for the PR.
   - If `$.branches.patterns` is unset or no pattern matches: target base is `$.github.default_base_branch` (or, if also unset, ask the user).
   - If the current branch is named correctly but the branch has **no upstream** (never pushed): proceed.
   - If the branch is named correctly and **already has an upstream or an open PR**: proceed (PR update flow, see [How to Work on Existing PRs](#how-to-work-on-existing-prs)).
   - If the branch name does **not** match any pattern AND has no upstream: rename it with `git branch -m <new-name>`, picking a name that matches the most specific pattern that fits the work being done.
   - If the branch name does **not** match any pattern AND has an upstream: **STOP** and ask the user to rename it manually — never auto-rename a pushed branch.
2. **The PR title will follow `$.pr.title_format`** (see [PR Title](#pr-title) below).
3. **The project's PR template will be read fresh** at creation time from `$.pr.template_path` (default `.github/pull_request_template.md`) if the file exists — never hardcode a template.

---

Use the `gh` CLI to create pull requests. Always use `--json <fields>` filters to keep responses small — never fetch full PR payloads when only specific fields are needed.

1. Get the current branch name from git.
2. Resolve the base branch via `$.branches.patterns` (see Preflight step 1).
3. Analyze the commits with `git log <base>..HEAD --oneline`.
4. Get the diff summary with `git diff <base>...HEAD --stat` (and the full diff where more context is needed).
5. **Run pre-PR gates from `$.pr.gates`** (see [Pre-PR Gates](#pre-pr-gates) below). If any gate fails with `on_missing: stop_and_request`, stop the PR flow and follow the gate's instruction.
6. **Risk assessment** — Before creating the PR, ask the user to evaluate the risk level (see [Risk Assessment](#risk-assessment-before-pr-creation) below).
7. Create the PR. If `$.pr.template_path` resolves to an existing file, read it fresh, fill in each section, and write the body to a temp file. Then run:
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
    - **Low risk**: Mark the PR as ready immediately with `gh pr ready <pr-number>`. Any automated review runs asynchronously.
    - **Medium/High risk**: A human reviewer must also review. Leave the PR as a draft and tell the user to assign a human reviewer.

## Pre-PR Gates

`$.pr.gates` is a typed-policy array. Each gate has a `type` discriminator dispatching to one of three closed-vocabulary handlers + an `mcp_tool` open extension. Vendor enforces each gate in declared order. When a gate fails, the `on_missing` policy determines flow: `stop_and_request` halts PR creation; `warn` prints a warning and continues to the next gate; `skip` silently continues. Only `stop_and_request` halts the flow — subsequent gates still run under `warn` / `skip`.

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

Vendor invokes `mcp__<tool>__<...>` (resolution per `$.mcp.*` mappings if the tool needs a server-name prefix). Gate passes when the MCP tool returns a success-shape response (no exception, no error field). Gate fails when: the tool throws an exception; the tool returns a structured error response; the tool is not available in the consumer's MCP namespace; or the args fail the tool's own validation.

### `on_missing` behavior

- `stop_and_request` (default) — halt PR creation, tell the user what's missing and how to address it (e.g. "Run `/codex-review` first, then re-run this skill").
- `warn` — print a warning but proceed with PR creation.
- `skip` — silently skip the failing gate, proceed.

### Missing-slot UX

If `$.pr.gates` is unset, the gates step is skipped silently (no enforcement, no prompt). If a project wants to add gates mid-session, tell them to declare `$.pr.gates` in their `boost.php`'s `->withConventions([...])` array and re-sync.

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
| Target branch              | If `$.branches.patterns` resolution doesn't yield one and `$.github.default_base_branch` is unset, ask the user |

If the user hasn't provided:
- **Security implications** → Ask: "Are there any security or privacy considerations I should mention?"
- **Testing steps** → Ask: "What are the steps to test this change?"

## Risk Assessment Before PR Creation

**Always ask the user to assess the risk level before creating a PR.** This determines the review process.

Present a summary of the changes, then ask the user to rate the risk as **Low**, **Medium**, or **High** based on these factors:

| Factor | What to consider |
|--------|-----------------|
| **Security** | Auth changes, permission logic, input handling, data exposure |
| **Dependencies** | New packages, version upgrades, removed dependencies |
| **Database migrations** | Schema changes, column modifications, index changes |
| **Data migrations** | Existing data transformations, backfills, data format changes |
| **Non-reversible actions** | Destructive operations, external API calls, sent notifications |

### Risk Levels

- **Low**: Purely additive changes, isolated features, no security or data impact. Author plus any automated review is sufficient.
- **Medium**: Touches existing behavior, adds migrations, or affects integrations. A human reviewer should review.
- **High**: Security-sensitive, involves data migrations, or includes non-reversible actions. A human reviewer **must** review.

### How to Ask

Use `AskUserQuestion` with:
- A brief summary of the risk factors present in the PR
- Options: Low, Medium, High
- Include your own recommendation based on the changes

## PR Title

Follow `$.pr.title_format` if set. Recognized placeholders:

- `{issue_key}` — full issue key (e.g. `HPB-1234`). Resolved from the branch name's issue segment when the branch matches a Jira-keyed pattern.
- `{short_title}` — concise summary of the change, imperative mood ("Add feature" not "Added feature").

If a placeholder resolves empty (e.g. no issue key on this branch), the placeholder and any single adjacent dash are omitted. Example: `[HPB-XXXX] Short title` with no issue → `Short title`.

If `$.pr.title_format` is unset, ask the user once per session for the desired title format.

General guidance regardless of format:
- Use imperative mood.
- Keep the title concise (aim for under 70 characters).

## PR Description

If `$.pr.template_path` resolves to an existing file, **read it fresh** at PR-creation time and fill in each section. Do not hardcode the template — always read the file to get the current version. If the file is absent, skip template injection.

If there is no template, write a clear description that covers:
- **Summary** — 1-3 sentences. Lead with the user-facing change and the motivation, not the implementation — see [Writing the Description: Why, Not What](#writing-the-description-why-not-what).
- **Testing** — clear steps a reviewer or QA can follow to verify the change.
- **Security & privacy** — describe any security considerations, or state "No security implications".
- **Risk assessment** — record the agreed risk level, e.g. `**Risk assessment**: Medium`, with a short explanation of the contributing factors.

## Writing the Description: Why, Not What

A PR description is read by reviewers, future maintainers, and release-notes writers — not by people grepping for class names. Lead with the problem solved and the user-visible behaviour change. The diff already says *what* changed; the description must say *why*, and what it enables.

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

### Keep the rest of the description signal, not noise

Do **not** pad the description with:
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

Re-read the summary and ask:
1. Would someone who doesn't read code understand what this PR delivers?
2. Could the summary be reused almost verbatim in release notes?
3. Does it answer *why now* — not just *what changed*?

If any answer is no, rewrite before creating the PR.
