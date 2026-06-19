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

The spec filename pattern is <!--boost:conv path="spec.filename_pattern" mode="inline"-->specs/{slug}.md<!--boost:conv:end-->. It accepts these placeholders, which you substitute at spec-creation time:

- `{issue_key}` — full Jira key (e.g. `HPB-1234`). Resolved from the user's input, or from the current branch name if it matches one of the configured branch patterns:

  ```boost:conv
  <!--boost:conv path="branches.patterns" mode="yaml"-->none — no branch-pattern issue-key detection<!--boost:conv:end-->
  ```

  The configured Jira project key is <!--boost:conv path="jira.project_key" mode="inline"-->(none — the spec is treated as not-issue-backed)<!--boost:conv:end-->. If no issue is involved (or no project key is configured), the placeholder resolves empty.
- `{slug}` — URL-safe kebab-case from the feature name. Lowercase, alphanumerics + dashes, no consecutive or leading/trailing dashes, recommended cap ~60 chars truncated on word boundary.
- `{date}` — ISO date (`YYYY-MM-DD`).

**Empty-placeholder rule**: if a placeholder resolves empty, the placeholder AND any single adjacent dash are omitted. Example: `specs/{issue_key}-{slug}.md` with no issue + feature name "Set up dark mode" → `specs/set-up-dark-mode.md` (not `specs/-set-up-dark-mode.md`).

## When to Use This Skill

- Writing a new spec from gathered requirements
- Converting loose notes or issues into a formal spec
- **Not** for implementing (`implement-spec` skill)

## Gate: Are Requirements Settled?

Before writing a single line of spec, check for fuzziness. **Judge fuzziness only after loading all available context** — read the linked issue and run the [Research checklist](#research-before-writing--required-checklist) below first. An issue-backed ask like "write a spec for the export feature" is one sentence on its own, but if the linked issue carries a concrete description + acceptance criteria, intent is sharp and the gate does not fire — converting an issue into a spec is a documented use of this skill. Bounce to `interview` only when ambiguity remains *after* the context is in hand.

If **any** of these are true with all context loaded, **bounce the user to the `interview` skill first** — do not power through:

- The ask is underspecified — even after reading the issue — or uses overloaded terms without disambiguation.
- The proposed solution requires picking between two or more genuinely different architectures.
- The issue's acceptance criteria contradict each other or the description.
- You'd be guessing at edge-case behavior, error handling, or scope boundaries.

A short bounce message:

> "I'm seeing ambiguity around [X, Y]. Want me to run the `interview` skill first to grill those out, then write the spec from solid answers?"

If the user insists on writing immediately, capture each unresolved item in `## Open Questions` rather than inventing an answer. A spec built on guessed requirements ships those guesses as bugs.

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

## Planning Commit Stamp

When the spec is written in a git repository, stamp the commit it was planned against immediately under the spec's `# Title`:

```markdown
<!-- spec:planned-at <full-sha> <YYYY-MM-DD> -->
```

This lets `implement-spec` detect when cited code has drifted before it builds against stale `file:line` references.

- **SHA** — `git rev-parse HEAD` (full SHA, not short — matches the repo's `verified-sha` convention). **Date** — ISO `YYYY-MM-DD`.
- **Not a git repo** — omit the stamp entirely; the drift preflight then no-ops.
- **Dirty worktree** — the spec's `file:line` references come from the *working tree*, but `HEAD` names only the last commit. If `git status --porcelain` is non-empty, append a `+uncommitted` marker so the baseline is flagged approximate: `<!-- spec:planned-at <sha> <date> +uncommitted -->`. Prefer stamping against a clean tree when practical.

## If a Spec File Already Exists

Before writing from a fresh template, check whether a spec for this work already exists at (or under) the resolved path — an earlier `write-spec` run, or a requirements doc the `interview` skill's output was saved into. If one exists, read it and classify before doing anything:

| What you find | Action |
|---|---|
| Already implementation-ready — has a phased `## Implementation` section (or `### Phase N:` task checkboxes) | **Stop.** Don't re-wrap. Ask the user what they want changed (add tasks? a new phase? edit existing?). |
| Requirements-shaped — has problem/overview/edge-cases/acceptance content but no phased Implementation | **Convert in place** (below). |
| Loose notes / neither | Treat as input; fall through to the from-scratch flow. |
| More than one candidate file for the same work | **Stop and ask** which is authoritative — never pick silently. |

**Convert in place** rather than rewriting from a fresh template — rewriting silently drops captured decisions. Carry forward verbatim, unless a later step explicitly supersedes it: `## Overview`, `## Assumptions` (the user's skim-only sign-off ledger — never drop or wholesale-rewrite it), `## Terminology`, `## STOP Conditions`, `## Open Questions`, `## Resolved Questions`, `## Findings`, the issue link, problem statement, edge-cases table, and acceptance criteria. Then **add** the technical sections and Implementation phases. When a later audit corrects an inherited `## Assumptions` or resolves an inherited `## Open Questions` entry, update it in place (and log the decision in `## Resolved Questions`) rather than leaving two contradictory bullets — the skim ledger must show exactly one truth per topic.

**Stamp on conversion**: if the existing spec carries a `spec:planned-at` stamp, refresh it to the current `HEAD` when the conversion materially re-bases the spec's `file:line` references on today's code — otherwise the drift preflight diffs against a stale baseline and reports false drift on a just-revalidated spec. Leave the stamp untouched when you only add sections without re-validating existing references. If no stamp exists and the repo is git, add one (see [Planning Commit Stamp](#planning-commit-stamp)).

## Research Before Writing — Required Checklist

Specs are only as good as the research behind them. Before writing the spec body, do all of the following and reference findings in the spec:

1. **Read the issue** (if any) — description, acceptance criteria, all comments.
2. **Locate relevant code** — grep for the primary domain term(s); list the files you'll touch.
3. **Read the project reference docs**: <!--boost:conv path="spec.research_docs" mode="inline"-->none — gather context from the conversation and codebase<!--boost:conv:end-->. If paths are shown, read the ones matching the feature area (architecture, domain glossary, relationship maps, or similar) so terminology + structural references match project canon. If a path points at a missing file, surface it (`boost doctor --check-conventions` catches this at sync time).
4. **Verify any stated existing behavior** — if the user said "X currently does Y", read the code and confirm. If they're wrong, surface the contradiction before writing the spec around it.
5. **Check terminology against the reference docs** — use canonical names. If the user used a different word, flag it in `## Terminology` so the spec doesn't propagate ambiguity.

Skip steps that genuinely don't apply (e.g. step 4 when there's no claim to verify), but never skip 2 and 3 when a codebase and reference docs exist.

## Spec Format

Two formats: **multi-phase** (features with multiple steps) and **single-phase** (cleanup, small refactors).

Both end with the same closing sections: **Open Questions**, **Resolved Questions** (when needed), and **Findings**.

### Multi-Phase Format (Features)

```markdown
# {Feature Name}

<!-- spec:planned-at <full-sha> <YYYY-MM-DD> -->

## Overview

{2-3 sentences: what this does and why it matters.}

## Assumptions

<!-- The Assumptions Audit (below) fills this ledger — one bullet per AI-introduced inference, kept so the user can sign off by skimming this section alone. Carried forward verbatim in Conversion Mode. -->

---
```

After the overview and assumptions ledger, use numbered top-level sections (`## 1. Data Model`, `## 2. API Design`, etc.) for the technical design. Adapt sections to fit the feature.

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

## STOP Conditions

Stop and report — do not improvise — if any of these proves false during implementation:

1. **{Load-bearing assumption}** — {why it blocks the phase / what to do instead}.

Use "None." when the spec has no load-bearing assumptions.

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

<!-- spec:planned-at <full-sha> <YYYY-MM-DD> -->

## Overview

{2-3 sentences: what this fixes/improves and why.}

## Assumptions

<!-- The Assumptions Audit (below) fills this ledger. Omit the section only when the audit surfaced nothing. -->

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

## STOP Conditions

Stop and report — do not improvise — if any of these proves false during implementation:

1. **{Load-bearing assumption}** — {why it blocks the change / what to do instead}.

Use "None." when the change has no load-bearing assumptions.

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

**STOP Conditions** — Placed immediately before `## Open Questions`. Lists each *load-bearing* assumption — one whose falsity invalidates a phase's approach (not a cosmetic default) — as an "if X proves false, stop and report" line for the implementer. It is **derived from** the load-bearing entries in `## Assumptions`, not a competing record: the `## Assumptions` ledger stays the single source of truth (one-truth-per-topic), and STOP Conditions is the actionable view of its load-bearing subset. Use "None." when there are no load-bearing assumptions. The Assumptions Audit (below) populates this section.

**Open Questions** — Numbered, bold question + context. Must be resolved before implementing the affected section. Use "None." when there are no open questions.

**Resolved Questions** — Starts as an HTML comment block. Uncomment when the first question is answered. Format: `1. **{Question?}** **Decision:** {Decided.} **Rationale:** {Why.}` — captures *why* to prevent re-litigating decisions.

**Findings** — Always present, even if empty. Implementation notes go here: design decisions, deviations from spec, discovered issues.

## Edge Case Sweep — Required Before the Assumptions Audit

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

Record the handling even when you had to choose it yourself — the Assumptions Audit grills every AI-chosen handling next. Reserve `## Open Questions` for edge cases whose handling needs a product or UX decision you cannot make.

## Assumptions Audit — Required Before Finalising

After drafting the spec and running the Edge Case Sweep, audit for every AI-introduced inference, then grill the user one at a time. Goal: the spec is sign-off-ready **without the user reading it end-to-end**.

This audit runs even when the requirements came from the `interview` skill — `write-spec` adds technical sections and Implementation phases, and each is a fresh source of AI assumptions on top of whatever the interview captured.

**Step 1 — Scan the spec.** Flag every statement that meets *any* of these:

- **Magic numbers invented from nothing** — char caps, retry counts, backoff sequences, cache TTLs, delays, pagination sizes.
- **Naming and string content invented** — message templates, cache-key prefixes, error wording, queue names.
- **Behavioural defaults the user did not bless** — retry-vs-fail-fast, silent-skip vs surfaced-error, idempotency.
- **Unverified factual claims** — "this column is already indexed", "this endpoint is fast enough".
- **Deviations from the user's original wording** — surface original intent vs final spec even when an earlier answer let you make the swap.
- **Filled-gap behaviours** — user said "store the answers", you assumed JSON column vs separate rows.
- **Convention-added pieces the user did not ask for** — factory/policy/observer added because that's how the codebase usually wires it.
- **Edge-case handling the AI chose** — every `## Edge Cases` row whose handling you decided rather than confirmed from code or an explicit user statement, plus any retry / conflict / timeout / missing-record / parallel-invocation behaviour the table doesn't cover.
- **"Recommended" choices accepted without engaging with the framing.**
- **MVP trade-offs worth re-flagging** — an earlier accepted shortcut that's load-bearing enough to re-confirm now.

**Step 2 — Grill one assumption at a time** via `AskUserQuestion`: the assumption in plain language, "Correct as stated" first, 1-2 concrete alternatives, "Other / let me clarify". Never batch.

**Step 3 — Record outcomes.** Capture each into a `## Assumptions` section near the top of the spec — the complete audit ledger, one bullet per scanned item regardless of outcome. This is the contract that lets the user sign off by skimming `## Assumptions` alone. Promote anything that became a real decision into `## Resolved Questions`; route anything still undecided to `## Open Questions`.

**Step 4 — Derive STOP Conditions.** Scan the confirmed ledger for *load-bearing* assumptions — those whose falsity would invalidate a phase's approach (not cosmetic defaults like a message string or a TTL). Restate each as an "if X proves false, stop and report" line in the `## STOP Conditions` section. This gives the implementer an in-flight contract without duplicating the ledger — STOP Conditions is the actionable view of the load-bearing subset, while `## Assumptions` remains the source of truth. Use "None." when nothing is load-bearing.

## Writing Guidelines

- **Existing code**: Reference specific files and line numbers when extending or modifying code.
- **Code snippets**: Show code for non-obvious implementation choices, but don't write every line.
- **Conventions**: Follow the project's existing patterns (check sibling files for patterns).
- **Cross-version**: Note any runtime or framework version-specific considerations.
