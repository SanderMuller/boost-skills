---
name: interview
description: "Adversarial grilling flow that gathers requirements for a complex feature by challenging assumptions, sharpening fuzzy terms, and cross-referencing the codebase before handing off to write-spec. Pairs with write-spec: interview gathers the requirements, then write-spec turns them into the spec file. Activates when: gathering requirements, planning a feature, clarifying ambiguous work, or when user mentions: interview, grill, requirements gathering, feature planning, gather requirements, ask me about."
argument-hint: "[feature or task description]"
metadata:
  schema-required: "^1"
---

# Interview

A grilling process that gathers requirements for a complex feature. The goal is **shared understanding**, not a filled-out form. Interview the user relentlessly until the design tree is resolved, but lean on the codebase whenever it can answer a question for you. This skill owns the questioning; it does **not** write the spec file. Once requirements are gathered, hand off to the `write-spec` skill, which owns the spec file format.

## Project context

Before interviewing, consult these project reference docs upfront so terminology and architectural references match project canon: <!--boost:conv path="spec.research_docs" mode="inline" fallback="none — gather context from the conversation and the codebase only"-->. If paths are shown, read them first.

If a Jira project key is configured (<!--boost:conv path="jira.project_key" mode="inline" fallback="none — skip the Jira-key question; write-spec treats the resulting spec as not-issue-backed"-->), ask for / verify the issue key during gathering so `write-spec` can resolve it. If the work is tracked in an issue, pull its context first (description, acceptance criteria, comments) and use it to skip questions already answered.

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

These rules apply across every phase. They override any "ask a batch of questions per round" habit — grilling is interactive, one thread at a time.

### Code-First — Explore Before Asking

If a question is answerable by reading the codebase, **read instead of asking**. Examples:
- "Does this model already have a `status` column?" → check the migration, don't ask.
- "What pattern do we use for this kind of resource?" → grep an existing one, don't ask.
- "Is there already a policy / authorization check for this?" → look for it, don't ask.

Only ask the user about things the code cannot answer: intent, priorities, business rules, UX trade-offs, future plans.

### One Question at a Time, with a Recommended Answer

Default to **one question per turn**, each with your recommended answer plus 2-3 alternatives. The user reacts (accept / pick an alternative / push back) instead of drafting from scratch. Group questions only when they are clearly orthogonal and small.

This produces better answers than batches: the user's response to question N often changes which questions N+1 and N+2 are even relevant. Use `AskUserQuestion` with predefined options where possible, always leading with your recommendation:

```
"How should errors be displayed?"
- Inline validation messages (Recommended)
- Toast notifications
- Modal dialog
- Other (describe)
```

### Sharpen Fuzzy Terms

When the user uses a vague or overloaded term, stop and resolve it. Propose a canonical term and ask which they mean:

> "You said 'item'. Do you mean a saved draft or a published record? Those behave differently here."

Check the project reference docs (above) for canonical names before proposing one. If resolving a term settles a recurring ambiguity, flag it so `write-spec` records it under a `## Terminology` section.

### Stress-Test with Concrete Scenarios

When the user states a rule, invent a specific edge case that probes the boundary and force a precise answer. Don't accept "we'd handle that case" — make them say what happens.

> User: "Editors can edit any record in their workspace."
> You: "OK — an editor opens a record that was moved into their workspace yesterday from another workspace whose owner just revoked their access. Can they edit it?"

### Cross-Reference Stated Behavior Against Code

When the user describes how something currently works, **verify it against the actual code** before building on it. If they're wrong, surface the contradiction immediately:

> "You said deleting a parent also deletes its children. I checked the relevant handler — it actually orphans them to the grandparent. Which behavior do you want for this feature?"

### Capture Decisions as They Crystallize

When a decision settles, record it immediately in a running **Resolved Questions** tally (question, decision, rationale) that you maintain through the interview and hand to `write-spec` at the end. Do not batch this at the close — capturing as you go prevents re-litigating settled decisions and keeps the handoff accurate if the conversation gets long.

Filter for what qualifies: a decision a future reader would otherwise wonder about — scope boundaries, behavior under conflict, terminology choices, technical trade-offs with real alternatives. Trivial preferences (icon, button label, exact wording) belong in the spec body, not in Resolved Questions, or they dilute the signal.

## Interview Process

### Phase 0: Intent Disambiguation (only when the initial ask is fuzzy)

**Evaluate fuzziness *after* pulling all available context** — fetch the linked issue first if one was provided, then judge. A one-line ask with a richly-detailed linked issue has sharp intent; Phase 0 is skipped.

Trigger this phase only when, with all context in hand, the request is one sentence, uses overloaded terms, or has multiple plausible interpretations. Use **bisecting questions** that cut the possibility space roughly in half each turn — not open-ended "tell me about X", but "is this A or B" until intent converges.

Example — initial ask: `/interview Improve sharing`

1. "Is this about how users *invite collaborators*, or how they *publish to an audience*?" (internal vs external)
2. (external) "Is the gap in *who can access* the published thing, or in *how the link works* once shared?" (access control vs link UX)
3. (access control) "Is this a *missing capability* (e.g. no password-protected links) or *friction with an existing one* (too many clicks)?" (missing feature vs friction)

After 2-4 such questions, intent is sharp enough for Phase 1. Capture each bisecting outcome into the Resolved Questions tally — they are real scope decisions. **Bisecting also applies mid-interview**: if any answer reveals new fuzziness, drop in 1-2 bisecting questions before continuing.

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

**Step 1 — Scan for AI-introduced assumptions.** Walk every decision gathered so far and list every statement that meets *any* of these:

- **Magic numbers invented from nothing** — char caps, retry counts, backoff sequences, cache TTLs, delays, pagination sizes. Wrote a number the user didn't say? Ask.
- **Naming and string content invented** — message templates, cache-key prefixes, error wording, queue names. The user probably has opinions on user-visible strings.
- **Behavioural defaults the user did not bless** — retry-vs-fail-fast, silent-skip vs surfaced-error, idempotency.
- **Unverified factual claims** — "all modern browsers support X", "this column is already indexed". If you asserted a fact the user couldn't see, flag it.
- **Deviations from the user's original wording** — even when they approved the change later, surface original intent vs final decision so they spot drift.
- **Filled-gap behaviours** — they said "block them", you assumed the UX (error vs silent fail vs redirect).
- **Convention-added pieces the user did not ask for** — a factory/policy/observer added because that's how the codebase usually wires it.
- **Implicit edge-case behaviour** — retry, conflict, timeout, missing related record, parallel invocation.
- **"Recommended" options accepted without engaging** — they took your recommendation, but did they understand the trade-off?
- **MVP trade-offs worth re-flagging** — an earlier accepted shortcut that's load-bearing enough to re-confirm now.

Exclude purely cosmetic inferences that don't change observable behaviour.

**Step 2 — Grill one assumption at a time.** For each, ask via `AskUserQuestion` with the assumption stated in plain language (no jargon, no class names), "Correct as stated" as the first option, 1-2 concrete alternatives, and "Other / let me clarify". **Never batch** — the answer to assumption N often changes whether N+1 still applies.

**Step 3 — Fold outcomes into the handoff.** Every scanned item becomes part of the requirements you pass to `write-spec`, regardless of outcome — this is the ledger that lets the user sign off by skimming alone. `write-spec` runs its own Assumptions Audit on the technical sections it adds.

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
