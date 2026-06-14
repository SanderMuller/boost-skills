---
name: implement-spec
description: "Implements a specification file phase-by-phase with progress tracking. Activates when: implementing a spec, building from a spec, starting a spec phase, or when user mentions: implement spec, spec file, implement phase, build spec, start phase."
argument-hint: [spec file path, e.g. specs/wildcard-performance.md]
---

# Implement Spec

Implements a specification file phase-by-phase, tracking progress directly in the spec file.

## When to Use This Skill

Use this skill when:
- Implementing a feature described in a `specs/*.md` file
- The user asks to "implement this spec" or "start the next phase"
- Continuing work on a partially implemented spec

## Workflow Overview

```
Read spec -> Identify phases -> Implement phase -> Check off tasks -> Log findings -> Verify -> Next phase -> Final verification -> Create PR
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
6. **Determine the current phase** — the first phase with unchecked `- [ ]` tasks is the next to implement.

### Drift Preflight

Run this at the start of **every** invocation — the initial run *and* each resume for a later phase. Phase 2+ is routinely picked up in a fresh session where the working tree may have moved since the spec was written, so a once-only check isn't enough.

If the spec carries a `<!-- spec:planned-at <sha> <date> -->` stamp:

1. `git diff --stat <sha>` — files changed since the spec was planned. Use the **single-ref** form (not `<sha>..HEAD`): it compares the *current working tree* to the stamp, so it catches both committed changes and your own uncommitted edits to cited files. The `..HEAD` form would miss a dirty tree at implementation time.
2. For any cited file that changed, re-read it and confirm the spec's `file:line` references still point at the code they describe.
3. On a material mismatch (cited code moved or changed meaning): **stop and tell the user the spec has drifted**, point at the specific stale reference, and offer to refresh it — don't silently implement against stale line numbers.

Treat the baseline as unknown — re-read every cited file rather than trusting the diff — when the stamp carries a `+uncommitted` marker (the spec-write-time tree was dirty) or when `<sha>` is no longer in history (rebased/squashed away, so `git diff <sha>` errors).

No stamp (specs predating this convention, or non-git) → skip the preflight; it's not an error.

### Specs Without Phases

Some specs don't have explicit phases — they describe a single focused change. In this case, treat the entire spec as a single phase. Look for sections like "Proposed Changes", "Fix", or "Files Affected" to determine the work items.

## Step 2: Implement the Current Phase

For each phase:

1. **Read all relevant existing files** before writing any code.
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

### Between Phases

After each phase, ask the user if they want to:
- Continue to the next phase
- Review the changes first
- Stop for now

## Step 3: Final Verification (After All Phases Complete)

Once all task checkboxes are checked, use the `backend-quality` skill (Tier 2: full checks).

All checks must pass with 0 errors/failures. Fix any issues and re-run until clean.

## Step 4: Clean Up

After final verification passes, the spec file can be removed as part of PR creation or kept for reference — ask the user.

## Guidelines

- **One phase at a time.** Never implement multiple phases in a single pass.
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
