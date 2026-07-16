---
name: implement-spec
description: "Implements a specification file phase-by-phase with progress tracking. Activates when: implementing a spec, building from a spec, starting a spec phase, or when user mentions: implement spec, spec file, implement phase, build spec, start phase."
argument-hint: [spec file path, e.g. specs/wildcard-performance.md]
---

# Implement Spec

Implements a specification file wave by wave — dependency-ordered, and parallel where phases are independent — tracking progress directly in the spec file.

## When to Use This Skill

Use this skill when:
- Implementing a feature described in a `specs/*.md` file
- The user asks to "implement this spec" or "start the next phase"
- Continuing work on a partially implemented spec

## Workflow Overview

```
Read spec -> Build dependency DAG -> Compute ready wave -> Implement wave (parallel where independent) -> Check off tasks -> Log findings -> Verify -> Next wave -> Final verification -> Create PR
```

## Step 1: Read and Understand the Spec

1. **Read the full spec file** to understand the complete feature scope.
2. **Locate the implementation section** — look for any of these headings:
   - `## Implementation`
   - `## N. Implementation Approach` (numbered variant in older specs)
   - `## Implementation Plan`
3. **Identify phases** — look for `### Phase N:` headings within the implementation section.
4. **Note the Edge Cases table** — if the spec has an `## Edge Cases` section, every scenario in it must be covered by tests and handled in the implementation. Treat unhandled rows as missing work.
5. **Note the STOP Conditions** — if the spec has a `## STOP Conditions` section, treat each entry as a tripwire while implementing: if one proves false, **stop and report** rather than improvising around it. Absent on specs predating the convention — that's fine, not an error.
6. **Build the dependency DAG** — read each phase's `**ID:** … · **Depends:** …` line and construct the graph. **Un-annotated specs (no `ID`/`Depends` line on the phases) get no DAG at all** — fall back to the original sequential model: work phases top-to-bottom in document order, skipping `Priority: LOW` unless requested, each its own single-phase wave. Do *not* synthesise implicit "depends on the previous phase" edges — a skipped `LOW` phase in the middle would leave every later phase permanently unready, a deadlock the old model never had. Annotation is **all-or-nothing**: build the DAG only when *every* phase has a unique `ID` and a `Depends` line; when *no* phase has them, use the sequential fallback; when only *some* do (a partially converted or hand-edited spec), **stop and ask** the user to finish or drop the metadata rather than guessing a hybrid. Then **validate the graph before computing waves**: every `Depends:` ID must resolve to a real phase, IDs must be unique, and no phase may depend on itself, sit on a cycle, or depend on a lower-priority phase. On any violation — or if wave computation ever yields no ready phase while incomplete phases remain — **stop and report**; never spin on a graph that can't progress.
7. **Compute the ready wave** — for an annotated spec, the set of *incomplete* phases (any unchecked `- [ ]` task) whose dependencies are **all** complete (every task in each depended-on phase checked; skip `Priority: LOW` phases unless the user asked for them). This is the next unit of work: a wave of one phase runs alone; a wave of several independent phases can be implemented in parallel — see [Step 2](#step-2-implement-the-current-wave). (In sequential fallback the ready "wave" is just the topmost incomplete non-skipped phase — one at a time, as before.) If an incomplete phase depends on one that was skipped as `Priority: LOW`, it can never become ready — surface that to the user rather than stalling silently.

### Drift Preflight

Run this at the start of **every** invocation — the initial run *and* each resume for a later phase. Phase 2+ is routinely picked up in a fresh session where the working tree may have moved since the spec was written, so a once-only check isn't enough.

If the spec carries a `<!-- spec:planned-at <sha> <date> -->` stamp:

1. `git diff --stat <sha>` — files changed since the spec was planned. Use the **single-ref** form (not `<sha>..HEAD`): it compares the *current working tree* to the stamp, so it catches both committed changes and your own uncommitted edits to cited files. The `..HEAD` form would miss a dirty tree at implementation time.
2. For any cited file that changed, re-read it and confirm the spec's `file:line` references still point at the code they describe.
3. On a material mismatch (cited code moved or changed meaning): **stop and tell the user the spec has drifted**, point at the specific stale reference, and offer to refresh it — don't silently implement against stale line numbers.

Treat the baseline as unknown — re-read every cited file rather than trusting the diff — when the stamp carries a `+uncommitted` marker (the spec-write-time tree was dirty) or when `<sha>` is no longer in history (rebased/squashed away, so `git diff <sha>` errors).

No stamp (specs predating this convention, or non-git) → skip the preflight; it's not an error.

### Specs Without Phases

Some specs don't have explicit phases — they describe a single focused change. In this case, treat the entire spec as a single phase (a one-phase wave, always worked solo). Look for sections like "Proposed Changes", "Fix", or "Files Affected" to determine the work items.

## Step 2: Implement the Current Wave

A **wave** is the set of incomplete phases whose dependencies are all satisfied (computed in Step 1). Implement one wave at a time. Within a wave the phases are independent and — per the spec's independence contract — write-disjoint, so their order doesn't matter and they may run concurrently.

### Wave Execution: solo vs parallel

**Solo (default).** Work the wave's phases one at a time, in any convenient order, each through the Per-Phase Checklist below. This is the mode whenever multi-agent orchestration is not in play — no fan-out, no worktrees.

**Parallel (explicit opt-in only).** Parallel mode is off unless one of these is explicitly true — never infer it: the runtime signals a parallel-agent mode (e.g. Claude Code's *ultracode*), or the user explicitly asks to parallelise. When that holds **and** the ready wave has two or more phases, fan the phases out — one agent per phase (e.g. a workflow) — instead of doing them in series:

- **Only ever parallelise phases within the same wave.** They have no dependency edge between them and are write-disjoint by the spec's contract. Never parallelise across a dependency edge — a dependent phase must wait for the wave that produced its input.
- **Verify write-disjointness before fanning out — don't blindly trust the spec.** From each phase's tasks plus your own file research, list the files it will write. If two phases in the wave could touch the same file (likely in hand-written, converted, or older specs), do **not** parallelise them — work that wave solo/serially, or stop and have the spec add an edge to serialise them. Worktree isolation prevents crashes, not logically conflicting edits to the same file.
- **Resolve every Open Question affecting the wave *before* fanning out** — a fanned-out agent can't stop to ask the user, so user-answerable gates must clear up front. STOP Conditions are runtime tripwires, not pre-clearable gates: hand the spec's STOP Conditions to every phase agent so that if one proves false mid-flight it halts the wave (next bullet).
- **Run each phase agent in worktree isolation** so concurrent edits can't collide. Give each agent the spec, its single phase, and the Per-Phase Checklist. Have it **return its checkbox results and Findings notes as structured output** — it must not write the spec file itself.
- **Integrate, verify, *then* reconcile.** After the wave's agents finish, first integrate all their worktree changes into the canonical tree, then re-run the wave's phase tests *there* — write-disjoint phases can still clash semantically (shared APIs, generated files, test setup, service bindings, dependency versions). Only once the integrated tree is green do you apply the `- [x]` updates and merge Findings into the one canonical spec. Parallel agents never write the spec concurrently.
- **A tripwire halts the whole wave.** If any phase agent hits a STOP Condition or an unforeseen Open Question mid-flight, stop the wave: cancel the remaining agents, and do **not** integrate any sibling worktree or check off any task from this wave. Report the tripwire and what each agent had produced, then wait for the user — resume only what they explicitly approve.
- A wave of one phase is never parallelised; it's just the solo path.

Absent that explicit signal, stay solo — do not fan out just because a wave *could* be parallelised.

### Per-Phase Checklist

For each phase — whether worked solo or by a fanned-out agent:

**In parallel mode a fanned-out agent never edits the spec file and never asks the user.** Any step below that writes to the spec — 2 (Open Questions), 4 (checkboxes), 8 (Findings) — is instead **returned as structured output** for the orchestrator to apply on join (see [Wave Execution](#wave-execution-solo-vs-parallel)). If step 2 surfaces an open question that wasn't resolved before fan-out, the agent **halts and returns it** rather than asking or proceeding. Solo, you write the spec directly and raise questions with the user as each step says.

1. **Read all relevant existing files** before writing any code. When the phase needs pattern-hunting beyond the files it will edit — how a sibling feature does it, where a convention lives, which callers exist — dispatch a read-only research subagent (e.g. Claude Code's `Explore`) for that sweep and work from its report (conclusions + `file:line`); read inline only the files the phase actually changes.
2. **Raise any open questions** from the spec's Open Questions section that affect this phase. Don't make assumptions — ask the user. After the user answers, move it from `## Open Questions` to `## Resolved Questions` with the decision and rationale.
3. **Implement each task** described in the phase.
4. **Check off each task** (`- [x]`) in the spec file as you complete it.
5. **Write tests** for all new functionality — happy paths, failure paths, and edge cases. Every scenario in the spec's `## Edge Cases` table that the current phase touches must have a corresponding test.
6. **Run Pint** on changed files:
   ```bash
   vendor/bin/pint --dirty --format agent
   ```
7. **Run the phase tests** to confirm they pass:
   ```bash
   vendor/bin/pest tests/RelevantTest.php
   ```
8. **Log notes in the Findings section** — record any design decisions, deviations from the spec, or discovered issues.

**Do NOT run PHPStan or the full test suite between phases.** These are slow and only run at Final Verification (Step 3) after all phases are complete.

### Between Waves

After each wave completes, ask the user whether to:
- Continue to the next wave
- Review the changes first
- Stop for now

## Step 3: Final Verification (After All Waves Complete)

Once every task checkbox in all **non-skipped** phases is checked (phases skipped as `Priority: LOW` are excluded from this condition), use the `backend-quality` skill (Tier 2: full checks).

All checks must pass with 0 errors/failures. Fix any issues and re-run until clean.

## Step 4: Clean Up

After final verification passes, decide the spec file's fate with the user: remove it as part of PR creation, or keep it for reference. If removing, don't hand-delete it from memory — the `pull-requests` skill (step 11) detects the branch's spec from the `origin/<base>...HEAD` diff, removes it, and verifies no spec (its own or an unrelated one swept in by a broad `git add`) is left added or modified before the PR goes to review. A spec that nonetheless reaches the base branch (removal skipped, or swept in later) is caught post-merge by the `/clean-specs` command.

## Guidelines

- **One wave at a time.** Never start a phase whose dependencies aren't all complete, and never begin the next wave until the current one is done and its gate has passed. Within a wave, phases may be worked serially (solo) or concurrently (parallel/ultracode) — but a wave boundary is a hard barrier.
- **Spec is the source of truth.** Follow the spec's design decisions. If you disagree with a design choice, raise it with the user before deviating.
- **Deviation contract.** When reality diverges from the spec mid-phase: a **minimal, documented** deviation — logged in `## Findings` with its rationale — is acceptable when it serves the spec's intent and stays within the phase's scope. An **undocumented** deviation is a failure. If a `## STOP Conditions` entry triggers, stop and report instead of adapting.
- **Check off tasks as you go.** The `- [x]` checkboxes in the spec are the single source of progress. Don't leave them for the end of a phase.
- **Log findings.** When you make a design decision, deviate from the spec, or discover something unexpected, add a note to the `## Findings` section.
- **Tests are mandatory.** Every phase must have test coverage before it can be considered complete.
- **Tests must assert the behaviour.** A test that passes without exercising the change is not coverage. Each test must assert the spec'd observable behaviour — confirm the assertion would fail if the behaviour were absent before checking the Tests box.
- **Edge cases are not optional.** If the spec has an `## Edge Cases` table, every scenario must be handled and tested before the spec is done.
- **Progress must be accurate.** Never check off a task if its tests are failing.
- **Don't skip verification.** The final verification gate exists to catch cross-phase regressions. Run every step.
- **Open questions in the spec** should be raised with the user before implementing the affected section. Don't make assumptions.
- **Future/deferred phases** (marked `Priority: LOW`) should be skipped unless the user explicitly requests them.
