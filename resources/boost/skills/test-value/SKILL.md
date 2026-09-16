---
name: test-value
description: "Judges the tests a change added or changed, in both directions: the ones that prove nothing, and the behaviour with no test at all. Applies delete / rewrite / keep verdicts and covers the real gaps. Activates when: reviewing a change's tests, trimming a suite, asking whether a test is worth keeping or what is untested, or when user mentions: test value, useless tests, do these tests prove anything, trim tests, missing assertions, test coverage gaps."
argument-hint: "[optional: commit range or files, if not already resolved]"
---

# Judge Test Value

A suite grows in two bad directions at once: tests that assert nothing worth asserting, and behaviour with no test at all. Both cost — the first on every run and every refactor, the second on the day it breaks. This skill walks both over the tests a change touched.

## When to use this skill

- A change is written and its tests need judging before review
- `evaluate` or `code-review` reaches its testing dimension
- The user asks whether a test is worth keeping, or what is left untested

`test-writing` owns *how* a test is built — naming, structure, how many. This skill decides *which* should exist. Use them together: a rewrite verdict here follows `test-writing`'s rules for the replacement.

## Scope

Judge the tests the change **added or changed**, plus the behaviour it changed that no test covers. Where a scope has already been resolved for this change (`evaluate` Phase 2 resolves one), reuse it rather than re-deriving a wider one.

**Dispatch the `test-coverage-auditor` subagent where the session has it, for both directions at once.** It judges the suite in a fresh context and rates each gap, which is the half you cannot do for tests you just wrote. Its verdicts are leads: follow every one before acting on it, and merge them with your own. Without it, walk both directions yourself and say in the report that the audit was not independent.

**Never delete a test outside that scope**, and never delete one without stating why. A pre-existing test that looks worthless may be the only record of a bug someone hit; that judgement belongs to the user, not to a pass over an unrelated change.

## Direction 1 — Tests That Prove Nothing

A test is a candidate for deletion or rewrite when it:

- **Restates the framework** rather than the application's own behaviour — that a cast round-trips, that a validation rule the framework ships works, that the router dispatches to a controller at all. The framework has its own suite for that. A test asserting *this project's* configuration — that a route exists under the name callers use, that it carries the middleware it must — is application behaviour, and stays.
- **Mirrors the implementation** — the assertion recomputes what the code computes, echoes a constant the code reads, or rebuilds the value under test from the same parts. It passes for as long as the code stays identical, which is not the same as being correct.
- **Proves only that work was scheduled** — a faked queue or bus with an assertion that something was dispatched, and nothing anywhere that runs the work and checks its effect.
- **Promises a behaviour it never checks** — the name states one thing and the assertions check another, or check almost nothing.
- **Is brittle without being stronger** — it asserts on incidental ordering, exact whitespace, or a whole payload where one field carries the meaning. It fails on changes that break nothing.

The verdict per test is **delete**, **rewrite so it asserts the real behaviour**, or **keep, with the reason**. Prefer a rewrite when the scenario is worth covering and only the assertion is weak — deleting takes the scenario with it.

**A shallow check is not automatically worthless.** An assertion that work was scheduled is a fine test of "the request validated and enqueued" *when* another test runs that work and asserts its effect. Look for that other test before calling the first one empty.

## Direction 2 — Behaviour With No Test

Every behavioural change needs a test that **fails without it** — or, where no automated test can reach the behaviour, a documented manual check in its place. Name what nothing covers:

- The happy path, the failure paths, and the edge cases the change introduced — null, empty, zero, boundary
- The branch this change actually added, rather than a test that merely executes the file it lives in
- For a bug fix, the reproduction that was red before the fix (`bug-fixing` owns that flow)

Cover the real gaps. Where a gap is deliberate, say so and why — behaviour that cannot be reproduced automatically is a documented manual check, not a silent hole; `test-writing`'s *When Tests Aren't Possible* covers what to write instead.

## Report Honestly, Including a Falling Count

Both directions serve one goal: a suite where every test earns its run. Adding one test for a real gap and deleting three that assert nothing is an improvement even though the total fell, so report the numbers plainly and do not treat a smaller suite as a loss.

Per test judged, give the file, the verdict, and a one-line reason. Per gap, say what is uncovered and whether you covered it or recorded it as a manual check. When the tests were already sound, say that in one sentence — a change whose tests need nothing should produce that sentence, never an invented finding.
