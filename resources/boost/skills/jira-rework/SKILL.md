---
name: jira-rework
description: "Researches a Jira issue sent back for rework: reads the issue, comments, and codebase to understand QA/UX feedback, then proposes fix options. Triggers: rework, rework issue, QA feedback, QA issue, investigate issue, research issue, UX feedback from Jira."
argument-hint: "<issue-key> e.g. PROJ-1234 [optional context]"
metadata:
  boost-tags: "jira github"
  schema-required: "^1"
---

# Jira Rework Research

Research a Jira issue that has been sent back for rework — understand the feedback, investigate the codebase, and propose options for fixing it.

**Jira MCP tool calls** in this skill use your project's MCP server mapping:

```boost:conv
<!--boost:conv path="mcp" mode="yaml" fallback="jira: mcp-atlassian"-->
```

Use the `jira` value above as the MCP server-namespace segment `<jira>`. If the rendered map has no `jira:` key (the project declared other MCP servers but not jira), default `<jira>` to `mcp-atlassian`. **The callable tool is always the fully-qualified `mcp__<jira>__jira_*`** — e.g. with `jira: mcp-atlassian`, call `mcp__mcp-atlassian__jira_get_issue`. The tool references below write `mcp__<jira>__…` or a bare `jira_*` name for brevity; the actual call is always `mcp__<jira>__jira_*`.

**Project scope:** the configured project key is <!--boost:conv path="jira.project_key" mode="inline" fallback="(none — skip the prefix check)"-->; cross-project refusal is <!--boost:conv path="jira.refuse_other_projects" mode="inline" fallback="false"-->. When refusal is `true` and the issue key's prefix differs from the configured key, refuse the rework research and tell the user.

## When to Use This Skill

Use this skill when:
- A Jira issue has been moved to a "Rework" status after QA or UX review
- QA has reported a problem that needs investigation before fixing
- A design/UX review has flagged problems with an implementation

Do NOT use for:
- Implementing a feature from scratch (use `implement-spec`)
- Applying PR review feedback before merge (use `pr-review-feedback`)
- General bug reports not tied to a Jira rework (use `bug-fixing`)

## Workflow

### Phase 1: Gather Context from Jira

1. **Fetch the Jira issue:**
   ```
   mcp__<jira>__jira_get_issue(issue_key: "<ISSUE-KEY>")
   ```
   Extract the summary and description (the original requirement), the current status and assignee, and any linked issues or parent epic.

2. **Read all comments** to find QA/UX feedback, requested changes, screenshots or reproduction steps, and clarifying discussion. **Focus on the most recent comments** — later ones often override earlier feedback.

3. **Summarize the feedback** into: the original requirement, what was implemented, what's wrong, and who raised it (QA, UX, PO — this affects the kind of fix needed).

### Phase 2: Find the Implementation

1. **Find the PR** for this issue:
   ```bash
   gh pr list --search "<ISSUE-KEY> in:title" --state all --json number,url,title,state
   ```

2. **Get state, branch, and file list:**
   ```bash
   gh pr view <number> --json state,headRefName,mergedAt,merged,files,url
   ```
   Use `gh pr diff <number>` separately if you need to read the changed code — after narrowing which files matter.

3. **Determine the PR state** — it affects the fix workflow:
   - **Merged** (`merged: true`): the code is already integrated. The fix needs a new branch off the base branch the PR targeted.
   - **Open** (`merged: false`, `state: "OPEN"`): the fix can be pushed to the existing branch.
   - **Closed, unmerged** (`merged: false`, `state: "CLOSED"`): the previous PR was abandoned — treat as not merged and start a fresh fix branch.

4. **Read the relevant code** — focus on the files most likely related to the reported issue.

### Phase 3: Investigate the Problem

Investigate using whatever inspection tools the project's stack provides — a REPL / console, schema inspection, application logs, browser or console logs for UI issues. Based on the feedback type:

- **QA bug / incorrect behaviour** — read the code paths for the reported scenario; look for logic errors, missing edge cases, or wrong conditions; check whether the test suite covers the failing scenario.
- **UX / design issue** — read the view / UI code; compare the implementation against the feedback; check for missing states (loading, empty, error); look at similar features for patterns that should have been followed.
- **Missing functionality** — compare the original requirement against what was implemented; flag whether the missing piece was part of the original spec or is a new requirement.

### Phase 4: Propose Options

Present findings and options to the developer:

```markdown
## Rework Summary: <ISSUE-KEY>

### Original Requirement
[What the feature was supposed to do]

### Feedback
[Concise summary of what QA/UX reported, with attribution]

### Root Cause
[What's actually wrong — code-level explanation with file:line references]

### Options

**Option 1: [Short description]**
- What: [the approach]
- Files: [files that would change]
- Effort: Small / Medium / Large
- Trade-offs: [downsides or considerations]

**Option 2: [Short description]**
- What: [the approach]
- Files: [files that would change]
- Effort: Small / Medium / Large
- Trade-offs: [downsides or considerations]

### Recommendation
[Which option you recommend and why]
```

For a straightforward fix with one obvious solution, a single recommendation is enough — don't force multiple options.

### After the Developer Chooses

1. **Create a fix branch** from the correct base:
   - If the original PR is **merged**, branch from the same base branch it targeted (rework is typically found on a staging / integration environment).
   - If the original PR is **open**, switch to its branch and push the fix there.
2. **Implement the fix** following the chosen approach.
3. **Update or add tests** covering the rework scenario.
4. **Run the project's code-style and quality checks** (see the `backend-quality` / `frontend-quality` skills for the relevant stack).
5. **Commit and push.**
6. If the original PR was merged, **open a new PR** referencing the Jira issue.
7. **Update Jira** if the fix changes user-facing behaviour (use the `jira-updates` skill).
8. **Transition the issue** to the appropriate review status — discover the transition via `jira_get_transitions`; never hardcode transition IDs.

## Guidelines

- **Don't start fixing immediately** — research first, propose options, let the developer decide.
- **Read the full comment thread** — later comments often clarify or override earlier feedback.
- **Consider the feedback source** — QA issues usually need exact behaviour fixes; UX issues may need design discussion first.
- **Check if it's a bug or a requirement change** — rework feedback sometimes adds new requirements that weren't in the original spec. Flag this clearly.
- **Look at the test suite** — if the current tests pass but the behaviour is wrong, the tests may need updating too.
- **Be specific about file locations** — reference exact files and line numbers when discussing the root cause.
