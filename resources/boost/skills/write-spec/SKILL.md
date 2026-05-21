---
name: write-spec
description: "Writes implementation-ready specification files with progress-trackable phases. Activates when: writing a spec, creating a spec file, documenting a feature plan, or when user mentions: write spec, create spec, spec format, spec template."
argument-hint: [feature name or description]
---

# Write Spec

Writes structured specification files designed for phased implementation with built-in progress tracking. Specs produced by this skill are directly compatible with the `implement-spec` skill.

## When to Use This Skill

- Writing a new spec from gathered requirements
- Converting loose notes or issues into a formal spec
- **Not** for implementing (`implement-spec` skill)

## Spec File Location

Write specs to `specs/{feature-name}.md` (kebab-case). Subdirectories for related specs are fine:

```
specs/
├── wildcard-performance-optimization.md
├── polymorphic-field-support.md
└── cleanup/
    └── deprecated-method-removal.md
```

## Spec Format

Two formats: **multi-phase** (features with multiple steps) and **single-phase** (cleanup, small refactors).

Both end with the same closing sections: **Open Questions**, **Resolved Questions** (when needed), and **Findings**.

### Multi-Phase Format (Features)

```markdown
# {Feature Name}

## Overview

{2-3 sentences: what this does and why it matters.}

---
```

After the overview, use numbered top-level sections (`## 1. Data Model`, `## 2. API Design`, etc.) for the technical design. Adapt sections to fit the feature.

After the technical sections, include `## Edge Cases` — a compact table the Edge Case Sweep (below) fills in. Each row names a scenario the feature must handle and how the app handles it.

```markdown
## Edge Cases

| Scenario | Handling |
|----------|----------|
| {Setting/flag combination, interacting state, boundary, or permission edge} | {What the app does — name the phase/task and Tests entry that cover it} |
```

The final sections are always:

```markdown
## Implementation

### Phase 1: {Phase Name} (Priority: {HIGH/MEDIUM/LOW})

- [ ] {Task description} — {brief context}
- [ ] {Task description} — {brief context}
- [ ] Tests — {what to test}

### Phase 2: {Phase Name} (Priority: {HIGH/MEDIUM/LOW})

- [ ] {Task description} — {brief context}
- [ ] Tests — {what to test}

---

## Open Questions

1. **{Question}** {Context and options to consider.}

---

<!-- ## Resolved Questions
1. **{Original question?}** **Decision:** {What was decided.} **Rationale:** {Why.}
-->

## Findings

<!-- Notes added during implementation. Do not remove this section. -->
```

### Single-Phase Format (Cleanup, Refactors)

For focused changes that don't need multiple phases.

```markdown
# {Change Name}

## Overview

{2-3 sentences: what this fixes/improves and why.}

---

## 1. Current State

{What the code looks like now. Reference specific files and line numbers.}

## 2. Proposed Changes

{What to change and why. Include code snippets for non-obvious decisions.}

## Edge Cases

| Scenario | Handling |
|----------|----------|
| {Scenario, or `None — change has no edge cases`} | {What the app does} |

## Implementation

- [ ] {Task description} — {brief context}
- [ ] {Task description} — {brief context}
- [ ] Tests — {what to test}

---

## Open Questions

1. **{Question}** {Context and options to consider.}

---

<!-- ## Resolved Questions
1. **{Original question?}** **Decision:** {What was decided.} **Rationale:** {Why.}
-->

## Findings

<!-- Notes added during implementation. Do not remove this section. -->
```

## Implementation Section Rules

### Phases

- `### Phase N: {Name} (Priority: HIGH/MEDIUM/LOW)` — ordered by dependency.
- Priorities: `HIGH` = must have, `MEDIUM` = should have, `LOW` = nice to have (skipped by default during implementation).
- Keep phases manageable: ~half a day to a day. Split if more than 8-10 tasks.

### Tasks

- Use `- [ ]` checkboxes. Each task must be concrete and verifiable — not "improve performance" but "add index lookup for wildcard expansion".
- Always include brief context after `—` so the implementer understands purpose without re-reading the full spec.
- Group related tasks, but keep each checkbox independently completable.
- Always include `- [ ] Tests — {what to test}` per phase.

## Closing Sections

**Open Questions** — Numbered, bold question + context. Must be resolved before implementing the affected section. Use "None." when there are no open questions.

**Resolved Questions** — Starts as an HTML comment block. Uncomment when the first question is answered. Format: `1. **{Question?}** **Decision:** {Decided.} **Rationale:** {Why.}` — captures *why* to prevent re-litigating decisions.

**Findings** — Always present, even if empty. Implementation notes go here: design decisions, deviations from spec, discovered issues.

## Edge Case Sweep — Required Before Finalising

Once the spec body has shape (technical sections + draft Implementation phases), sweep for edge cases. Edges left implicit ship as production bugs with no test coverage. The sweep is codebase research, not guesswork.

### Step 1 — Research, don't guess

Read the code around the feature and look for:

- **Setting & flag combinations** — list every configuration option and feature flag in scope; for each, ask what the feature does on both sides of the toggle.
- **Interacting states** — concurrent edits, stale client state vs changed server state, partial saves, optimistic UI vs server rejection.
- **Boundary & lifecycle** — empty or missing related record, first / last / zero / max counts, soft-deleted or orphaned parents, retry / timeout / parallel invocation, partial failure.
- **Permission edges** — actor loses access mid-flow, role downgraded, ownership moved.

### Step 2 — Record each edge case

Fill the `## Edge Cases` table (`Scenario | Handling`). Every row must be backed by:

- a `- [ ] Tests —` entry in the relevant phase that covers the scenario, and
- an implementation note in the technical section when the handling is non-obvious.

Record the handling even when you had to choose it yourself. Reserve `## Open Questions` for edge cases whose handling needs a product or UX decision you cannot make.

## Writing Guidelines

- **Existing code**: Reference specific files and line numbers when extending or modifying code.
- **Code snippets**: Show code for non-obvious implementation choices, but don't write every line.
- **Conventions**: Follow project conventions (check sibling files for patterns).
- **Cross-version**: Note any runtime or framework version-specific considerations.
