---
name: github-issue-updates
description: "Appends post-implementation content to a GitHub issue after a feature is built — a user-facing description and QA testables — and moves the issue on its project board. Activates when: updating a GitHub issue, documenting a feature for QA, writing an issue description, moving an issue's status, or when user mentions: issue update, github issue, testables, QA checklist, feature documentation."
argument-hint: "[issue number]"
metadata:
  boost-tags: "github-issues"
---

# GitHub Issue Updates

Appends post-implementation content to a GitHub issue — a user-facing description and QA testables — after a feature is built, and moves the issue on its project board. The GitHub-Issues counterpart of the `jira-updates` skill.

## When to Use This Skill

- Updating a GitHub issue with implementation details after a feature is done
- Documenting a feature for QA testing
- Writing a user-facing description for a completed change
- Moving an issue to the next status on a GitHub Projects board

## Required Information — Ask If Missing

Always ask rather than guess.

| Required | Ask if missing |
|----------|----------------|
| Issue number | "Which GitHub issue number should I update?" |
| PR or commit range | "Which PR or commit range contains the changes to document?" (a bare branch name is mutable — pin to a PR or explicit commits) |

If unclear from the code:
- **Feature behavior** — "What does the feature do from a user's perspective?"
- **Test prerequisites** — "What setup or permissions are needed to test this?"
- **Edge cases** — "Any specific edge cases QA should test?"

## Tools — the `gh` CLI

Use the `gh` CLI via Bash. `gh` operates on the current repository by default; pass `--repo <owner>/<repo>` only when working against a different one.

| Command | Use for |
|---------|---------|
| `gh issue view <number>` | Fetch issue details before updating |
| `gh issue edit <number> --body-file <file>` | Replace the issue body |
| `gh issue comment <number> --body-file <file>` | Add a comment instead of replacing the body |
| `gh issue list` | List issues with filters |

### Reading an issue

Always pass `--json` with only the fields you need — the default rendered output is verbose (title, body, every comment, reactions) and wastes context.

```bash
# Common case: title + body + labels + state
gh issue view <number> --json title,body,labels,state

# Just the body, for editing
gh issue view <number> --json body --jq '.body'

# With comments (only when the discussion is needed)
gh issue view <number> --json title,body,comments
```

### Updating the issue body — preserve existing content

**Never overwrite an existing description.** Fetch the current body first and append below it, separated by a horizontal rule.

```bash
# 1. Capture the current body
gh issue view <number> --json body --jq '.body' > /tmp/issue-body.md

# 2. Append the new content to the file, then write it back
gh issue edit <number> --body-file /tmp/issue-body.md
```

Appended structure:

```markdown
{existing description content}

---

## Description

{new user-facing description}

## Testables for QA

{test cases}
```

### Adding a comment

When the update is a discussion point rather than part of the description, comment instead of editing the body:

```bash
gh issue comment <number> --body-file /tmp/comment.md
```

## Project Board Status

If the issue is tracked on a GitHub Projects board, move it to the next status when the work warrants it (e.g. to a review or QA column once the PR is up).

**Statuses, field IDs, and option IDs vary per project — never hardcode them.** Discover everything at runtime, starting with which project the issue is on:

```bash
# 1. Which project(s) the issue is on — returns project titles + current field values
gh issue view <number> --json projectItems

# 2. The project's number, if you only have its title
gh project list --owner <owner>

# 3. The project's fields, including the Status field's option IDs
gh project field-list <project-number> --owner <owner> --format json

# 4. The item ID for this issue within the project
gh project item-list <project-number> --owner <owner> --format json \
  --jq '.items[] | select(.content.number == <issue-number>)'

# 5. Move the issue to a status (use the IDs discovered above)
gh project item-edit --project-id <id> --id <item-id> \
  --field-id <status-field-id> --single-select-option-id <option-id>
```

If the issue is not on any project board, skip this section. Match the target status by its display name from the discovered list; if the expected status is not offered, do not substitute another — skip the move and report.

## Workflow

1. **Fetch the issue** — `gh issue view` with slim `--json`.
2. **Check the existing description** — if present, preserve it; you will append.
3. **Analyze the changes** — read the commit(s) or PR to understand what was implemented.
4. **Write a user-facing description** — what users can now do, not how it was built.
5. **Write QA testables** — actionable, checkbox-format test cases.
6. **Update the issue** — append via `gh issue edit`, or comment.
7. **Move the board status** — if the issue is on a project board, discover the IDs and edit.

## Description Format

Write from the **user's perspective** — what they can do, not the implementation.

```markdown
## Description

Users can now {action}. Previously, {limitation}.

With this update:
- **{Feature}** — what it does
- **{Feature}** — what it does
- **{Important behavior}** — any key detail QA should know
```

Good vs bad:

```markdown
// BAD — implementation detail
Added a RegenerateJob with a prompt parameter and a new `used_prompt` column.

// GOOD — user-facing
Users can now regenerate an AI result they are not happy with, and add
optional feedback to steer the new attempt.
```

## QA Testables Format

```markdown
## Testables for QA

### Prerequisites
- Required setup, feature flags, or permissions

### Test Cases

**1. {Category}**
- [ ] {Action} → {expected result}
- [ ] {Edge case to verify}

**2. {Category}**
- [ ] {Action} → {expected result}
```

Each test case should be **actionable** (clear steps), state the **expected result**, and cover **happy paths**, **failure paths**, and **edge cases** (empty, error, and boundary states). Use `- [ ]` checkboxes so QA can tick them off.
