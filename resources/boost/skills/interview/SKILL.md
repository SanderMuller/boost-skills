---
name: interview
description: "Adversarial grilling flow that gathers requirements for a complex feature by challenging assumptions, sharpening fuzzy terms, and cross-referencing the codebase before handing off to write-spec. Pairs with write-spec: interview gathers the requirements, then write-spec turns them into the spec file. Activates when: gathering requirements, planning a feature, clarifying ambiguous work, or when user mentions: interview, grill, requirements gathering, feature planning, gather requirements, ask me about."
argument-hint: "[feature or task description]"
metadata:
  boost-requires: "clarify write-spec"
  schema-required: "^1"
---

# Interview

A grilling process that gathers requirements for a complex feature. The goal is **shared understanding**, not a filled-out form. Interview the user relentlessly until the design tree is resolved, but lean on the codebase whenever it can answer a question for you. This skill owns the questioning; it does **not** write the spec file. Once requirements are gathered, hand off to the `write-spec` skill, which owns the spec file format.

## Project context

Before interviewing, consult these project reference docs upfront so terminology and architectural references match project canon: <!--boost:conv path="spec.research_docs" mode="inline"-->none — gather context from the conversation and the codebase only<!--boost:conv:end-->. If paths are shown, read them first.

If a Jira project key is configured (<!--boost:conv path="jira.project_key" mode="inline"-->none — skip the Jira-key question; write-spec treats the resulting spec as not-issue-backed<!--boost:conv:end-->), ask for / verify the issue key during gathering so `write-spec` can resolve it. If the work is tracked in an issue, pull its context first (description, acceptance criteria, comments) and use it to skip questions already answered.

## When to Use This Skill

Use for:
- **Complex features** requiring architectural decisions
- **New systems** with multiple components or integrations
- **Ambiguous requirements** that need clarification
- **Cross-cutting concerns** affecting multiple parts of the codebase

Do NOT use for:
- Simple bug fixes with clear reproduction steps
- Minor tweaks or text changes
- Tasks with explicit, detailed instructions already provided

## Grilling Techniques (Apply Throughout)

The questioning disciplines live in the `clarify` skill — **read it first**. Apply all of them throughout the interview, one thread at a time (this overrides any "batch a round of questions" habit):

- **Code-First** — read the codebase before asking; only ask the user what code can't answer (intent, priorities, business rules, UX trade-offs).
- **Bisect toward intent** — halve the possibility space each question while the ask is fuzzy (Phase 0).
- **One question at a time, with a recommended answer** — recommendation first, 2-3 alternatives.
- **Sharpen fuzzy terms** — resolve overloaded words to a canonical one.
- **Stress-test with concrete scenarios** — force a precise answer on each edge.
- **Cross-reference stated behavior against code** — surface contradictions immediately.
- **Assumptions audit** — flag every AI-introduced inference and grill it (Phase 7 runs this in full).

Two overlays specific to the interview → spec hand-off:

- **Capture decisions as they crystallize** into a running **Resolved Questions** tally (question, decision, rationale) that you maintain through the interview and hand to `write-spec` at the end. Capturing as you go — not batched at the close — prevents re-litigating settled decisions and keeps the hand-off accurate if the conversation gets long. Filter for what a future reader would wonder about (scope boundaries, conflict behavior, terminology, technical trade-offs with real alternatives); trivial preferences (icon, button label, exact wording) belong in the spec body.
- **Terminology** — when sharpening a fuzzy term settles a recurring ambiguity, flag it so `write-spec` records it under a `## Terminology` section.

## Interview Process

### Phase 0: Intent Disambiguation (only when the initial ask is fuzzy)

**Evaluate fuzziness *after* pulling all available context** — fetch the linked issue first if one was provided, then judge. A one-line ask with a richly-detailed linked issue has sharp intent; Phase 0 is skipped.

Trigger this phase only when, with all context in hand, the request is still fuzzy — one sentence, overloaded terms, or multiple plausible interpretations. Apply the **Bisect toward intent** discipline from `clarify`: cut the possibility space roughly in half each turn until intent converges (its "Improve sharing" walkthrough is the model). Capture each bisecting outcome into the Resolved Questions tally — they are real scope decisions. Bisecting also applies mid-interview: if any answer reveals new fuzziness, drop in 1-2 bisecting questions before continuing.

### Phase 1: Problem & Goals

What problem does this solve? Who is affected? What's the current workaround? What does success look like?

### Phase 2: Scope & Boundaries

Minimum viable version? Explicitly out of scope? Related features to integrate with? What existing patterns should this follow? *(Check the code yourself before asking — see Code-First.)*

### Phase 3: User Experience

How do users discover this? Primary flow? What feedback/confirmation do they need? Different user types with different needs?

### Phase 4: Technical Considerations

**Read the relevant code before this phase** — the project reference docs are the index. Bring concrete findings, not open questions. Performance requirements? What data needs storing? *(Sketch the changes yourself first; ask the user to confirm.)* External dependencies or integrations? Security/privacy concerns? *(Cross-reference existing authorization/policies.)*

### Phase 5: Edge Cases & Error Handling

Use the **Stress-Test** technique aggressively here — invent at least 3 concrete edge-case scenarios and force a precise answer for each. What happens when things go wrong? Boundary conditions? How are validation errors handled? Rollback/undo requirements?

### Phase 6: Testing & Verification

How will this be tested? Acceptance criteria? Specific scenarios QA should cover?

### Phase 7: Assumptions & Fuzziness Audit

**Run this phase always, no skip.** Earlier phases capture *answered* questions. This phase catches the inverse: every place you silently inferred something the user did not explicitly say, and every place an answer was clear at the time but has fuzzy implications now that surrounding decisions are in. The goal is to make it safe for the user to ship the spec **without reading it end-to-end**.

Run the **Assumptions audit** from `clarify` over every decision gathered so far — its category list is the checklist. Add one interview-specific trigger:

- **MVP trade-offs worth re-flagging** — an earlier accepted shortcut that's load-bearing enough to re-confirm now.

Grill one assumption at a time (never batch), then **fold every scanned item into the requirements you hand to `write-spec`**, regardless of outcome — this is the ledger that lets the user sign off by skimming alone. `write-spec` runs its own Assumptions Audit on the technical sections it adds.

### Phase 8: Feature Flag Consideration

**Always the final question before wrapping up**, even if earlier phases were skipped. By this point you understand scope, user impact, and technical approach — enough to weigh the trade-off.

Present your own assessment first, then ask the user to confirm or override.

**Favors a feature flag:** user-facing behavior that could be rolled back; a phased rollout; modifying (not just adding) existing behavior; data migrations that change existing data; multi-team coordination; performance-sensitive changes needing gradual rollout.

**Against:** purely additive with no risk to existing behavior; a small isolated change; the flag adds more complexity than it's worth; an internal/infra change with no user-facing component.

## Interview Guidelines

- **Summarize after each phase** — briefly confirm what you learned before moving on.
- **Respect "skip" and "done"** — if the user says "skip", move on without pressing; if they say "done" or "that's enough", skip remaining phases **but still run Phase 7 (Assumptions Audit) and ask the Phase 8 feature-flag question** before wrapping up.
- **Adapt to context** — backend-heavy features spend more time on Phase 4, UI-heavy on Phase 3. Skip phases that aren't relevant — **except Phase 7 and Phase 8, which always run**.

## Output

This skill produces gathered requirements, not a spec file. At handoff, pass `write-spec` everything gathered: problem and goals, scope, user flow, technical decisions, edge cases, acceptance criteria, the running Resolved Questions tally, the assumptions ledger from Phase 7, and the feature-flag decision.

> Once requirements are gathered, produce the spec with the `write-spec` skill.
