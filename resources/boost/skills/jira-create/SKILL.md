---
name: jira-create
description: "Creates a new Jira issue with a well-formed, user-facing description. Triggers: create/open/file/log a Jira issue, make a ticket, file a bug, log a task, bug report. May activate for AI-identified follow-up work, but only after the user confirms — never silently. NOT for updating existing issues or Blocked-by-Question (use jira-updates), or rework research (use jira-rework)."
metadata:
  boost-tags: "jira"
  schema-required: "^1"
---

# Jira Issue Creation

Creates a new Jira issue with a properly formatted description, via the project's configured MCP server.

**Jira MCP tool calls** in this skill use your project's MCP server mapping:

```boost:conv
<!--boost:conv path="mcp" mode="yaml" fallback="jira: mcp-atlassian"-->
```

Use the `jira` value above as the MCP server-namespace segment `<jira>`. If the rendered map has no `jira:` key (the project declared other MCP servers but not jira), default `<jira>` to `mcp-atlassian`. **The callable tool is always the fully-qualified `mcp__<jira>__jira_*`** — e.g. with `jira: mcp-atlassian`, call `mcp__mcp-atlassian__jira_create_issue`. The tool-call examples below write `mcp__<jira>__…`; substitute `<jira>` with the value above. A bare `jira_*` name is NOT a callable tool.

## When to Use This Skill

Use this skill when:
- The user explicitly asks to create / open / file / log a new Jira issue
- The user describes work to be done and asks for it to be tracked ("make a ticket for X", "log this as a bug")
- Mid-implementation, the AI identifies follow-up work that should be a separate ticket and the user agrees to file one
- The user combines creation and implementation in a single turn ("build X and also create a Jira for it") — see **Implementation-flow trigger** below

Do **NOT** use this skill for:
- Updating an existing issue's description → `jira-updates`
- Adding a Blocked-by-Question comment to an existing issue → `jira-updates`
- Researching a rework issue → `jira-rework`

## Target Project

Resolve the target project in this order:

1. If the user names a project or gives an existing issue key (`PROJ-1234` → project `PROJ`), use that project.
2. Otherwise, use the configured project key: <!--boost:conv path="jira.project_key" mode="inline" fallback="(none configured)"-->.
3. If no project key is configured and the user didn't name one, ask: "What Jira project key should new issues land in?" Use the answer for the rest of this session.

**Cross-project refusal:** cross-project mutation refusal is set to <!--boost:conv path="jira.refuse_other_projects" mode="inline" fallback="false"-->. When that is `true` and the resolved project differs from the configured key, refuse: "This project only creates issues in the configured key. To create elsewhere, set `jira.refuse_other_projects: false` in your `boost.php` conventions or use a different project's tooling."

Cross-project linking and mentions remain allowed regardless — the refusal scopes to **mutation** (create/edit) only.

## Description Format

Project-specific Jira description format doc: <!--boost:conv path="jira.description_format_doc" mode="inline" fallback="none — use the Generic description format below"-->. If a path is shown, read that file and follow its rules (voice, sections, templates) — it overrides the generic structure below.

Otherwise, use the **Generic description format**:

- **Task / feature** — `## Context` (why the work is needed), `## Goal` (a one-paragraph "done" statement), `## QA testables` (how to verify it).
- **Bug** — `## Context`, `## Goal`, `## QA testables`, plus `## Reproduction steps` and `## Expected vs actual behavior` when concrete repro information is available.

**Voice — non-technical, user-facing.** A Jira issue is read by QA, PO, designers, translators, and support — not only engineers. Describe behaviour and intent in plain terms. Keep code-level detail (class names, file paths, package decisions, refactor framing) out of Jira — that belongs in the PR description or a spec.

QA test cases use a **Preconditions → Steps → Expected** shape, written so a non-engineer can execute them. Name UI elements as the user sees them (button labels, page titles), not as code identifiers. If a "test case" can only be run by executing a unit test, reading a log, or inspecting internals, it is not a QA testable — put it in the PR description instead. If the issue has no user-visible behaviour change, say so explicitly in `## QA testables` rather than leaving QA to guess.

**Functional edge cases get their own test case.** Each edge case QA can trigger from the UI — a feature × setting combination, an interacting frontend/backend state, a boundary condition, a permission edge — is its own test-case block, never folded into the happy-path case. The `Expected` line states how the app handles it, so QA learns both that the edge exists and what correct behaviour is. Technical-only edges (retry, timeout, parallel invocation) stay in the PR description per the engineer-only filter above.

## Required Information — Ask If Missing

Before creating the issue, ensure you have:

| Required | Ask if missing |
|---|---|
| Target project | See **Target Project** above |
| Summary / title | "What should the issue title be?" |
| Issue type | If not obvious — "Is this a Task / work item or a Bug?" |
| Context / goal | If the request is too thin to fill in `## Context` and `## Goal`, ask for more detail before creating |

Issue types vary per project; `Task` and `Bug` are the common ones. Use the project's own types — if unsure which exist, ask.

Do **not** ask for assignee or priority — those have defaults (see **Defaults**).

## Defaults

| Field | Default | Override |
|---|---|---|
| `assignee` | Current user (`currentUser()`, set in step 4) | User says "assign to [email / name]" → use that identifier |
| `priority` | Unset (the project's Jira default) | Only override if the user explicitly asks |
| Status after create | The project's default created status | Auto-transitions to "In Progress" when part of an implementation flow (see below) |

## Implementation-Flow Trigger

If creation is paired with immediate implementation, transition the newly-created issue to the project's "In Progress" status as the final step.

**Trigger phrases / heuristics:**
- The same user turn asks to build / implement / fix / add the feature alongside creating the ticket.
- The user's immediately-following turn says "now start working on it" / "implement this" AND unambiguously refers to the just-created issue.
- The user explicitly asks for the status to be "In Progress".

**Do NOT auto-transition when:**
- The user asks to "log", "file", or "track" an issue for later — backlog signals.
- The user asks to create the ticket without mentioning implementation.
- You are mid-implementation creating a follow-up ticket for deferred work.
- It is ambiguous which of several recent issues a follow-up refers to — ask instead.

When in doubt, leave the issue at its default created status and let the user transition explicitly.

## Workflow

### 1. Gather inputs

Confirm the target project (per **Target Project**), summary, issue type, and whether this is an implementation flow. Ask for clarification if `Context` or `Goal` cannot be written from the conversation so far.

### 2. Compose the description

Follow the project's description-format doc if one was shown above; otherwise the **Generic description format**.

### 3. Create the issue

Invoke the `jira_create_issue` tool (per the MCP namespace defined at the top of this skill):

```
mcp__<jira>__jira_create_issue(
    project_key: "<PROJECT>",
    summary: "<summary>",
    issue_type: "Task" | "Bug" | "<project's type>",
    description: "<composed description>",
)
```

The response contains the new issue key and URL — report both. The `assignee` is set in the next step.

### 4. Assign

`jira_create_issue`'s `assignee` field does not accept `currentUser()`, so assign with a follow-up call:

```
mcp__<jira>__jira_update_issue(
    issue_key: "<ISSUE-KEY>",
    fields: {assignee: "<identifier>"}
)
```

- Default: `<identifier>` is `"currentUser()"`.
- Override: if the user specified an assignee, use that identifier instead.
- **If this call fails** (e.g. permission error): do not abort — proceed to step 5 and flag the assignment failure in the step 6 report.

### 5. Transition (conditional)

If the implementation-flow trigger fired, transition the new issue to "In Progress":

1. Call `mcp__<jira>__jira_get_transitions(issue_key: "<ISSUE-KEY>")` and find the transition whose display name is "In Progress" (or the project's equivalent).
2. Use the **returned ID** — never hardcode transition IDs; they vary per project and Jira workflow.
3. Call `mcp__<jira>__jira_transition_issue(issue_key: "<ISSUE-KEY>", transition_id: "<returned id>")`.

**If no matching transition is returned** (the workflow restricts the path, or the issue is already In Progress): stop and ask the user how to proceed. Do not pick a different transition.

**If the transition call fails:** report it in step 6; do not retry blindly.

### 6. Report

Tell the user:
- The new issue key and URL
- Final assignee and status as actually observed (re-fetch with `jira_get_issue` if any step partially failed)
- Any partial failure from step 4 or step 5
- Whether any follow-up action is expected

## Do Not

- Do **not** set a priority unless the user explicitly asks.
- Do **not** write post-implementation content (a description of what shipped, translation strings) — that is `jira-updates`' job after a PR exists.
- Do **not** create the issue silently — confirm the project, issue type, and summary with the user first, unless the request is already unambiguous.
- Do **not** put engineering-only sections (`## Proposed design`, `## Implementation plan`, `## Technical notes`) in the Jira description — that belongs in the PR or a spec.
