---
name: pr-review-feedback
description: "Applies PR review feedback with critical evaluation, then replies to and resolves the threads. Covers automated reviewers (Copilot, CodeRabbit, etc.). Activates when applying review comments, addressing PR feedback, responding to code review, or resolving review threads — including terse and Dutch phrasings: fix comments, fix the comments, fix PR comments, fix review comments, fix comments issue 1234, resolve/mark comments resolved, verwerk de comments, comments fixen. A bare number is resolved to the PR or its linked issue (Phase 0)."
argument-hint: "[PR number]"
metadata:
  boost-tags: "github"
  boost-requires: "resolve-conflicts pull-requests"
  schema-required: "^1"
---

# Applying PR Review Feedback

A disciplined approach to addressing PR review comments: **evaluate first, apply selectively**, and **never auto-act on another human colleague's comments**.

## Core Principle

**Never blindly apply all feedback.** And, by default, **never auto-act on *another* human colleague's comments** — though your own self-review comments are fair game, and a project can opt out of the colleague gate via `review.colleague_gate` (see [Colleague gate toggle](#colleague-gate-toggle)).

1. Fetch the PR and its review comments
2. Filter out resolved conversations
3. **Classify each thread by author** — bot vs. self (you) vs. other human colleague
4. Critically evaluate each piece of feedback
5. **Bots and self**: apply or decline, reply on the thread, and resolve automatically — the one exception is a thread a human takes over (deferred, see below)
6. **Other colleagues** (default, `review.colleague_gate: true`): evaluate, then present findings + proposed actions to the user; let the user decide whether to apply, reply, or resolve. When the gate is `false`, handle them like bot threads.

**Close the loop.** Applying the code is half the job — an applied-but-unresolved thread reads as ignored to the author and re-surfaces in the next review. Every bot/self thread ends this run in exactly **one** of three states:

| Outcome | Thread reply | Resolve? | PR state |
|---|---|---|---|
| **Applied** — feedback was valid, change is made | Mandatory for bot threads — what was changed. Optional for self notes | Yes | unchanged |
| **Declined** — feedback is wrong or does not apply | Mandatory for bot threads — the reasoning. Optional for self notes | Yes | unchanged |
| **Deferred** — a human took the thread and is still working it | Mandatory — say it is being worked on | **No** — stays open | **Draft** while the work is ongoing |

**A top-level PR comment never closes a thread.** Reasoning goes as a reply *on the thread it answers* — a batched issue comment leaves the threads showing as unresolved, so the next reviewer still has to read and re-judge every one of them. That is exactly the failure this rule exists to prevent.

The skill is not done until every bot/self thread sits in one of those three states and Phase 7 confirms it.

## Author Classification

First, resolve **who you are** — the authenticated GitHub account running this skill:

```bash
gh api user --jq .login
```

Every comment author falls into one of three roles — **self** (`author.login` equals your authenticated `gh api user` login), **bot** (matches the automated-reviewer set below), or **colleague** (any other human login).

A comment author is a **bot** when `author.login` matches any of the built-in set:

- The literal string `copilot-pull-request-reviewer`
- The literal string `github-actions`
- The literal string `codex`
- A login ending in the literal four-character suffix `[bot]` (regex `\[bot\]$`) — e.g. `dependabot[bot]`, `renovate[bot]`. Note: `[bot]` is a literal suffix here, **not** a regex character class.

Plus any additional logins this project declares as automated reviewers: <!--boost:conv path="review.bot_reviewers" mode="inline"-->none — built-in set only<!--boost:conv:end-->.

These **extend** the built-in set; they do not replace it.

**Classify the thread by scanning all its comments, not just the first.** A thread is **bot/self** (auto-handled) only if **every comment** in it was authored by a bot or by you. If *any* comment — including follow-ups — was authored by another human colleague, classify the whole thread as **colleague**: a colleague jumping into your or a bot's thread is the signal that this thread now needs the user's judgement.

The "every comment" rule only holds if you actually fetched every comment. The Phase 1 query pulls `comments(first: 100)` with `totalCount`; if a thread's `totalCount` exceeds the fetched nodes (a thread with 100+ comments), you cannot prove it is all bot/self — **fail safe and classify it as colleague**, or page the remaining comments before classifying. Never treat a truncated thread as bot/self.

| Classification | Rule                                                                                            | Auto-handling allowed?                      |
|----------------|-------------------------------------------------------------------------------------------------|---------------------------------------------|
| **bot / self** | Every comment in the thread is from a bot login (built-in set + `review.bot_reviewers`) or from your own login | Yes — apply/decline, reply, resolve automatically |
| **colleague**  | At least one comment is from another human, or any login is ambiguous                           | **Gated** — when `review.colleague_gate` is `true` (default), no auto-act: discuss with user. When `false`, handle like a bot thread. |

**Self** covers the common case: you open your own PR, manually review it, leave feedback comments, then run this skill to pick them up. Those are your own notes-to-self — apply them automatically like bot feedback (still evaluating each critically).

When in doubt (ambiguous login that is neither a clear bot nor a match for your own login), treat the thread as **colleague** and discuss with the user.

### Colleague gate toggle

This project's colleague-gate setting: <!--boost:conv path="review.colleague_gate" mode="inline"-->true (default) — colleague threads are never auto-acted on<!--boost:conv:end-->.

- **`true` (default, and when unset)** — the colleague handling below applies in full: evaluate, present a recommendation, and let the user decide whether to apply, reply, or resolve. Never auto-act on a colleague thread.
- **`false`** — the project has opted into full automation: handle colleague threads the same way as bot threads (apply/decline, reply, resolve without a confirmation step). The Phase 3b discussion gate is skipped. Bot-thread handling is identical either way.

The rest of this skill describes the `true` (default) behavior; under `false`, treat every colleague thread as a bot thread for action purposes.

## When to Use This Skill

Use this skill when:
- Applying review comments on a PR
- Addressing reviewer feedback
- Responding to code review suggestions
- The user asks to "apply feedback" or "address comments"
- The user asks, tersely, to "fix the comments", "fix PR comments", or "fix comments issue 1234" — treat the number as a PR or issue ref and resolve it via Phase 0

## Workflow

### Phase 0: Resolve the PR Number

This skill operates on a **PR**, but users name the work loosely — "fix comments issue 1234" can mean PR #1234 **or** the issue #1234 whose PR you should apply feedback to. A bare number is ambiguous: it may be either the PR ID or the issue ID the PR was created for. Resolve it to a concrete PR before Phase 1:

1. **No number, but you're on the PR branch** — use the current branch's PR:
   ```bash
   gh pr view --json number,title --jq '{number, title}'
   ```
2. **A number `<N>` was given** — disambiguate, don't assume. Ask GitHub what `<N>` is (note the `if/elif`: a bare `A && echo PR || B && echo ISSUE` chain prints **both** when `<N>` is a PR):
   ```bash
   if   gh pr view    <N> --json number >/dev/null 2>&1; then echo "PR"
   elif gh issue view <N> --json number >/dev/null 2>&1; then echo "ISSUE"
   fi
   ```
   - **`<N>` is a PR** — use it directly.
   - **`<N>` is an issue** (this repo links every PR to an issue) — find the open PR for it. Prefer the one whose branch starts with the issue number, then fall back to an **explicit** issue reference in the body — never a bare-digit substring (a raw `<N>` matches version strings, dates, and stack traces, selecting the wrong PR):
     ```bash
     gh pr list --state open --json number,title,headRefName \
       --jq '[.[] | select(.headRefName | test("(^|/)'<N>'-"))]'      # branch like feature/1234-...
     # body link: server-side prefilter on the number, then keep only PRs whose body
     # carries an *explicit* reference ("#<N>" or a closing keyword, with or without "#")
     gh pr list --search 'in:body <N>' --state open --json number,title,headRefName,body \
       --jq '[.[] | select(.body | test("(#|[Cc]los(e|es|ed)|[Ff]ix(es|ed)?|[Rr]esolv(e|es|ed)) *#?'<N>'\\b"))]'
     ```
3. **Resolution check** — if exactly one PR matches, use it. If several match, or none, list the candidates and ask the user which PR to apply feedback on rather than guessing. A body-link match is weaker than a branch match — when only the body matches, confirm the PR actually targets issue `<N>` before acting.

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
         baseRefName
         reviewThreads(first: 100) {
           nodes {
             id
             isResolved
             isOutdated
             comments(first: 100) {
               totalCount
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
     baseRefName: .data.repository.pullRequest.baseRefName,
     threads: [.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)]
   }'
   ```

2. **If the `threads` array is empty**, report "No unresolved review comments" and stop.

3. **Switch to the PR branch**
   - Extract branch name from `headRefName`
   - `git checkout <branch-name> && git pull origin <branch-name>`

### Phase 1b: Sync the Branch With Its Base

Apply feedback on top of an up-to-date branch — a branch that has drifted from its base can produce changes that pass locally but conflict or break once merged. Bring the base (`baseRefName` from Phase 1) in first.

1. **Use the `resolve-conflicts` skill to run the merge.** Merging `origin/<baseRefName>` into the PR branch is that skill's whole subject: it owns the clean-tree preflight, the side-effect-free conflict probe (including the older-Git fallback), the resolution itself, and the post-merge verification a conflict-free merge still needs. Do not reimplement any of it here, and **do not force a resolution inline**. Return to this skill once the merge is committed.

2. **Details specific to this flow:**
   - The tree should already be clean straight after the Phase 1 checkout. If it is not, and the changes cannot be safely stashed (`git stash -u`) and popped after, **skip this phase** rather than blocking on it.
   - The resulting merge commit rides along with the feedback commits pushed in Phase 5. If no feedback changes end up being applied, push the sync merge on its own.
   - "Already up to date" means there is nothing to do; continue.

3. **If the merge changed any files, the Phase 1 thread snapshot no longer lines up with the working tree.** GitHub does not recompute thread positions or `isOutdated` until the merge commit is *pushed* (Phase 5), so re-running the Phase 1 query here returns the same pre-merge `path`/`line`/`diffHunk` — it cannot refresh them. Don't rely on those line numbers after the merge. In the later phases, locate each comment's target by **content** — match its `diffHunk` against the current merged file — rather than by `line`. Thread IDs are unaffected, so reply and resolve still target the right thread.

4. If the user explicitly asked to *only* apply comments and not touch the branch's history, skip this phase.

### Phase 2: Classify and Evaluate Each Comment

**First, split threads into buckets by author** (see Author Classification above):

- **Bot + self bucket** — proceed through evaluation, application, reply, and resolution automatically (Phases 3, 6). Self comments are your own self-review notes; treat them like bot feedback. Track each thread as one unit by its `id` from Phase 1 (evaluate → apply/decline → reply → resolve); a thread isn't handled until it's resolved.
- **Colleague bucket** — *other* humans. Handling depends on `review.colleague_gate` (see [Colleague gate toggle](#colleague-gate-toggle)). Under the default (`true`): evaluate to form a recommendation, but do **not** apply, reply, or resolve — surface every colleague thread to the user and let them decide (Phase 3b); the user replies/resolves themselves, or explicitly tells you to do it on their behalf. Under `false`: treat the colleague bucket exactly like the bot/self bucket (auto apply/reply/resolve), and skip Phase 3b.

**Handle outdated threads carefully:**
- If `isOutdated: true`, use `diffHunk`, `path`, and the current file contents to understand how the code changed
- Decide whether the feedback is now obsolete or still applicable
- **If Phase 1b merged the base locally, treat *every* thread's `line` as unreliable — not just `isOutdated: true` ones.** GitHub won't recompute positions until the merge is pushed (Phase 5), so a clean sync merge can shift lines while `isOutdated` stays `false`. Locate each comment's target by matching its `diffHunk` against the current merged file before applying.

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

### Phase 3: Apply Changes (Bots + Self)

For each **bot** or **self** thread you deemed valid:

1. **Read the relevant file** to understand context
2. **If the feedback is a bug or edge case, write the test first.** When a comment flags a runtime fault — a wrong type, a bad boundary condition, a feature/permission edge, a regression — add a failing test that reproduces it *before* touching the fix, then make the change so the test passes. The fix isn't done until the case is covered — don't just patch and move on. (Pure style/refactor feedback needs no test — see Phase 4 for the split.)
3. **Make the change** following the project's patterns
4. **Run code style checks** — `vendor/bin/pint --dirty --format agent`

**Do not edit any file in response to a colleague thread in this phase.** Other-colleague feedback goes through Phase 3b first.

### Phase 3b: Discuss Colleague Feedback With User

*(Skipped entirely when `review.colleague_gate` is `false` — see [Colleague gate toggle](#colleague-gate-toggle). Under that setting, colleague threads are handled like bot threads in Phase 3.)*

For every *other*-colleague thread (not bot, not self), build a short proposal and present it to the user **before taking any action on that colleague thread** (apply, reply, or resolve). This gate blocks action on the colleague thread itself, not the whole skill run — bot and self threads continue through Phase 3 in parallel. The proposal covers:

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

**Confirm every fix is covered by a test** (the test should already exist from Phase 3, step 2 — verify it here, add it now if you skipped ahead):
- If the feedback was a **bug fix**, a regression test must reproduce the bug and pass — unless existing tests already cover the scenario.
- If the feedback surfaced an **edge case** (a boundary condition, a feature/setting combination, a permission edge), a test must pin that edge down — an edge left untested ships as a latent bug.
- If the feedback **changed behavior**, update the existing test expectations to match.
- Pure style/refactor feedback needs no new tests, but existing tests must still pass.

### Phase 5: Commit and Push

If any code changes were applied (from the bot/self bucket or user-approved colleague items):

1. **Stage changes**: `git add <specific-files>`
2. **Commit with descriptive message**:
   ```
   Apply PR review feedback

   - <change 1>
   - <change 2>
   ```
3. **Push to the branch**: `git push origin <branch-name>`

If no code changes were applied **but Phase 1b created a sync merge commit**, still push it: `git push origin <branch-name>`. The branch must reach GitHub for the base sync to take effect and for thread positions to recompute. Only skip this phase entirely when there are neither feedback changes nor a pending sync merge.

### Phase 6: Reply to Review Threads

Reply/resolve permissions depend on the thread's author bucket from Phase 2.

**Bot and self threads (applied or declined)** — after committing and pushing, reply to each thread and resolve it, no confirmation needed. **For bot threads both are mandatory: a reply on the thread, then resolve it.** Post the reply on each thread individually, even when several threads share one reasoning — a single top-level PR comment covering them all does not close anything and does not count. For **self** threads (your own notes-to-self) the reply is optional; resolving without one is fine. You need each thread's `id` (from Phase 1) here — if those IDs are no longer in context, re-run the Phase 1 query to re-fetch them; never skip resolve because the IDs scrolled off.

**Bot threads the user takes over (deferred)** — when the user says they will work a bot thread themselves, or asks for more work on it than this run delivers: reply on the thread saying it is being worked on, leave it **unresolved**, and put the PR back to **draft** for the duration — via the `pull-requests` skill (Marking a PR Draft / Ready), never a raw `gh` call. A ready PR with open threads tells reviewers the work is waiting on them; draft tells the truth. Record which threads were deferred — Phase 7 needs them. Once the user replies on that thread on GitHub it re-classifies as **colleague** on the next run (Author Classification wins, unchanged) and is theirs to close — that is the intended hand-off, not a rule you have escaped.

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

**Colleague threads (other humans)** — handling depends on `review.colleague_gate` (see [Colleague gate toggle](#colleague-gate-toggle)):

- **Gate `true` (default)** — **never** auto-reply, **never** auto-resolve. The user owns these threads. Only reply or resolve when the user explicitly says so in the current turn ("post that reply", "resolve thread 3", "reply and resolve all of these") *and* the instruction is specific enough to know which thread(s) it covers. Default to leaving colleague threads untouched on GitHub even after applying their suggested code change — the user can reply/resolve themselves once they're happy with the diff.
- **Gate `false`** — the project opted into full automation: reply and resolve colleague threads the same way as bot threads above, no per-turn confirmation needed.

**Reply guidelines (when you do reply):**
- **Applied feedback**: "Fixed as suggested." or a brief note on what was changed
- **Declined feedback**: Brief explanation of why
- **Discussion needed**: Ask a clarifying question — present planned reply to the user first

Keep replies concise. Do not repeat the reviewer's comment back to them.

### Phase 7: Verify Threads Resolved (Hard Gate)

**The skill is not done until this passes.** Re-run the reviewThreads query below and confirm **zero unresolved bot/self threads** remain. Colleague threads under the default gate are excluded — they stay open by design; include them only when `review.colleague_gate` is `false`.

An unresolved **bot** thread passes only as a **deferred** thread (Phase 6): the user explicitly took it over *in this run*, and `isDraft` is `true` on the PR. Both conditions, together — "the user might want to look at it" is not a deferral, and a deferred thread on a ready PR is a gate failure you fix by marking the PR draft (via the `pull-requests` skill), not by rewording the report. Fetch the flag alongside the threads (`gh pr view <NUMBER> --json isDraft`).

List every still-unresolved thread with its `id`, authors, and `viewerCanResolve`, so you can confirm none are bot/self and act on any that remain:

```bash
gh api graphql \
  -F owner='{owner}' -F repo='{repo}' -F number=<NUMBER> \
  -f query='
query ($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved viewerCanResolve comments(first: 100) { totalCount nodes { author { login } } } }
      }
    }
  }
}' --jq '{
  hasNextPage: .data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage,
  endCursor: .data.repository.pullRequest.reviewThreads.pageInfo.endCursor,
  unresolved: [.data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved | not)
    | {id, viewerCanResolve, authors: ([.comments.nodes[].author.login] | unique),
       fetched: (.comments.nodes | length), total: .comments.totalCount}]
}'
```

**If `hasNextPage` is `true`, the gate has not seen every thread** — page through with `after: "<endCursor>"` using the emitted `endCursor`, and merge before judging; a truncated list can hide unresolved bot/self threads and let the gate pass falsely. **Truncation cuts the other way too**: an entry whose `total` exceeds `fetched` has comments you never saw, so its author set cannot prove it is all bot/self — page that thread's comments, or fail safe to colleague, per Author Classification, before judging it. Read the merged `unresolved` list:

- **Empty list** → gate passes; the loop is closed. Every bot/self thread is resolved.
- **Non-empty** → each remaining entry must be either a **colleague** thread (contains a human who is not you), legitimately left open under the default gate, or a **deferred** bot thread on a draft PR. Any other all-bot or all-you (self) entry is unresolved bot/self work — reply and resolve it with its `id` (Phase 6 mutations) and re-run this query until only colleague and deferred threads remain. Under `colleague_gate: false`, colleague threads are auto-handled too, so only deferred threads may remain.

**Resolving without replying passes this query but fails the rule** — an unreplied resolve is invisible here, which is exactly why it is on you to check: for every **bot** thread you resolved this run, confirm your reply is on it. The Phase 6 reply mutation's returned `comment.url` is that proof — a missing or failed reply call means not replied. If unsure, fetch the resolved thread by its `id` (the Phase 1 and gate queries only list unresolved threads, so they cannot show it):

```bash
gh api graphql -f query='
query($id: ID!) {
  node(id: $id) {
    ... on PullRequestReviewThread { comments(last: 1) { nodes { author { login } body } } }
  }
}' -f id="<THREAD_ID>"
```

A bot thread you resolved silently is not closed work; reply on it now. (Self threads are exempt — resolving your own note without a reply is fine.)

A bot/self thread whose `viewerCanResolve` is `false` (you lack permission) is **not** a fourth outcome — it is a **blocked** thread. Don't loop on it: report it to the user with its `id` and the reason, and say plainly that the loop is not closed. Whether the PR can be marked ready with it open is the user's call, not a gate you quietly pass.

## Response Template

Summarize once Phases 3 + 3b + the Phase 7 gate are complete. Bot and self items are already replied to on their own threads (mandatory for bot threads, optional for self notes) and resolved — state the verified count (e.g. "All 3 bot/self threads resolved"), and name any deferred thread separately with the PR's draft state. Colleague items are presented as proposals — the user decides next steps (unless `review.colleague_gate` is `false`, in which case they're already handled too).

```markdown
## Bot & Self Feedback — Applied (replied & resolved)

1. **[File]** — [bot/self login]
   - Comment: [Brief summary]
   - Change: [What was done]

## Bot & Self Feedback — Declined (replied & resolved)

1. **[File]** — [bot/self login]
   - Comment: [Brief summary]
   - Reason: [Why it was declined]
   - Reply: "[What was posted]"

## Bot Feedback — Deferred (replied, left open, PR back to draft)

1. **[File]** — [bot login]
   - Comment: [Brief summary]
   - Who is working it and what remains: [...]
   - Reply: "[What was posted]" · PR is now draft

## Colleague Feedback — Awaiting Your Decision

1. **[File]** — [colleague login] · [link to comment]
   - Comment: [Brief summary]
   - My evaluation: [valid / partially valid / contradicts convention / subjective / needs context]
   - Recommended action: [apply / partially apply / push back / clarifying question / no change]
   - Draft reply (if you want me to post it): "[Draft text]"

   How would you like to handle this — apply, skip, reply with something else, or resolve?
```
