---
name: interview
description: "Structured Q&A flow that gathers requirements for a complex feature through focused questions with predefined options. Pairs with write-spec: interview gathers the requirements, then write-spec turns them into the spec file. Activates when: gathering requirements, planning a feature, clarifying ambiguous work, or when user mentions: interview, requirements gathering, feature planning, gather requirements, ask me about."
argument-hint: "[feature or task description]"
metadata:
  schema-required: "^1"
---

# Interview

A structured interview process that gathers requirements for a complex feature through focused questions with predefined options where possible. This skill owns the questioning; it does **not** write the spec file. Once requirements are gathered, hand off to the `write-spec` skill, which owns the spec file format.

## Project Conventions slots

This skill reads the following slots from the `## Project Conventions` block in `CLAUDE.md`:

| Slot | Used for | If missing |
|---|---|---|
| `$.spec.research_docs` | Project-owned reference docs to consult upfront so terminology and architectural references match project canon | No automatic consultation — gather context from conversation only |
| `$.jira.project_key` | Detects whether the interview should ask for / verify an issue key during gathering | Skip the Jira-key question; `write-spec` will treat any resulting spec as not-issue-backed |

Interview hands off to `write-spec` after gathering. Both skills declare `schema-required: ^1` so they ship together when consumers declare the schema-version constraint.

## When to Use This Skill

Use this skill for:
- **Complex features** requiring architectural decisions
- **New systems** with multiple components or integrations
- **Ambiguous requirements** that need clarification
- **Cross-cutting concerns** affecting multiple parts of the codebase

Do NOT use for:
- Simple bug fixes with clear reproduction steps
- Minor tweaks or text changes
- Tasks with explicit, detailed instructions already provided

If the work is tracked in an issue tracker, pull the issue's context first (description, acceptance criteria, comments) and use it to skip questions that are already answered.

## Interview Process

### Phase 1: Problem & Goals

Understand the core problem before discussing solutions.

Questions to cover:
- What problem does this solve?
- Who are the users affected?
- What's the current workaround (if any)?
- What does success look like?

### Phase 2: Scope & Boundaries

Define what's in and out of scope.

Questions to cover:
- What's the minimum viable version?
- What's explicitly out of scope?
- Are there related features this should integrate with?
- What existing patterns should this follow?

### Phase 3: User Experience

Understand the user journey.

Questions to cover:
- How will users discover this feature?
- What's the primary user flow?
- What feedback/confirmation do users need?
- Are there different user types with different needs?

### Phase 4: Technical Considerations

Explore implementation constraints and decisions.

Questions to cover:
- Are there performance requirements?
- What data needs to be stored?
- Are there external dependencies or integrations?
- What security/privacy concerns exist?

### Phase 5: Edge Cases & Error Handling

Anticipate problems.

Questions to cover:
- What happens when things go wrong?
- What are the boundary conditions?
- How should validation errors be handled?
- What are the rollback/undo requirements?

### Phase 6: Testing & Verification

Define how to verify correctness.

Questions to cover:
- How will this be tested?
- What are the acceptance criteria?
- Are there specific scenarios QA should cover?

### Phase 7: Feature Flag Consideration

**This is always the final question before wrapping up**, even if earlier phases were skipped. By this point you should have a solid understanding of the feature's scope, user impact, and technical approach — which is needed to properly weigh the trade-offs.

Ask the user whether this feature should be wrapped in a feature flag. Before asking, present your own assessment of the pros and cons based on what you've learned:

**Factors that favor a feature flag:**
- The feature touches user-facing behavior that could be rolled back
- There's a phased rollout plan (e.g., beta users first)
- The feature modifies existing behavior (vs. purely additive)
- Data migrations are involved that change existing data
- Multiple teams or stakeholders need to coordinate the release
- The feature could impact performance and needs gradual rollout

**Factors against a feature flag:**
- The feature is purely additive with no risk to existing behavior
- It's a small, isolated change (e.g., a new admin page)
- The feature flag would add significant complexity for little benefit
- The change is infrastructure/internal with no user-facing component

Present your recommendation with reasoning, then ask the user to confirm or override.

## Interview Guidelines

### Use Options Where Possible

When asking questions, provide predefined options to speed up the interview:

```
Good: "How should errors be displayed?"
Options:
- Inline validation messages (Recommended)
- Toast notifications
- Modal dialogs
- Error summary at top of form

Bad: "How do you want to handle errors?" (too open-ended)
```

### Ask 2-4 Questions Per Round

Don't overwhelm with too many questions. Group related questions together.

### Summarize After Each Phase

Before moving to the next phase, briefly summarize what you've learned to confirm understanding.

### Respect "Skip" and "Done"

- If the user says **"skip"** for a question, move on without pressing
- If the user says **"done"** or **"that's enough"**, skip remaining phases **but still ask the Phase 7 feature flag question** before wrapping up
- If you've covered all phases and have enough information, suggest wrapping up

### Adapt to Context

- For backend-heavy features, spend more time on Phase 4
- For UI-heavy features, spend more time on Phase 3
- Skip phases that aren't relevant — **except Phase 7 (Feature Flag), which should always be asked**

## Output

This skill produces gathered requirements, not a spec file. Once the interview is complete and the feature-flag decision is made, hand off to the `write-spec` skill — it owns the spec file format and templates. Pass along everything gathered: the problem and goals, scope, user flow, technical decisions, edge cases, acceptance criteria, and the feature-flag decision.

> Once requirements are gathered, produce the spec with the `write-spec` skill.

## Example Interview Flow

**User**: `/interview Add bulk tagging feature`

**AI**: Let me understand this feature. Starting with the core problem:

*[AskUserQuestion]*
- **Question**: What problem does bulk tagging solve for users?
- **Options**:
  - Managing tags one item at a time is too slow
  - Users need to apply consistent tags across sets of items
  - Tags need to be updated when the taxonomy changes
  - Other (please describe)

*[Continue through phases, 2-4 questions per round, summarizing after each phase...]*

*[Phase 7 — always asked last]*

**AI**: Last question. Based on what we've discussed, this feature modifies existing behavior and would benefit from a phased rollout, so I'd recommend wrapping it in a feature flag. Do you agree?

*[After gathering enough information and the feature-flag decision]*

**AI**: Requirements gathered. Handing off to the `write-spec` skill to produce the spec file.
