---
name: clarify
description: "Turns a fuzzy ask into sharp, fact-checked intent before any work starts — reduces ambiguity, closes gaps, sharpens overloaded terms, and surfaces hidden assumptions, fact-checking against the codebase instead of asking what the code can answer. The shared questioning core that interview and promptimize build on; also usable standalone. Activates when: clarifying a vague request, disambiguating intent, reducing ambiguity, sharpening fuzzy terms, running a gap analysis, surfacing assumptions, or when user mentions: clarify, disambiguate, sharpen, vague, ambiguous, gaps, gap analysis, unclear ask."
argument-hint: "[the fuzzy ask or prompt to sharpen]"
---

# Clarify

Turn a fuzzy ask into sharp, fact-checked intent. The goal is **shared understanding** — resolve every ambiguity that would otherwise make the model guess — reached by leaning on the codebase first and the user only for what code cannot answer.

This skill owns the *questioning disciplines*. It is used standalone (`/clarify <ask>`) and as the shared core that two other skills build on:

- **`interview`** layers feature-requirements phases on top, then hands off to `write-spec`.
- **`promptimize`** layers a prompt-engineering rewrite on top and returns an optimized prompt.

When a host skill invokes these disciplines, apply them; the host owns what happens with the result.

## When enough is enough

Stop clarifying the moment intent is sharp enough for the caller's next step — not when a form is full. Over-questioning burns the user's patience as surely as under-questioning ships guesses. Rate the ask's clarity to yourself as you go; when it is high, stop.

## The disciplines

Apply these throughout, **one thread at a time** — this is interactive, not a batch form. The answer to one question routinely changes whether the next even applies.

### 1. Code-First — explore before asking

If a question is answerable by reading the codebase, **read instead of asking**:

- "Does this model already have a `status` column?" → check the migration.
- "What pattern do we use for this kind of resource?" → grep an existing one.
- "Is there already an authorization check for this?" → look for it.

**Delegate the bulky sweeps.** For anything beyond a single targeted lookup — mapping a feature area, checking how a pattern is used across files, verifying stated behaviour in several files — dispatch a read-only research subagent (e.g. Claude Code's `Explore`) and work from its brief (conclusions + `file:line`, no file contents), so multi-file reads never bloat this context. Targeted single-file lookups stay inline.

Only ask the user what the code cannot answer: intent, priorities, business rules, UX trade-offs, future plans. If the project ships reference docs (architecture, domain glossary, relationship maps), consult them first so terminology matches project canon.

### 2. Bisect toward intent

When the ask is one sentence, uses overloaded terms, or has several plausible readings, ask **bisecting questions** that cut the possibility space roughly in half each turn — not open-ended "tell me about X", but "is this A or B" until intent converges.

Example — ask: "Improve sharing"

1. "Is this about *inviting collaborators*, or *publishing to an audience*?" (internal vs external)
2. (external) "Is the gap in *who can access* the shared thing, or in *how the link works* once shared?" (access control vs link UX)
3. (access control) "Is this a *missing capability* (no password-protected links) or *friction with an existing one* (too many clicks)?"

After 2-4 such questions intent is usually sharp. Bisecting also applies mid-flow: if any answer reveals new fuzziness, drop in a bisecting question before continuing.

### 3. One question at a time, with a recommended answer

Default to **one question per turn**, each with a recommended answer plus 2-3 alternatives, so the user reacts (accept / pick another / push back) instead of drafting from scratch. Use `AskUserQuestion` with predefined options, recommendation first:

```
"How should errors be displayed?"
- Inline validation messages (Recommended)
- Toast notifications
- Modal dialog
```

Group questions only when they are clearly orthogonal and small. (`AskUserQuestion` appends its own free-text "Other", so never add a manual escape-hatch option.)

### 4. Sharpen fuzzy terms

When the user uses a vague or overloaded term, stop and resolve it to a canonical one:

> "You said 'item'. Do you mean a saved draft or a published record? Those behave differently here."

Check the project reference docs for the canonical name before proposing one.

### 5. Stress-test with concrete scenarios

When the user states a rule, invent a specific edge case that probes its boundary and force a precise answer. Don't accept "we'd handle that" — make them say what happens.

> User: "Editors can edit any record in their workspace."
> You: "An editor opens a record moved into their workspace yesterday, from a workspace whose owner just revoked their access. Can they edit it?"

### 6. Cross-reference stated behavior against code

When the user describes how something currently works, **verify it against the actual code** before building on it. Surface any contradiction immediately:

> "You said deleting a parent also deletes its children. The handler actually orphans them to the grandparent. Which behavior do you want here?"

### 7. Assumptions audit — the gap reducer

Before wrapping up, walk everything gathered and flag every place *you* silently inferred something the user did not say, then grill each one. Flag a statement when it meets **any** of these:

- **Magic numbers invented from nothing** — char caps, retry counts, backoff sequences, cache TTLs, delays, pagination sizes.
- **Naming or string content invented** — message templates, cache-key prefixes, error wording, queue names. The user likely has opinions on user-visible strings.
- **Behavioural defaults the user did not bless** — retry-vs-fail-fast, silent-skip vs surfaced-error, idempotency.
- **Unverified factual claims** — "all modern browsers support X", "this column is already indexed". If you asserted a fact the user couldn't check, flag it.
- **Deviations from the user's original wording** — surface original intent vs where it landed, even when they approved the change, so drift stays visible.
- **Filled-gap behaviours** — they said "block them", you picked the UX (error vs silent fail vs redirect).
- **Convention-added pieces the user did not ask for** — a factory/policy/observer added just because that's the usual wiring.
- **Implicit edge-case behaviour** — retry, conflict, timeout, missing related record, parallel invocation.
- **"Recommended" options accepted without engaging** — they took the recommendation; did they weigh the trade-off?

Exclude purely cosmetic inferences that don't change observable behaviour. Ask each via `AskUserQuestion` with the assumption in plain language (no jargon, no class names), "Correct as stated" as the first option, plus 1-2 concrete alternatives. **Never batch** — the answer to assumption N often changes whether N+1 still applies.

## Guardrails

- **Placeholders over fabrication.** For a missing specific (name, date, number, file), insert `[INSERT X]` rather than guessing.
- **Respect "skip" and "done".** If the user says skip, move on without pressing; if they say done, stop — but still run the assumptions audit on what was gathered before wrapping up.
- **Match the user's language.**
- **Capture decisions as they crystallize.** Keep a running tally (question, decision, rationale) so settled points aren't re-litigated and the hand-off stays accurate if the conversation runs long. Filter for what a future reader would wonder about — scope boundaries, behavior under conflict, terminology, real trade-offs — not cosmetic preferences.

## Output

This skill produces **sharpened intent**, not a document: a running tally of resolved questions, the assumptions ledger from the audit, and any terminology settled along the way. A host skill (`interview`, `promptimize`) takes it from there; used standalone, hand the summary back to the user.
