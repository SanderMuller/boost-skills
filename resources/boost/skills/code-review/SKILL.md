---
name: code-review
description: "Structured review of recent code changes across functionality, UX/UI, design, code quality, security, testing — produces a prioritized findings list. Activates when: the user asks to review implementation, review changes, review code, audit code, check for improvements, or when user mentions: review, audit, improvements, code quality, code review."
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

Do NOT use for:
- Reviewing code you haven't read yet (read first, then review)
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

Evaluate the changes against each category below. Only report findings where there is a **clear, concrete improvement** — do not nitpick or pad the review.

#### Security

Look for:
- **Input validation**: Unvalidated user input reaching critical paths
- **Type safety**: Loose comparisons where strict is needed, missing type declarations
- **Information disclosure**: Sensitive data in error messages or logs

#### Functionality

Look for:
- **Conformance & scope**: does the change deliver what was actually asked? Fetch the **real requirement** — the spec's stated goals (`## Overview`), its normative technical/design sections (e.g. `## Data Model`, `## API Design`, `## Proposed Changes`), and every `## Edge Cases` row; any linked issue acceptance criteria the spec hasn't superseded (where a spec and issue differ, the spec is the source of truth); and, when there's neither spec nor issue, the caller's own task description / explicit request — never the PR's paraphrase (a verdict against a paraphrase inherits its errors; only when there is *genuinely* no requirement source → note conformance wasn't reviewable rather than inventing one). Work **requirement-down, not diff-up** — the diff shows what was built, never what was forgotten: verdict each criterion **Met** (`file:line`, plus the test if one proves it) / **Partial** (the concrete gap) / **Unmet** / **Untestable from the diff** (say what would prove it). Then scope-check — **implied requirements** (an "edit X" ticket implies the edit persists and re-renders), **unrequested extras** (scope creep: flag as a decision, not a free bonus), **silent interpretation** of an ambiguous requirement (name the readings, flag a decision), and **side-effect behaviour changes** the ticket doesn't cover. A documented scope cut ("phase 2 covers X") is out-of-scope-noted, not Unmet. The Met/Partial/Unmet pass is how you review, not what you print — report only the actionable gaps (Partial/Unmet criteria and scope decisions to confirm), not a full conformance matrix, unless the caller asks for one.
- **Logic errors**: Conditions that don't match intent, off-by-one errors, wrong operator
- **Missing edge cases**: Null handling, empty collections, zero values, boundary conditions
- **Stale data**: Values computed once but displayed alongside live-updating data
- **Duplicate work**: Same query or computation running multiple times unnecessarily
- **Broken flows**: Actions that silently fail, missing error handling for expected failures
- **Race conditions**: Concurrent requests causing data corruption (missing locks, non-atomic operations)
- **Cross-version compatibility**: Does the code work across every runtime and framework version the project supports?

#### Code Quality & Maintenance

Look for:
- **Project convention violations**: Does the code follow established patterns? Check sibling files.
- **Over-engineering**: Unrequested abstractions, speculative generality, premature flexibility, or hand-rolled code a stdlib/native/framework feature or installed dependency replaces — could it be simpler or deleted without losing required behavior? Never cut validation, error handling, security, or accessibility to shrink code.
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
- **Accessibility**: Missing labels, no keyboard support, insufficient contrast
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
