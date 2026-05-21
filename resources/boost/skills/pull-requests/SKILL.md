---
name: pull-requests
description: "Creates and manages your own GitHub PRs via the gh CLI — analyze commits, write the PR description, create, verify, request review, route by risk. Activates when: creating or opening a PR, submitting work for review, writing or updating a PR description, or when user mentions: create PR, open PR, submit for review, write PR description, update PR, pull request. NOT for applying reviewer comments — use pr-review-feedback."
argument-hint: "[PR number or target branch]"
metadata:
  boost-tags: "github"
---

# Pull Request Management

CRUD-style management of your own pull requests with the GitHub `gh` CLI: create a PR, write its description, verify it, request review, and route the review based on risk. This skill is for authoring and updating PRs — for applying feedback from a review, use the `pr-review-feedback` skill instead.

## How to Create PRs

### Preflight Checklist

Before creating the PR, verify all of the following:

1. **The current branch follows the project's branch-naming convention.** Inspect existing branches and any documented conventions; ask the user if the expected pattern is unclear.
   - If the branch name does **not** match and the branch has **no upstream** (never pushed): rename it with `git branch -m <new-name>`.
   - If the branch **already has an upstream or an open PR**: **STOP** and ask the user to rename it manually — never auto-rename a pushed branch.
2. **The target (base) branch is known** — if it is unclear which branch the PR should merge into, ask the user.
3. **The PR title will follow the project's title convention** (see [PR Title](#pr-title) below).
4. **The project's PR template will be read fresh** at creation time (e.g. `.github/pull_request_template.md`) if the repository has one — never hardcode a template.

---

Use the `gh` CLI to create pull requests. Always use `--json <fields>` filters to keep responses small — never fetch full PR payloads when only specific fields are needed.

1. Get the current branch name from git.
2. Analyze the commits with `git log <base>..HEAD --oneline`.
3. Get the diff summary with `git diff <base>...HEAD --stat` (and the full diff where more context is needed).
4. **Codex review check** — If the project uses the `codex-review` skill, ensure it was run in this conversation **after the last meaningful code change**. If it was not run, or significant code changes were made since it last ran, stop the PR flow and tell the user to run a Codex review first so they stay in control of any changes before the PR is created. If the project does not use `codex-review`, skip this step.
5. **Risk assessment** — Before creating the PR, ask the user to evaluate the risk level (see [Risk Assessment](#risk-assessment-before-pr-creation) below).
6. Create the PR. If the repository has a PR template, read it fresh, fill in each section, and write the body to a temp file. Then run:
   ```bash
   gh pr create --draft --base <base> \
     --title "<title>" \
     --body-file /tmp/pr-body.md
   ```
   The command prints the PR URL on success — capture the PR number from it.
7. **Post-creation verification** — immediately after the PR is created, fetch only the fields needed in a single call:
   ```bash
   gh pr view <pr-number> --json title,body,headRefName,number,url
   ```
   Then assert against the JSON:
   1. `title` matches the intended title — if wrong, patch with `gh pr edit <pr-number> --title "..."`.
   2. `body` is non-empty and, when a template was used, contains the section headings present in the template when it was read — if wrong, patch with `gh pr edit <pr-number> --body-file /tmp/pr-body.md`.
   3. `headRefName` matches the intended feature branch.
   If any assertion fails, fix it inline before continuing.
8. **Request review** — request a reviewer on the PR (an automated reviewer if the project uses one, and/or human reviewers). Use `gh pr edit <pr-number> --add-reviewer <login>` or the project's configured review mechanism.
9. **Handle review based on risk level**:
   - **Low risk**: Mark the PR as ready immediately with `gh pr ready <pr-number>`. Any automated review runs asynchronously.
   - **Medium/High risk**: A human reviewer must also review. Leave the PR as a draft and tell the user to assign a human reviewer.

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
| Target branch              | "Which branch should this PR target?" (if unclear)      |

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

Follow the project's PR-title convention. Inspect recent merged PRs or any documented convention; ask the user if it is unclear.

- If the project tracks work in an issue tracker, include the issue key in the title.
- Use imperative mood ("Add feature" not "Added feature").
- Keep the title concise (aim for under 70 characters).

## PR Description

If the repository has a PR template, **read it fresh** (e.g. `.github/pull_request_template.md`) and fill in each section. Do not hardcode the template — always read the file to get the current version.

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
