# Plan 009: `evaluate` Phase 1 asks the question the pipeline can answer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat -- resources/boost/skills/evaluate/SKILL.md` plus
> `git log --oneline b14698b..HEAD -- resources/boost/skills/evaluate/SKILL.md`.
> **The Phase 1 text this plan rewrites is uncommitted in the working tree** at
> `b14698b` — a concurrent session improved the exit-code capture without
> touching the rule. Compare against the *current* file, committed or not. If
> the wording quoted under "Current state" is gone or already reworded, treat it
> as a STOP condition and re-read "Why this matters" before changing anything.

## Status

- **Priority**: P2
- **Effort**: S (this repo only — the package side has shipped)
- **Risk**: LOW — the change only widens when a skip is allowed, and adds a
  degrade path for a case that currently produces a confusing error
- **Depends on**: `sandermuller/boost-pipeline` >= **v0.10.0**
- **Category**: correctness / DX
- **Supersedes**: plan 008, which is now DONE-BY-DEPENDENCY on the package side.
  Read 008 only for the decision history; everything needed to execute is here.
- **Planned at**: commit `9006ec5`, 2026-08-25

## Why this matters

Phase 1 tells the model to ask the pipeline whether the code on disk is already
verified, and to skip the mechanical checks that run covered. The reasoning is
right: the pipeline owns mechanical checks, this skill owns judgement, and
without the split a project pays twice for one answer.

It has never fired for the consumer that motivated it, and as written it never
will.

The skip is gated on `php artisan pipeline:verify` exiting 0, which requires
**every** step in the walk to be server-verified. A walk containing agent steps
can never satisfy that: an acknowledged step is a self-report and is never
counted as verified. A consumer whose walk holds `/evaluate` and
`/eye-verification` as a recorded decision gets exit 1 forever, and the skill
re-runs six shell steps that were already green against this exact tree.

Two package releases have since made the question answerable, and a third has
made the current command actively wrong for some projects.

## What shipped in the package

All three verified against a real consumer walk before release.

### v0.8.0 — `--server-verified`

Exit 0 when every verdict **the server produced** is a pass, setting aside the
steps it could only acknowledge. This is the narrow question a sequencing
pipeline can answer.

Narrower is not looser. Five guards stand before the verdicts, so the flag drops
exactly one of the things `all_verified` was carrying and nothing else:

- the tree is identifiable (both fingerprints present),
- the walk covered the config that declared it (`coverage`),
- the cursor finished (`state`),
- the server produced at least one verdict,
- at least one of those passes actually **checked** the tree rather than
  rewriting it.

An older receipt that predates any of these reads as unknown, and unknown fails
closed.

### v0.9.0 — the message names what it counted

```
Run [r-4f2a] passed all 5 step(s) the server verified against this tree: [phpstan],
[pint-test], [typecheck], [test-js], [lint-all]. 1 step(s) rewrote the tree rather than
checking it and are not counted. 2 step(s) were only acknowledged and are not counted, so
this is not a claim that the tree is verified.
```

**This is what closes plan 008's open caveat.** That plan stopped short because
exit 0 said the steps the pipeline *ran* had passed, never *which* checks those
were — so a pipeline holding no static analysis still exited 0, and reading that
as "static analysis is covered" would skip a check nobody ran. The ids are in
the output now, so no config mapping and no JSON parsing are needed: the skill
reads the names and judges, which is the half of the split it already owns.

A mutating step (`->mutating()`, e.g. a formatter that rewrites) is deliberately
**not** in that list. It produced the tree rather than checking it, so its pass
says nothing about the result.

### v0.10.0 — several pipelines, and a bare call that can now fail

A project may declare a map of named pipelines, each with its own steps, cursor
and receipt. **A bare `pipeline:verify` is an error there**, naming the
pipelines and asking for `--pipeline=`:

```
ERROR  This project declares 3 pipelines [pr], [release], [evaluate], so "is this tree
verified" has no single answer. Ask about one with --pipeline=pr.
```

The command this skill runs today therefore fails on such a project — correctly,
but with an error the reader has no instruction for.

## Current state

### `resources/boost/skills/evaluate/SKILL.md`, Phase 1

Verbatim, the two passages this plan changes:

```bash
status=0; php artisan pipeline:verify || status=$?; echo "exit: $status"
```

> Any non-zero exit means run the checks normally: no run recorded, a run
> against different code, or a run that did not verify every step. Do not read
> the reason as a reason to skip anything.

The command asks the aggregate question. The sentence then lumps "did not verify
every step" in with "no run recorded", and those are not the same evidence: one
is an absence, the other is six green checks against this exact tree.

Everything else in Phase 1 — the applicability paragraph, the exit-code capture,
the per-check skip rule — is correct and stays.

## Proposed changes

### 1. Ask the narrow question

```bash
status=0; php artisan pipeline:verify --server-verified || status=$?; echo "exit: $status"
```

The bare call stays out of the skill entirely. It answers "is this tree
verified", which is a gate's question; this skill is asking "what has already
been checked", which is a different one.

### 2. Read the named ids, and skip only what they cover

Exit 0 means every check the pipeline ran passed against this exact tree, and
the message names them. Skip the mechanical checks those ids cover; run
everything else.

The ids are project-chosen and self-describing (`phpstan`, `pint`, `typecheck`,
`test-js`). Judging which check an id covers is judgement, not parsing — do not
add a config mapping, and do not read `receipt.json`.

**Exit 0 is not a claim that the pipeline holds the checks you care about.** A
pipeline declaring no static analysis exits 0 without any. The named ids are
what makes that visible; say what was skipped and on whose authority.

### 3. Say what a non-zero exit does and does not mean

Keep "run the checks normally", and keep the instruction not to mine the reason
for permission to skip. The difference this plan makes is that the *expected*
outcome for a sequencing pipeline is now exit 0 rather than exit 1, so a
non-zero exit is once again a real signal.

### 4. Degrade cleanly on a multi-pipeline project

When the project declares several pipelines the command errors and names them.
Default behaviour: **run the checks normally**, exactly as any other non-zero
exit. Nothing is skipped on a guess about which pipeline to ask.

A project that wants the skip can name the pipeline `evaluate` should ask about.
Add one optional slot to `resources/boost/conventions-schema.json` under the
existing `quality` object:

```json
"pipeline": {
  "type": "string",
  "description": "Which boost-pipeline pipeline `evaluate` asks about when the project declares several. Absent ⇒ evaluate runs its checks normally on a multi-pipeline project rather than guessing which one to trust."
}
```

Render it in the skill the way `translations` and `fixtures.anonymization`
already are, with a `<!--boost:conv path="quality.pipeline"-->` block, and append
`--pipeline=<value>` when set.

Absent is the safe default and changes nothing for a single-pipeline project.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Project does not run the package | `php artisan` is absent, exit non-zero, checks run normally. Already covered by the applicability paragraph — unchanged |
| Repo is a package, not an app | Same: no `php artisan`. Unchanged |
| Walk holds only agent steps | Exit 1 ("produced a verdict for none of them"). Nothing was verified, so nothing is skipped — correct |
| Walk holds only a passing formatter | Exit 1 ("rewrites the tree rather than checking it"). A formatter reports that it ran, never that the result is correct |
| Receipt predates v0.9.0 | Exit 1 (unknown coverage / unknown assertions). Unknown is not clean |
| Tree moved since the run | Exit 1 on staleness. The whole point of asking rather than recollecting |
| Pipeline declares no static analysis | Exit 0, and the ids do not include one. Run static analysis; skip only what is named |
| Project declares several pipelines, no slot set | Error naming them; run checks normally. Step 4 |
| Project declares several, slot set to a name it does not declare | Error naming what is configured; run checks normally. Same degrade path |
| Project declares one pipeline via a map of one | The bare-call rule counts, so `--server-verified` alone still answers. No slot needed |

## Implementation

- [ ] Swap the Phase 1 command to `--server-verified`, keeping the existing
      exit-code capture verbatim.
- [ ] Rewrite the exit-0 paragraph: name the ids as the evidence, skip only the
      checks they cover, and state that exit 0 never claims the pipeline holds a
      check it does not declare.
- [ ] Separate "no evidence" from "partial evidence" in the non-zero paragraph,
      without inviting the reader to mine a failure message for permission.
- [ ] Add `quality.pipeline` to `resources/boost/conventions-schema.json` and
      render it in the skill; append `--pipeline=` when set, degrade when not.
- [ ] Keep the whole section conditional on the project actually running the
      package. It must never read as a required step.
- [ ] Update `plans/README.md`: this plan's row, and mark 008 superseded.
- [ ] Tests — none; skill prose has no automated coverage. Verify by reading,
      against a real consumer (see below). CHANGELOG is CI-managed in this repo.

## Test plan

No automated test covers skill prose. Verify against a checkout that runs the
package and holds agent steps in its walk:

1. `php artisan pipeline:verify` exits 1 and `php artisan pipeline:verify
   --server-verified` exits 0, naming the shell steps.
2. The rewritten text leads a reader to skip exactly those named checks and to
   run everything else.
3. Edit a tracked file, re-run: `--server-verified` exits 1 on staleness and the
   text leads to running the checks normally.
4. On a multi-pipeline project with no slot set, the text leads to running the
   checks normally rather than guessing.

## Done criteria

- Phase 1 distinguishes "no evidence" from "partial evidence" and acts on the
  second.
- A sequencing pipeline benefits from the skip for the steps it did verify.
- No fingerprint arithmetic, JSON parsing or check-to-step mapping in the skill
  body.
- The section still degrades to "run the checks" when the package is absent,
  when the receipt is stale, and when the project declares several pipelines
  without saying which to ask about.

## STOP conditions

Stop and report if any of these proves false:

1. **`--server-verified` exits 0 on a real sequencing walk.** The whole plan
   rests on it. If it does not, re-read the guard list above against the
   consumer's actual receipt before changing any wording.
2. **The success message names the step ids.** If the output does not list them,
   this plan's step 2 has no evidence to read and reverts to plan 008's
   unresolved caveat — stop rather than skipping on the count alone.
3. **A skip would let an acknowledged step stand in for a mechanical check.**
   That is the laundering the package's own design exists to prevent. If the
   wording cannot keep them apart, stop.

## Open Questions

1. **Should `quality.pipeline` ship with this change, or wait for a project that
   needs it?** The degrade path in step 4 is correct without it, so the slot is
   an enhancement rather than a requirement. Shipping it now costs a schema entry
   and a rendered block; waiting costs a second pass through the same file. The
   plan assumes shipping it — drop that task if the maintainer prefers to wait.

## Consumer contract (context, not scope)

The consumer that reported this runs the pipeline as a **sequencer, not a gate**:
six shell steps plus two agent steps, recorded in its config. That choice is
deliberate — the agent steps arrive one at a time and cannot be skipped when
context runs low — and it is the reason the aggregate call never exits 0 there.
Treat it as a given, not a problem to fix.

Its step ids, for reference: `rector`, `pint`, `lint-all`, `typecheck`,
`phpstan`, `test-js`. Formatting and static analysis are declared as parallel
groups, which does not change what the message names — a group's steps each get
their own verdict. Note that `rector` and `pint` are mutating steps, so they will
**not** appear in the named list even when they passed.
