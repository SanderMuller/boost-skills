---
name: write-spec
description: "Writes implementation-ready specification files with progress-trackable phases. Activates when: writing a spec, creating a spec file, documenting a feature plan, or when user mentions: write spec, create spec, spec format, spec template."
argument-hint: [feature name or description]
metadata:
  schema-required: "^1"
---

# Write Spec

Writes structured specification files designed for phased implementation with built-in progress tracking. Specs produced by this skill are directly compatible with the `implement-spec` skill.

## Filename placeholder substitution

The spec filename pattern is <!--boost:conv path="spec.filename_pattern" mode="inline" fallback="specs/{slug}.md"-->. It accepts these placeholders, which you substitute at spec-creation time:

- `{issue_key}` — full Jira key (e.g. `HPB-1234`). Resolved from the user's input, or from the current branch name if it matches one of the configured branch patterns:

  ```boost:conv
  <!--boost:conv path="branches.patterns" mode="yaml" fallback="none — no branch-pattern issue-key detection"-->
  ```

  The configured Jira project key is <!--boost:conv path="jira.project_key" mode="inline" fallback="(none — the spec is treated as not-issue-backed)"-->. If no issue is involved (or no project key is configured), the placeholder resolves empty.
- `{slug}` — URL-safe kebab-case from the feature name. Lowercase, alphanumerics + dashes, no consecutive or leading/trailing dashes, recommended cap ~60 chars truncated on word boundary.
- `{date}` — ISO date (`YYYY-MM-DD`).

**Empty-placeholder rule**: if a placeholder resolves empty, the placeholder AND any single adjacent dash are omitted. Example: `specs/{issue_key}-{slug}.md` with no issue + feature name "Set up dark mode" → `specs/set-up-dark-mode.md` (not `specs/-set-up-dark-mode.md`).

## When to Use This Skill

- Writing a new spec from gathered requirements
- Converting loose notes or issues into a formal spec
- **Not** for implementing (`implement-spec` skill)

## Spec File Location

Resolve the spec file path via the filename pattern above. Apply the placeholder-substitution rules above to produce the final path.

Subdirectories for related specs are fine — if the filename pattern doesn't model the subdir convention, place spec files manually under the resolved parent dir:

```
specs/
├── HPB-1234-wildcard-performance-optimization.md
├── HPB-1267-polymorphic-field-support.md
└── cleanup/
    └── deprecated-method-removal.md
```

## Research phase — project context

Before drafting the spec, consult the project reference docs: <!--boost:conv path="spec.research_docs" mode="inline" fallback="none — the skill stays generic; gather context from the conversation"-->. If paths are shown, read them (architecture, domain glossary, relationship maps, or similar) before the technical sections so terminology + structural references match the project's canon. If a path points at a missing file, surface it (`boost doctor --check-conventions` would have caught this at sync time).

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
