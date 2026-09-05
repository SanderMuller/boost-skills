---
name: test-value
description: "Judge the tests a change added or changed in both directions — delete the ones that prove nothing, name the assertions that are missing. Activates when: asking whether tests are worth keeping, trimming tests, finding untested behaviour, or when user mentions: test value, useless tests, missing assertions, does this test anything, framework testing."
argument-hint: "[optional: commit range or files, if not already resolved]"
---

# Judge Test Value

A suite grows in two bad directions at once: tests that assert nothing worth asserting, and behaviour with no test at all. This skill walks both, over the tests a change touched.

## When to Use This Skill

- `evaluate` reaches its test gate
- A review pipeline hands over its test-value step
- The user asks whether tests are worth keeping, or what is untested

Do NOT use for: writing the tests — `test-writing` owns how a test is built. This skill decides *which* should exist.

### Report-only mode

When a review pipeline runs several judgement lenses over one tree and applies their findings in a single later step, this skill **reports and does not edit**. The pipeline's step instruction says which mode applies. Invoked anywhere else — standalone, or from `evaluate` — apply the verdicts yourself.

## Scope

Use the evaluation scope already resolved for this change. Judge the tests it **added or changed**, plus the behaviour it changed that no test covers. Never touch a pre-existing test outside that scope. **Deleting a test needs the user's approval and a stated reason** — tests are part of the application, and a deleted test takes its scenario with it.

## Direction 1 — Tests That Prove Nothing

A test is a candidate for deletion or rewrite when it:

- **Restates the framework** rather than application behaviour — a cast round-trip, that a validation rule object holds the rule you passed it, that middleware is registered.
- **Mirrors the implementation** — an assertion that recomputes what the code computes, a re-derived signed value, an echoed constant. It passes when the code and the test are wrong in the same way.
- **Proves only dispatch** — a faked bus with an "it was queued" assertion and nothing that runs the job and asserts its real effect.
- **Promises a behaviour it never checks** — the name says one thing, the assertions check another, or check nothing.
- **Is brittle without being stronger** — asserts on incidental ordering, exact whitespace, or a whole payload where one field carries the meaning.

For each, the verdict is **delete**, **rewrite to assert the real behaviour**, or **keep with a stated reason**. Prefer rewriting over deleting when the scenario is worth covering and only the assertion is weak.

**A passthrough check is not automatically useless.** Faking the bus to prove "validation passed, work was scheduled" is fine *when* another test runs the job and asserts its effect. Check whether that other test exists before calling the first one worthless.

## Direction 2 — Assertions That Are Missing

Every behavioural change needs a test that **fails without it**. Walk the change and name what has no coverage:

- The happy path, the failure paths, and the edge cases — null, empty collection, zero, boundary.
- The branch the change actually added. A green test that merely executes the file is not evidence it reaches the change; prove it does, by watching it fail before the fix or by asserting the branch's own effect.
- For a bug fix, the reproduction — red before the fix. `bug-fixing` owns that flow.

Where a gap is real, write the test (see `test-writing`) or hand it to a test-writing subagent. Where a gap is deliberate, say so and why — a manual QA testable is a legitimate answer for behaviour that cannot be automated.

## Prefer Fewer, Higher-Leverage Tests

Both directions serve one goal. Adding a test to cover a gap and deleting three that assert nothing is a net improvement even though the count fell. Report the count honestly and do not treat a smaller suite as a loss.

## Report

Per test judged: file, verdict, and the one-line reason. Per gap: what is uncovered, and whether you covered it, handed it off, or recorded it as a manual testable. Say plainly when the tests were already sound — a change whose tests need nothing should produce that sentence, not invented findings.
