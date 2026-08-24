# Plan 008: the pipeline-receipt skip never fires for a sequencing pipeline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat -- resources/boost/skills/evaluate/SKILL.md`
> plus `git log --oneline 870e300..HEAD -- resources/boost/skills/evaluate/SKILL.md`.
> **The text this plan reviews was uncommitted when the plan was written** — a
> concurrent session had it in the working tree at `870e300`. So compare against the
> *current* file, committed or not; if the Phase 1 wording quoted under "Current
> state" is gone or already reworded, treat it as a STOP condition and re-read
> "Why this matters" before changing anything.

## Status

- **Priority**: P2
- **Effort**: S (this repo) + a dependency decision (see Design)
- **Risk**: LOW — the change only widens when a skip is allowed; it never skips more than the evidence covers
- **Depends on**: `boost-pipeline` shipping `specs/scope-queries-against-a-partial-run.md`. Tags and scoped runs (v0.7.0) are a prerequisite, not the answer.
- **Category**: correctness / DX
- **Planned at**: commit `870e300`, 2026-08-24
- **Provenance**: consumer feedback, verified against a consumer checkout at `boost-pipeline` v0.6.1

## Why this matters

`evaluate` Phase 1 already reads a pipeline receipt, and the reasoning behind it is
right: the pipeline owns mechanical checks, this skill owns judgement, and without
the split a project pays twice for one answer.

It does not fire for the consumer that motivated it, and it never will as that
consumer is configured.

The skip is gated on `php artisan pipeline:verify` exiting 0, which requires
**every** step in the walk to be server-verified. A walk that contains agent steps
can never satisfy that, because an acknowledged step is a self-report and is never
counted as verified. The reporting consumer's walk holds two — `/evaluate` and
`/eye-verification` — as a recorded decision, so `pipeline:verify` there returns:

```
ERROR Run [r-abc123] passed every step the server ran, but 2 steps ([evaluate],
[eye-verification]) were only acknowledged, never verified, so this command cannot
exit 0. That is expected for a pipeline that sequences agent work.
exit: 1
```

Phase 1 currently says "Any non-zero exit means run the checks normally", which is
the correct reading of that exit code and the wrong outcome here: six shell steps
*were* verified against this exact tree, and the skill re-runs all of them anyway.
The double-run the section exists to remove survives untouched.

The receipt already holds what is needed. Same run, `storage/logs/pipeline/receipt.json`:

```json
{
  "all_verified": false,
  "state": "complete",
  "tree": "d8915e70bb2bb612",
  "verdicts": {
    "rector": "passed", "pint": "passed", "lint-all": "passed",
    "typecheck": "passed", "phpstan": "passed", "test-js": "passed",
    "evaluate": "acknowledged", "eye-verification": "acknowledged"
  }
}
```

Six `passed` verdicts and one tree fingerprint. The aggregate exit code throws that
detail away, and it is exactly the detail Phase 1's criterion 3 asks the model to
reconstruct from memory.

## Current state

### `resources/boost/skills/evaluate/SKILL.md` lines 45–65

Uncommitted in the working tree at `870e300`, authored by a concurrent session.
Line numbers are from that working copy. Verbatim, the sentences this plan changes:

- line 50: ```php artisan pipeline:verify || true```
- line 53–55: "Exit 0 means a run verified **the code currently on disk** … Skip the
  mechanical checks that run covered and say so"
- line 60–61: "Any non-zero exit means run the checks normally: no run recorded, a
  run against different code, or a run that did not verify every step. Do not read
  the reason as a reason to skip anything."

The third bullet is where the loss happens: "did not verify every step" is lumped
in with "no run recorded", and those are not the same evidence.

## Design

**The skill cannot fix this alone, and should not try.** Freshness is a comparison
against a tree fingerprint whose algorithm belongs to `boost-pipeline` — the skill
would have to recompute it to know whether a `passed` verdict still describes the
code on disk. Parsing `receipt.json` and re-deriving the fingerprint in prose is
how this becomes wrong six months from now.

Two ways forward. The executor picks one and records the choice in the status row.

> **Decision, 2026-08-24 — Option A, and not the flag this plan sketched.** Handed
> off to `sandermuller/boost-pipeline` as `specs/verifying-what-the-server-ran.md`,
> against that repo's commit `83d7c58`. Three corrections came out of that review:
>
> - **`--step=<id>` is the wrong flag.** A step id is project-chosen, so the skill
>   cannot name one generically — it would need the same check-to-step-id mapping
>   Option B was rejected for.
> - **A tag-scoped query was the wrong answer too**, though it was the first one
>   drafted. It makes `pipeline:verify` load and execute consumer PHP to answer a
>   question about a JSON file, and buys per-scope precision nobody has asked for.
>   The scoped case is already served: a consumer who scopes at `open_run` gets a
>   shell-only receipt whose `all_verified` is true.
> - **The affordance is `pipeline:verify --server-run-only`** — exit 0 when the walk
>   finished and every verdict the server produced is a pass, acknowledgements
>   excluded and never counted. No config, no mapping, no tag vocabulary.
>
> Two guards came out of review, and the second makes this bigger than a flag.
> `state === complete`, because the receipt is written after every resolution, so a
> walk abandoned at step 1 would otherwise report a formatter, an analyser and a suite
> that never ran. And a **new persisted `coverage` key**, because `all_verified` is
> false for two unrelated reasons — an acknowledgement, and a declared step dropped
> before the walk began — and the receipt records neither. Excluding only
> acknowledgements would exit 0 for a run that never ran a declared gate. That is a
> receipt-contract change in `boost-pipeline` and needs sign-off there before any of
> it is built.
>
> This plan stays BLOCKED until that ships. Steps 2 to 5 below then apply, reading
> `--server-run-only` wherever step 1's sketch said `--step=<id>`. Step 5 drops:
> the CHANGELOG is CI-managed in this repo too.

## Scope

In scope: the Phase 1 wording in `evaluate/SKILL.md`, and — under Option B only —
the schema slot plus its README row.

Out of scope: anything about what a verdict means, `all_verified`, or the exit
contract of `pipeline:verify` as it stands. The aggregate command is correct for a
gate; this plan is about a second, finer question it cannot answer.

Also out of scope: the consumer's decision to keep agent steps in its walk. That is
settled and recorded in its own config; treat it as a given, not a problem to fix.

## Steps

1. Choose Option A or B. If A, open the request on `sandermuller/boost-pipeline`
   first and set this plan BLOCKED with the issue link until it ships.
2. Rewrite lines 60–61 so "did not verify every step" is separated from "no run
   recorded". A run that verified the mechanical steps and stopped short only on
   agent steps is *positive* evidence for those steps.
3. State the per-step rule with the same care the current text has: a step counts
   only when its verdict is `passed` **and** the receipt describes the tree on disk.
   An `acknowledged` verdict is never evidence of anything mechanical.
4. Keep the whole section conditional on the project actually running the package.
   Measured on the author's machine at handoff time: of 20 local checkouts declaring
   `boost-skills`, 4 have an `artisan` and two of those are worktrees of the same
   application — so **two** distinct projects can host the MCP server, and the rest
   are packages that cannot. `|| true` already keeps a missing command harmless;
   the point is that the section must never read as a required step.
5. CHANGELOG entry, per this repo's convention.

## Test plan

No automated test covers skill prose. Verify by reading, against a real consumer:

1. In a checkout with the pipeline installed and a walk containing agent steps,
   drive a full run, then confirm `pipeline:verify` exits non-zero while
   `receipt.json` shows every mechanical step `passed`.
2. Confirm the rewritten text tells a reader to skip those mechanical checks and to
   still run everything the receipt does not cover.
3. Confirm a stale receipt (edit any tracked file after the run) leads the reader to
   run the checks normally.

## Done criteria

- Phase 1 distinguishes "no evidence" from "partial evidence" and acts on the latter.
- A sequencing pipeline benefits from the skip for the steps it did verify.
- No fingerprint arithmetic or JSON parsing is described in the skill body.
- The section still degrades to "run the checks" when the package is absent.

## STOP conditions

Stop and report if any of these proves false:

1. **The receipt is a public contract.** Option B reads `verdicts` and `tree` from
   `storage/logs/pipeline/receipt.json`. If those keys are internal or unstable,
   Option B is unsafe. Option A does not read the file at all, which is the main
   reason to prefer it.
2. **The scope-query change shipped but behaves differently from the table above.**
   Re-run both rows against a real consumer before relying on either. Do not emulate
   it by parsing JSON in prose without re-reading Design.
3. **A per-step skip would let an `acknowledged` verdict stand in for a mechanical
   check.** That is the laundering this whole design exists to prevent. If the
   wording cannot keep them apart, stop.

## Consumer contract (out of scope here)

The consumer that reported this runs the pipeline as a **sequencer, not a gate**,
recorded in `.config/pipeline.php`: six shell steps plus `/evaluate` and
`/eye-verification`. That choice is deliberate — the agent steps arrive one at a
time and cannot be skipped when context runs low — and it is the reason
`pipeline:verify` never exits 0 there.

They track the double-run in their own tracker, opened before it was noticed
that this repo already had the integration in progress. That issue should be
re-scoped to this finding or closed in favour of this plan.

**Timing note.** Because the Phase 1 text is still uncommitted, the cheapest
outcome is that whoever is writing it folds this in before it lands, and this plan
is closed as REJECTED with that commit as the reason. Nothing here needs to become
a second change on top of a shipped one.

Their step ids, if a mapping is ever needed: `rector`, `pint`, `lint-all`,
`typecheck`, `phpstan`, `test-js`. Formatting and static analysis are declared as
parallel groups, which does not change the receipt shape — a group's steps each get
their own verdict.
