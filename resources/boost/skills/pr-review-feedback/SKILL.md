---
name: pr-review-feedback
description: "Applies PR review feedback with critical evaluation. Activates when: applying review comments, addressing PR feedback, responding to code review, or when user mentions: review feedback, PR comments, apply feedback, address comments, reviewer feedback."
argument-hint: "[PR number]"
metadata:
  boost-tags: "github"
---

# Applying PR Review Feedback

A disciplined approach to addressing PR review comments: **evaluate first, apply selectively**, and **never auto-act on a human colleague's comments**.

## Core Principle

**Never blindly apply all feedback. And never auto-act on a human colleague's comments.**

1. Fetch the PR and its review comments
2. Filter out resolved conversations
3. **Classify each thread by author** — bot vs. human colleague
4. Critically evaluate each piece of feedback
5. **Bots**: apply/skip, reply, and resolve automatically
6. **Colleagues**: evaluate, then present findings + proposed actions to the user; let the user decide whether to apply, reply, or resolve

## Author Classification

For every unresolved thread, classify the **first comment's** `author.login`:

| Classification | Matches                                                | Auto-handling allowed?                      |
|----------------|--------------------------------------------------------|---------------------------------------------|
| **bot**        | `copilot-pull-request-reviewer`, `*[bot]`, `github-actions`, `codex` | Yes — apply/skip, reply, resolve |
| **colleague**  | Anything else (a real human GitHub username)           | **No** — discuss with user, never auto-act  |

When in doubt (ambiguous login), treat the thread as **colleague** and discuss with the user.

## When to Use This Skill

Use this skill when:
- Applying review comments on a PR
- Addressing reviewer feedback
- Responding to code review suggestions
- The user asks to "apply feedback" or "address comments"

## Workflow

### Phase 1: Gather Feedback

1. **Get PR details and unresolved review threads** via GraphQL. `gh` substitutes `{owner}`/`{repo}` from the current repository — replace only `<NUMBER>` with the PR number:
   ```bash
   gh api graphql \
     -F owner='{owner}' -F repo='{repo}' -F number=<NUMBER> \
     -f query='
   query ($owner: String!, $repo: String!, $number: Int!) {
     repository(owner: $owner, name: $repo) {
       pullRequest(number: $number) {
         headRefName
         reviewThreads(first: 100) {
           nodes {
             id
             isResolved
             isOutdated
             comments(first: 10) {
               nodes {
                 body
                 url
                 author { login }
                 path
                 line
                 diffHunk
                 createdAt
               }
             }
           }
         }
       }
     }
   }' --jq '{
     headRefName: .data.repository.pullRequest.headRefName,
     threads: [.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)]
   }'
   ```

2. **If the `threads` array is empty**, report "No unresolved review comments" and stop.

3. **Switch to the PR branch**
   - Extract branch name from `headRefName`
   - `git checkout <branch-name> && git pull origin <branch-name>`

### Phase 2: Classify and Evaluate Each Comment

**First, split threads into two buckets by author** (see Author Classification above):

- **Bot bucket** — proceed through evaluation, application, reply, and resolution automatically (Phases 3, 6).
- **Colleague bucket** — evaluate to form a recommendation, but do **not** apply, reply, or resolve. Surface every colleague thread to the user with your recommendation and let them decide (Phase 3b). The user replies/resolves themselves, or explicitly tells you to do it on their behalf.

**Handle outdated threads carefully:**
- If `isOutdated: true`, use `diffHunk`, `path`, and the current file contents to understand how the code changed
- Decide whether the feedback is now obsolete or still applicable

For each comment, ask yourself:

| Consider                                    | Action                                   |
|---------------------------------------------|------------------------------------------|
| Does it improve code quality?               | Apply it                                 |
| Does it follow the project's patterns?         | Apply it                                 |
| Is it a subjective preference?              | Consider context                         |
| Does it contradict project guidelines?      | Skip or discuss                          |
| Is it from an automated reviewer (Copilot)? | Evaluate critically - these can be wrong |

#### Common Bot False Positives

Be skeptical of automated feedback suggesting:
- **"Dead code"** — May be intentionally unused for now
- **Generic security warnings** — Verify whether a real vulnerability exists
- **"Missing type hints"** — Check if the project already has strict PHPStan rules covering this

### Phase 3: Apply Changes (Bots Only)

For each **bot** thread you deemed valid:

1. **Read the relevant file** to understand context
2. **Make the change** following the project's patterns
3. **Run code style checks** — `vendor/bin/pint --dirty --format agent`

**Do not edit any file in response to a colleague thread in this phase.** Colleague feedback goes through Phase 3b first.

### Phase 3b: Discuss Colleague Feedback With User

For every colleague thread, build a short proposal and present it to the user **before doing anything else**:

- **What the colleague said** — 1-2 line summary + link
- **Your evaluation** — valid, partially valid, contradicts conventions, subjective, blocked on missing context, etc.
- **Recommended action** — one of: apply (describe the diff), partially apply, push back with reasoning, ask clarifying question, no change
- **Draft reply** — the text you'd post if the user wants you to reply

Then ask the user, per thread, how they want to handle it:

| User says                          | You do                                                                                          |
|-------------------------------------|-------------------------------------------------------------------------------------------------|
| "apply it" / "go ahead"             | Make the code change. Do **not** auto-reply or auto-resolve — user handles the thread themselves. |
| "apply it and reply/resolve"        | Make the change, post the reply, resolve the thread.                                            |
| "skip" / "I'll handle it"           | Do nothing. Leave the thread untouched.                                                         |
| "reply with X" / "post this reply"  | Post the requested reply. Do **not** resolve unless the user also says to.                      |
| "resolve it"                        | Resolve the thread (with reply if requested).                                                   |
| Anything ambiguous                  | Ask one focused follow-up question; default to no action.                                       |

**Never** post a reply or resolve a colleague thread without an explicit instruction in the current conversation. A general "apply the feedback" at the start of the task is **not** consent to reply or resolve on the user's behalf.

### Phase 4: Verify Quality

After applying feedback, use the `backend-quality` skill (Tier 1: Pint + related tests).

**Cover what you changed with tests:**
- If the feedback was a **bug fix**, add a regression test for the scenario unless existing tests already cover it.
- If the feedback **changed behavior**, update the existing test expectations to match.
- If the feedback surfaced an **edge case** (a boundary condition, a feature/setting combination, a permission edge), add a test for that edge — an edge left untested ships as a latent bug.
- Pure style/refactor feedback needs no new tests, but existing tests must still pass.

### Phase 5: Commit and Push

If any code changes were applied (from either the bot bucket or user-approved colleague items):

1. **Stage changes**: `git add <specific-files>`
2. **Commit with descriptive message**:
   ```
   Apply PR review feedback

   - <change 1>
   - <change 2>
   ```
3. **Push to the branch**: `git push origin <branch-name>`

If no code changes were applied, skip this phase.

### Phase 6: Reply to Review Threads

Reply/resolve permissions depend on the thread's author bucket from Phase 2.

**Bot threads (applied or skipped)** — after committing and pushing, reply to each thread and resolve it, no confirmation needed:

```bash
# Reply to the thread
gh api graphql -f query='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment { url }
  }
}' -f threadId="<THREAD_ID>" -f body="<REPLY>"

# Resolve the thread
gh api graphql -f query='
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id }
  }
}' -f threadId="<THREAD_ID>"
```

**Colleague threads** — **never** auto-reply, **never** auto-resolve. The user owns these threads. Only reply or resolve when:

- The user explicitly says so in the current turn ("post that reply", "resolve thread 3", "reply and resolve all of these")
- *and* the instruction is specific enough to know which thread(s) it covers

Default to leaving colleague threads untouched on GitHub even after applying their suggested code change. The user can reply/resolve themselves once they're happy with the diff.

**Reply guidelines (when you do reply):**
- **Applied feedback**: "Fixed as suggested." or a brief note on what was changed
- **Skipped feedback**: Brief explanation of why
- **Discussion needed**: Ask a clarifying question — present planned reply to the user first

Keep replies concise. Do not repeat the reviewer's comment back to them.

## Response Template

Summarize once Phases 3 + 3b are complete. Bot items are already replied to and resolved on the PR. Colleague items are presented as proposals — the user decides next steps.

```markdown
## Bot Feedback — Applied (replied & resolved)

1. **[File]** — [bot login]
   - Comment: [Brief summary]
   - Change: [What was done]

## Bot Feedback — Skipped (replied & resolved)

1. **[File]** — [bot login]
   - Comment: [Brief summary]
   - Reason: [Why it was skipped]

## Colleague Feedback — Awaiting Your Decision

1. **[File]** — [colleague login] · [link to comment]
   - Comment: [Brief summary]
   - My evaluation: [valid / partially valid / contradicts convention / subjective / needs context]
   - Recommended action: [apply / partially apply / push back / clarifying question / no change]
   - Draft reply (if you want me to post it): "[Draft text]"

   How would you like to handle this — apply, skip, reply with something else, or resolve?
```
