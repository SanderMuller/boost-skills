---
name: jira-updates
description: "Updates a Jira issue's description after its PR is created, and posts Blocked-by-Question comments. Invoke after creating a PR for a Jira issue. Triggers: PR just created for Jira issue, jira update, testables, QA checklist, translation strings, blocker comment, blocked by question. NOT for new issues (use jira-create) or rework research (use jira-rework)."
metadata:
  boost-tags: "jira"
  schema-required: "^1"
---

# Jira Issue Updates

Appends post-implementation content to an existing Jira issue after its PR is created, or posts a Blocked-by-Question comment during implementation.

**Jira MCP tool calls** in this skill use your project's configured Jira MCP server namespace. The tool references below are written `mcp__<jira>__jira_*` (or a bare `jira_*` for brevity); substitute `<jira>` with the namespace <!--boost:conv path="mcp.jira" mode="inline" fallback="mcp-atlassian"-->. The actual call is always the fully-qualified `mcp__<jira>__jira_*` — e.g. with the namespace `mcp-atlassian`, `mcp__mcp-atlassian__jira_get_issue`. A bare `jira_*` name is NOT a callable tool.

**Project scope:** the configured project key is <!--boost:conv path="jira.project_key" mode="inline" fallback="(none — skip the prefix check)"-->; cross-project refusal is <!--boost:conv path="jira.refuse_other_projects" mode="inline" fallback="false"-->. When refusal is `true` and the issue key's prefix differs from the configured key, refuse the update and tell the user.

## When to Use This Skill

Use this skill when:
- A PR has just been created for an existing Jira issue — append what shipped and transition the status.
- Applying PR feedback to an already-updated issue — merge the new content without dropping existing content.
- Adding a Blocked-by-Question comment when implementation needs a stakeholder decision.

Do **NOT** use this skill for:
- Creating a new Jira issue → `jira-create`
- Researching a rework issue → `jira-rework`

## Statuses and Transitions

Jira statuses, transition names, and transition IDs vary per project and workflow — **never hardcode them.** Before firing any transition, call `mcp__<jira>__jira_get_transitions(issue_key: "<ISSUE-KEY>")` and pick a transition from the returned list, matched by display name. If the expected transition is not offered, do not substitute another — skip it and report.

## Description Format

Project-specific Jira description format doc: <!--boost:conv path="jira.description_format_doc" mode="inline" fallback="none — use the conventions below"-->. If a path is shown, read that file and follow its rules (sections, voice, append/merge); it overrides the conventions below.

**Voice — non-technical, user-facing.** The description is read by QA, PO, designers, translators, and support. Translate every code change into what a user, admin, QA, or translator sees. Code identifiers (class names, file paths, package names) do not belong in Jira.

## Available Tools

The Jira MCP server (the namespace segment defined at the top of this skill) provides these tools — invoke each as `mcp__<segment>__<tool>`:

| Tool | Use for |
|---|---|
| `jira_get_issue` | Fetch current issue details before updating |
| `jira_update_issue` | Update the issue description / assignee |
| `jira_add_comment` | Post a Blocked-by-Question comment |
| `jira_get_transitions` | Read valid transitions for an issue |
| `jira_transition_issue` | Fire a status transition |

Always fetch the issue first with `mcp__<jira>__jira_get_issue` before any mutation.

## Required Information — Ask If Missing

| Required | Ask if missing |
|---|---|
| Jira issue key | "Which Jira issue should I update?" |
| PR or commit range | "Which PR or commit range contains the changes to document?" A branch name alone is not enough — branches are mutable; lock to a PR number or a `git log` range. |

For the Blocked-by-Question sub-workflow, also confirm the one-line blocker question and the decision type (technical / UX / PO) so the right person can be mentioned.

## Workflow — Post-PR Update

### 1. Fetch the issue

```
mcp__<jira>__jira_get_issue(issue_key: "<ISSUE-KEY>")
```

Capture the current description — it may already contain content from `jira-create` or a prior update.

### 2. Analyze the changes

- Read the PR / commits to understand what shipped.
- If the change adds or edits user-facing copy or translation strings, note each one and where it appears.
- From the diff, identify what users can now do and what QA needs to verify.
- **If the PR has no user-visible behaviour change** (internal refactor, tooling, test cleanup): say so explicitly — open the QA section with a line such as "No manual QA required." and give a one-line description of what shipped behind the scenes. Silence routes the ticket to QA's queue with no instructions.
- **If the PR also fixes a user-visible bug**, lead the description with that fix — do not bury it under cleanup framing.

### 3. Compose the update

Document:
- **What shipped** — a user-facing description of the change.
- **Translation / copy strings** — when copy was added or changed, list each one: the key, the suggested text, and where it appears (name the screen / button / email, not the source file).
- **QA testables** — reproduction steps a non-engineer can execute. Each case: a friendly name, a `Preconditions:` line, numbered `Steps:`, and an `Expected:` outcome. Name UI elements as the user sees them. Investigate the gates around the changed code (permissions, feature flags, settings) and state them in the preconditions. A "test case" that can only be run via a unit test or by inspecting internals is not a QA testable — leave it out. **Functional edge cases are required test cases:** for each edge case the PR introduces that QA can trigger from the UI — a feature × setting combination, an interacting frontend/backend state, a boundary condition, a permission edge — emit a dedicated block whose `Expected:` line states how the app handles it, so QA knows the edge exists and what correct behaviour is. Technical-only edges (retry, timeout, parallel invocation) stay out of Jira per the engineer-only filter.

### 4. Merge into the existing description

`jira_update_issue` **replaces the whole description**, so the new description must include everything that should remain.

- Re-include any existing sections (an earlier description, a translation table) — never drop them, and never replace real content with a forward reference ("see below").
- Merge new content into existing sections rather than duplicating headings — keep at most one of each heading.
- If the project's description guideline defines append/merge rules, follow them.
- If a merge is ambiguous (e.g. a non-standard heading that might be the intended anchor), stop and ask the user rather than silently duplicating.

### 5. Push the update

```
mcp__<jira>__jira_update_issue(
    issue_key: "<ISSUE-KEY>",
    fields: {description: "<merged description>"}
)
```

### 6. Transition (when applicable)

When this skill fires right after a new PR is created, transition the issue to its "in review" status — discover the transition via `jira_get_transitions` (see **Statuses and Transitions**). Do not transition when addressing a later round of feedback on an issue already in review.

### 7. Report

Tell the user the issue key and URL, what was added, the new status if transitioned, and any partial failure.

## Workflow — Blocked-by-Question Comment

Fires when implementation needs a stakeholder decision before it can continue. This adds a Jira **comment**, not a description edit, and does **not** transition the issue.

### 1. Confirm inputs

- The one-line blocker / question.
- The decision type (technical / UX / PO) — to mention the right person.
- Fetch the issue with `jira_get_issue` and confirm work is genuinely underway; if not, ask the user whether the blocker flow is the right one.

### 2. Post the comment

State the blocker clearly, mention the relevant decision-maker, and include any options already considered.

```
mcp__<jira>__jira_add_comment(
    issue_key: "<ISSUE-KEY>",
    comment: "<blocker question + context>"
)
```

**If the call fails:** report it; do not claim the comment was posted, and do not retry blindly.

### 3. Do not transition

Leave the issue in its current status so the blocker is visible but the work is not misrepresented as complete.

### 4. Report

Tell the user the comment was posted (or failed to post), who was mentioned, and that the status was deliberately left unchanged.

## Do Not

- Do **not** drop or blindly overwrite existing description content — merge and extend.
- Do **not** hardcode transition IDs — always discover them via `jira_get_transitions`.
- Do **not** silently create duplicate headings — if a merge is ambiguous, stop and ask.
- Do **not** create new Jira issues — that's `jira-create`.
- Do **not** transition on a Blocked-by-Question.
