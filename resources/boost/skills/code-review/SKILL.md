---
name: code-review
description: "Structured review of recent code changes across functionality, UX/UI, design, code quality, security, testing — produces a prioritized findings list, and for someone else's PR can verify, filter and post them as one GitHub review. Activates when: the user asks to review implementation, review changes, review code, audit code, check for improvements, review a PR and post the findings, or when user mentions: review, audit, improvements, code quality, code review, post review comments, request changes."
argument-hint: [file path, feature name, or description of changes]
---

# Code Review

A structured review of recent code changes, evaluating them across multiple quality dimensions and producing a prioritized list of actionable findings. The governing principle is **proportionality**: match every finding's weight to its real impact, and review for **code health over time** — net improvement, not perfection.

## When to Use This Skill

Use this skill when:
- Reviewing a recently implemented feature or change
- Auditing code before committing or creating a PR
- The user asks "can you review this" or "are there improvements"
- Checking implementation quality after a subagent completes work
- Reviewing someone else's PR and posting the findings (see [Reviewing Someone Else's PR](#reviewing-someone-elses-pr))

Do NOT use for:
- General codebase audits with no specific scope
- Reviewing third-party packages

## Workflow

### Phase 1: Identify the Scope

Determine what to review:

1. **If given specific files**: read those files
2. **If given a feature description**: find all related files (src/, tests/)
3. **If no scope specified**: use `git diff` or `git diff --cached` to find recently changed files

Read ALL files in scope before starting the review. Do not review code you haven't read.

### Phase 2: Review Each Dimension

Evaluate the changes against each category below. Report every finding that could cause incorrect behaviour, a security or data risk, a test that proves nothing, or a maintenance cost a reviewer would ask to fix. Omit pure style or naming preferences that the project's formatter and conventions do not cover.

#### Security

Look for:
- **Input validation**: Unvalidated user input reaching critical paths
- **Type safety**: Loose comparisons where strict is needed, missing type declarations
- **Information disclosure**: Sensitive data in error messages or logs
- **Independent pass**: when the change touches authorization, authentication, routes, raw queries, uploads or outbound requests, dispatch the `security-reviewer` subagent where the session has it. It traces each finding to an exploit scenario in a fresh context. Without it, trace source, sink and missing control yourself, and say the pass ran without a fresh context

#### Functionality

Look for:
- **Conformance & scope**: does the change deliver what was actually asked? Fetch the **real requirement** — the spec's stated goals (`## Overview`), its normative technical/design sections (e.g. `## Data Model`, `## API Design`, `## Proposed Changes`), and every `## Edge Cases` row; any linked issue acceptance criteria the spec hasn't superseded (where a spec and issue differ, the spec is the source of truth); and, when there's neither spec nor issue, the caller's own task description / explicit request — never the PR's paraphrase (a verdict against a paraphrase inherits its errors; only when there is *genuinely* no requirement source → note conformance wasn't reviewable rather than inventing one). Work **requirement-down, not diff-up** — the diff shows what was built, never what was forgotten: verdict each criterion **Met** (`file:line`, plus the test if one proves it) / **Partial** (the concrete gap) / **Unmet** / **Untestable from the diff** (say what would prove it). When the spec names personas from the project's persona model, treat each persona's feared failure as a criterion too: an untested feared failure is a missing edge case. Then scope-check — **implied requirements** (an "edit X" ticket implies the edit persists and re-renders), **unrequested extras** (scope creep: flag as a decision, not a free bonus), **silent interpretation** of an ambiguous requirement (name the readings, flag a decision), and **side-effect behaviour changes** the ticket doesn't cover. A documented scope cut ("phase 2 covers X") is out-of-scope-noted, not Unmet. The Met/Partial/Unmet pass is how you review, not what you print — report only the actionable gaps (Partial/Unmet criteria and scope decisions to confirm), not a full conformance matrix, unless the caller asks for one.
- **Logic errors**: Conditions that don't match intent, off-by-one errors, wrong operator
- **Missing edge cases**: Null handling, empty collections, zero values, boundary conditions
- **Stale data**: Values computed once but displayed alongside live-updating data
- **Duplicate work**: Same query or computation running multiple times unnecessarily. When the change touches a query-heavy route, job or command, dispatch the `performance-reviewer` subagent where the session has it; it measures query count before it rates. Without it, mark every cost you did not measure as inferred
- **Broken flows**: Actions that silently fail, missing error handling for expected failures. When the change touches `try`/`catch`, `rescue()`, `report()` or job failure handling, dispatch the `silent-failure-hunter` subagent where the session has it; without it, trace each catch to its caller yourself and say the pass ran without a fresh context
- **Race conditions**: Concurrent requests causing data corruption (missing locks, non-atomic operations)
- **Cross-version compatibility**: Does the code work across every runtime and framework version the project supports?

#### Code Quality & Maintenance

Look for:
- **Project convention violations**: Does the code follow established patterns? Check sibling files.
- **Over-engineering**: Unrequested abstractions, speculative generality, premature flexibility, or hand-rolled code a stdlib/native/framework feature or installed dependency replaces — could it be simpler or deleted without losing required behavior? Ask this **at altitude first**: inventory every file, class, interface, trait, public method, config key, flag, route, migration, event, job and test the change added, and ask of each whether the unit needs to exist at all. Dispatch the `simplification-auditor` subagent where the session has it, and the `tech-lead-reviewer` subagent when the change's approach is worth judging above the line. Reviewing your own change costs the distance these questions depend on, so without them, answer from the diff and the requirement rather than from what you meant to build, and say the pass ran without a fresh context. The question differs per unit — a class wants more than one caller or an inlined body, an interface wants a second implementation, a flag wants a value other than the default, an event wants a listener, a queued job wants a reason to leave the caller. The `simplification-auditor` subagent carries the fullest version of this table. Answer every question against downstream consumers too, not this repository alone: a package's public API, a route, a console command, and a framework hook are called from outside. A line-level pass can only shorten a file, never remove one. Read the lines after that. Two floors reject a candidate: **brevity** (never cut validation, error handling, security, accessibility, requested functionality, or a test for non-trivial logic to shrink code) and **complexity** (fewer lines bought with deeper nesting, indirection added to save a line, chained or nested ternaries, two guard clauses folded into one compound condition, a lost early return, one opaque expression or unreadable pipe chain, or a domain `match` or `switch` collapsed into a lookup is a loss). Name the floor when you reject a candidate.
- **DRY violations**: Duplicated logic that should be extracted
- **Dead code**: Unused variables, unreachable branches, commented-out code
- **Type safety**: Missing return types, loose comparisons where strict is needed
- **Naming**: Do names clearly communicate intent?
- **Separation of concerns**: Business logic mixed with validation logic, etc.

#### UX, UI & Design

Only when the change touches a user-facing interface. Look for:
- **Loading states**: Do async actions show feedback while processing?
- **Error states**: What does the user see when something fails?
- **Empty states**: What shows when there's no data?
- **Consistency**: Do new elements match existing patterns (colors, spacing, button styles, icon sets)?
- **Accessibility**: Missing labels, no keyboard support, insufficient contrast. Dispatch the `accessibility-reviewer` subagent where the session has it; it cites a WCAG 2.2 success criterion per finding. Without it, check names, roles, keyboard operation and contrast yourself and say the pass ran without a fresh context
- **Mobile/touch**: Hover-dependent interactions that break on touch devices
- **Visual glitches**: Mismatched icon sizes, layout shifts on state change, inconsistent spacing

#### Testing

Look for:
- **Missing happy path tests**: Core functionality not tested
- **Missing failure path tests**: Error cases, invalid input, unauthorized access
- **Missing edge case tests**: Boundary values, empty data, null values
- **Fragile assertions**: Tests that pass for the wrong reason (e.g., an absence assertion matching unrelated text)
- **Missing security tests**: No tests verifying auth/authorization on actions
- **Test isolation**: Tests that depend on each other or on specific state
- **Independent gap audit**: dispatch the `test-coverage-auditor` subagent where the session has it, unless the change touches only docs. It maps the suite onto the changed behaviour in a fresh context and rates each gap. Without it, walk the gaps from the diff yourself and say the testing pass ran without a fresh context.
- **Tests that prove nothing**: assertions that restate the framework, mirror the implementation, or check only that work was scheduled with nothing anywhere running that work and asserting its effect — the `test-value` skill carries the full verdict pass and the cases where a shallow check is legitimate

### Phase 3: Compile Findings

Present findings in a structured format:

1. **Group by category** (Security, Functionality, etc.)
2. **Number each finding** for easy reference
3. **Include file + line number** for each finding
4. **Explain the issue** concisely — what's wrong and why it matters
5. **Skip categories with no findings** — don't add filler

### Phase 4: Prioritize

End with a summary table ranking findings by severity:

| Severity | Meaning                                                                     |
|----------|-----------------------------------------------------------------------------|
| High     | Security vulnerabilities, data corruption risks, broken functionality       |
| Medium   | Stale data, missing tests for important paths, UX issues that confuse users |
| Low      | Minor inconsistencies, polish items, nice-to-have improvements              |

The subagents rate on their own scales. Map each finding onto this table, and put its `Verified` or `Inferred` mark after the finding's title:

| Subagent rating | Severity here |
|---|---|
| Critical or High; test-coverage criticality 9–10 | High |
| Medium or Warning; criticality 7–8 | Medium |
| Low or Suggestion; criticality 3–6 | Low |
| `simplification-auditor` `Cut` row | Low |

A `simplification-auditor` `User decision` row is a decision for the user, not a finding. An item a subagent reports with no severity stays an unrated note.

## Reviewing Someone Else's PR

Use this mode when the user asks to review a PR that someone else wrote and to post the result, or to request changes on it. It runs the review above over the PR's diff, then two more gates, verify and filter, and posts one GitHub review. It never edits the PR, its branch, or its description. To apply review comments that other people left on your own PR, use the `pr-review-feedback` skill instead, where the project has it.

1. **Read the PR without a checkout.** A checkout changes the working tree under other work. It can also bring a different lock file, so the installed dependencies no longer match and local tests fail for that reason.
   ```bash
   gh pr view <n> --json title,author,body,baseRefName,headRefOid,files,closingIssuesReferences
   git fetch origin "+pull/<n>/head:pr-<n>" "+refs/heads/<base>:refs/remotes/origin/<base>"
   git diff "origin/<base>...pr-<n>"
   git show "pr-<n>:<path>"
   ```
   - `<base>` is the `baseRefName` that `gh pr view` returns. `origin` is the remote of the repository that holds the PR. In a fork clone, that is usually `upstream`.
   - The `+` lets the fetch replace a `pr-<n>` branch that an earlier run left behind, also after the author force-pushed.
   - When a shell variable holds the number, write it as `${n}`. In zsh, `"pr-$n:hooks/a.php"` reads `:h` as a modifier, also inside quotes.
   - Tell every subagent to read the PR only through `git diff` and `git show`. For a subagent without a shell, write the changed files with `git show "pr-<n>:<path>"` into a temp directory, add the requirement text, and give the subagent that directory.
2. **Take the test result from CI.** Run `gh pr checks <n>`. When checks are still pending, report them as pending, or wait with `--watch`. Run the tests locally only when the PR's lock files match the installed dependencies. Otherwise report the CI result and say why you did not run the tests.
3. **Run the review.** Phases 2 to 4 above, over the PR's diff. Take the requirement source from the Conformance check in Phase 2, with the issues in `closingIssuesReferences` as the linked issues. The PR description is not a requirement source.
4. **Verify every finding you intend to post, at every severity.** Trace each claim to the PR's code (`git show "pr-<n>:<path>"`) and cite `file:line`. Correct a wrong detail, such as a line number. Drop a claim the code disproves: a subagent can report a defect that code outside the diff already handles.
5. **Filter: post only what the author can act on in this PR.** Post a finding only when all of these hold:
   - It is valid in the code (step 4).
   - This PR caused it, or it sits in this PR's own content. A pre-existing or shared pattern is a follow-up, not a PR comment.
   - It carries a concrete fix that the author can apply in this PR.
   - It is not a product, scope or risk decision. Those go to the user.
   - No earlier comment on the PR already raises it. Read the inline comments, the review bodies and the conversation:
     ```bash
     gh api --paginate "repos/{owner}/{repo}/pulls/<n>/comments" --jq '.[] | "\(.path):\(.line // .original_line) \(.body[0:80])"'
     gh api --paginate "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '.[] | select(.body != "") | .body[0:200]'
     gh api --paginate "repos/{owner}/{repo}/issues/<n>/comments" --jq '.[] | .body[0:200]'
     ```
6. **Show the user both lists**: the findings to post, and the findings not posted with the reason for each. Post only after the user confirms, unless the request already said to post.
7. **Post one review.** First run `git rev-parse pr-<n>`. When the result is not `headRefOid`, the author pushed during the review: run step 1 again and check the findings against the new code. Then write the payload to a temp file:
   ```json
   {
     "commit_id": "<headRefOid>",
     "event": "COMMENT",
     "body": "<a short verdict, then a numbered list of the inline comments>",
     "comments": [{ "path": "<file>", "line": 44, "side": "RIGHT", "body": "<cause, evidence with file:line, suggested fix>" }]
   }
   ```
   ```bash
   gh api -X POST "repos/{owner}/{repo}/pulls/<n>/reviews" --input <payload-file> --jq '"\(.state) \(.html_url)"'
   ```
   - Use `REQUEST_CHANGES` only when at least one posted comment asks for a change that must land before the merge: a defect, or behaviour that breaks what the PR promises. When every comment is a suggestion, a question or an optional test gap, use `COMMENT`. Never `APPROVE`: approval stays with a person.
   - `line` must fall inside a diff hunk. It is a line of the PR's version of the file on the `RIGHT` side, or a line of the base version on the `LEFT` side for a deleted line. GitHub rejects the whole review when one inline comment points outside the diff. Put such a finding in the review body.
   - Write the body and every comment in Simplified Technical English, and run the `humanizer` skill over them where the project has it. Write no bare `@name`.
8. **Report** the review URL and state, the posted findings, and the findings not posted with their reasons. Delete the local `pr-<n>` branch.

## Output Format

```markdown
### Security

**1. [Short title]**
`file/path.php:42` — Description of the issue and why it matters.

### Functionality

**2. [Short title]**
`file/path.php:18` — Description...

### Testing

**3. [Short title]**
`tests/FooTest.php` — Description...

---

| # | Finding | Severity |
|---|---------|----------|
| 1 | Short title | High |
| 2 | Short title | Medium |
| 3 | Short title | Low |
```

## Guidelines

- **Be concrete**: Every finding must point to a specific line or pattern in the code. No vague suggestions.
- **Be actionable**: Each finding should make clear what needs to change.
- **Proportionality**: Don't flag style preferences as security issues. Match severity to actual impact, and review for code health over time — approve net improvements rather than blocking on perfection.
- **Respect existing conventions**: If the codebase uses a pattern consistently, don't flag it as an issue even if you'd do it differently.
- **Every finding earns its line**: before writing a finding, ask whether it names a concrete, proportional improvement. If not, cut it. If a category has no findings, skip it entirely — a short review with real findings beats a long one with filler.
- **Read before reviewing**: Never review code you haven't read in this session. If you need more context, read the relevant files first.
