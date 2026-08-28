---
name: eye-verification
description: "Command-only — invoke with `/eye-verification`; never activates on its own. Drives a frontend change in a real browser as the whole job, not one step of a quality gate: resolves the testables (PR body, tracker issue, spec edge cases, or gathered from the diff), executes each one against a running app, then stores the proof screenshots durably and attaches them to the PR/issue that exists. Reports Pass / Fail / NOT VERIFIED per testable with evidence."
argument-hint: "[issue key | PR number | nothing → autodetect from branch]"
disable-model-invocation: true
metadata:
  boost-tags: "frontend"
  boost-requires: "frontend-quality"
  schema-required: "^1"
---

# Eye-Verification — see the change run, prove what was seen

Eye-verify a frontend change in a real browser: *see it render and work*. The
`frontend-quality` skill has an eye-verify step too, but there it is one step among
type-check, lint, and tests. Here it is the entire job and it is **mandatory** — this
command exists precisely for the class of bug static checks cannot see: stale state, dead
toggles, broken sticky/scroll behaviour, z-index show-through, async races, untranslated
key leaks.

The how — which browser tool to use, the coverage contract, the traps that fake a green
run, fault injection, and the shipped Playwright harness (`scripts/screenshot.mjs`,
`scripts/console.mjs`, `scripts/auth-capture.mjs`, `scripts/lib.mjs`) — lives in the
**`frontend-quality`** skill: read its `references/eye-verify.md` and `scripts/README.md`
before driving anything, and its `references/design-verification.md` when the testable is
fidelity to an approved design. Do not hand-roll browser automation.

## Non-negotiable — the browser pass actually happens

- Not done until every resolved testable (and its edge cases) has been driven in a browser
  and its result evidenced — a DOM/console assertion, or a screenshot for canvas/visual
  surfaces. "Looks correct from the diff" is a failure of this command.
- If the harness genuinely cannot run at all (no running app, login bounces), **stop and ask
  the user** to resolve it. Never substitute reasoning for the browser, never report a green
  that wasn't observed. A *single* testable that can't be driven (needs a real external
  service, another tenant) is different — that one is reported NOT VERIFIED with its reason,
  and the rest still get driven.
- **Captured is not published.** A screenshot that proves a testable is evidence for the
  reviewer and QA, not a temp file. A shot left at an untracked local path that never
  reaches the PR/issue is a failure of this command — see Step 5.
- Evidence before claims: run the probe in this message, read the output, then state the
  result. Banned: "should work", "looks correct".

## Step 1 — Scope the change

- Cover **committed and uncommitted work both** — this command usually runs before the
  change is committed, so a committed-only scope would report "nothing changed" over a full
  working tree of frontend edits: `git diff --stat <base>...HEAD` (triple-dot, so it diffs
  from the merge base and not from whatever landed on the base since), plus
  `git status --short` and `git diff --stat HEAD` for staged, unstaged, and untracked files.
  Then read the full diff for the frontend files — and read any new **untracked** frontend
  file outright, since no diff command shows it. Note which surfaces changed (components,
  templates, styles, the JS that drives them).
- If nothing frontend/visual changed, say so and stop — there is nothing to eye-verify.

## Step 2 — Resolve the testables (priority chain; stop at the first that yields them)

Resolve the issue key / PR from the argument if given, otherwise autodetect: the issue key
from the branch name, and the PR for the current branch through the host's CLI (on GitHub:
`gh pr list --head "$(git branch --show-current)" --state all --json number,title,url,body`).

1. **PR available** → read the testing / reproduction section of its body (whatever the
   project's PR template calls it — "Steps to reproduce / test", "How to test") plus any
   edge cases listed there. A section left at its template placeholder has *yielded
   nothing* — fall through rather than stopping here. A PR title usually carries the issue
   key too; pull that and merge with step 2.
2. **Tracker issue available** (Jira, GitHub Issues — whichever the project uses) → take the
   testables from the description: the QA testables / test cases, and for a bug the
   reproduction steps plus expected-vs-actual. Failure paths, permission-restricted cases,
   and edge cases listed there are first-class testables, not extras; honour any stated
   prerequisites. Translate QA vocabulary into concrete browser steps (which record, which
   screen, which control, which expected visible result).
3. **Neither** → look for a **spec** matching the branch/feature under the project's spec
   convention (<!--boost:conv path="spec.filename_pattern" mode="inline"-->specs/{slug}.md<!--boost:conv:end-->). Resolve **where** to look the same way
   `clean-specs` and `pull-requests` do: `spec.directories` when configured —
   <!--boost:conv path="spec.directories" mode="inline"-->specs/<!--boost:conv:end--> — searching every entry; otherwise the single directory derived
   from the pattern, its literal prefix before the first `{…}` placeholder. Take its
   edge-case table (each row is a scenario plus expected handling) and its acceptance /
   user-flow scenarios.
4. **None of the above** → **gather the testables from the diff yourself** before verifying.
   Per changed surface: the happy path, the boundary/empty/error states, the
   permission-denied path, and both sides of any toggle. Keep each concrete (named record,
   screen, control, expected visible result). List them to the user so coverage is visible —
   do not silently invent one happy-path check and call it covered.

State which source the testables came from, and merge an edge case in from a second source
when it adds coverage (PR steps plus an issue edge case the PR omitted). If the project
ships durable quality docs (known behaviours, personas, regression contracts), pull the
entries matching the changed surfaces and add them — a broken durable contract is a failure
just as much as a change-specific testable.

## Step 3 — Set up the harness

Follow `frontend-quality`'s `scripts/README.md`. The three per-project seams are login,
serving/building the app, and data seeding — meet them before driving:

- **Serve the right checkout, and a fresh bundle.** The build output survives a branch
  switch, so serving the right tree does not mean the served JS was built from these edits.
  Rebuild the frontend after editing JS/CSS. Confirm a real page loads (a hard 404 is the
  signature of the wrong host — likely in an ephemeral clone or worktree served elsewhere).
- **Auth** — `scripts/auth-capture.mjs` saves a session the probes reuse via
  `--storage-state`; re-run it if a probe lands on the login page.
- **Data** — put the app into the state that reveals the change (run the migration, set the
  flag/field on a seeded record, seed at least two rows for any list surface). Revert seeded
  test data afterwards. Never point verification at a shared/production database, and never
  run a destructive database command as setup.

## Step 4 — Execute the browser pass (once per testable, including its edge cases)

- **DOM/console-first** is the primary signal; screenshots are the fallback for canvas and
  other visual surfaces. Assert one testable per check with an expected value, printing
  PASS/FAIL — `createChecker()` in the shipped `scripts/lib.mjs` does this; a drive-script
  that merely "ran without throwing" verifies nothing.
- For each testable: arrange its prerequisites, perform the steps, confirm the **expected
  visible result**, then check the console for errors, warnings, and untranslated-key leaks
  (`scripts/console.mjs`, including screen-reader attributes).
- Drive **mutations** end to end (create → reload round-trip → delete) and **full flows**
  through their last step, and drive the **failure path** with fault injection
  (`withFailedRoute`) — assert a visible error and a way forward, then recovery.
- Where a change renders through more than one path (e.g. an editor preview and the
  end-user render), it is only covered when **both** were seen.
- When the testable is fidelity to an approved design, do not score the screen as one
  pass/fail — run the per-element comparison in `frontend-quality`'s
  `references/design-verification.md`.

## Step 5 — Store and publish the evidence

A shot sitting at whatever local path the capture wrote it to is not evidence — it is a
temp file one `git clean` from gone. Every screenshot that proves a testable must be
**stored durably** and, when a PR or issue already exists, **attached to it**.

- **Store** — commit each kept shot into the repo on a stable path and naming pattern (one
  per distinct surface or state; skip near-duplicates), redacting sensitive or personal data
  first. Follow the project's existing convention for committed PR visuals if it has one.
  This is the durable home even when no PR exists yet.
- **PR exists** → embed the committed shots in the PR **body**; do not re-invent the
  mechanism — the `pull-requests` skill's *PR Description* section covers it (a committed
  file referenced by its branch blob URL, since base64 `data:` URIs get stripped and raw
  hosts don't render for private repos).
- **Tracker issue exists** → mirror the same files onto the issue so QA sees them. A private
  repo's blob URL will not render in an external tracker — there the image has to be
  uploaded to the issue itself.
- **Neither yet** → leave the committed files in place and say so in the report, so the
  later PR-creation / issue-update flow picks them up. Never leave the only copy in an
  untracked scratch path.

Committing evidence, editing a PR body, and attaching to an issue are not application-code
changes — the guardrail below permits them.

## Step 6 — Report

Per testable: **Pass / Fail / NOT VERIFIED**, with the evidence that proves it (the
DOM/console excerpt or the stored screenshot). Then:

- List every testable that could **not** be executed and why. Silent truncation reads as
  "covered everything" when it didn't.
- For each failure, give a concrete repro (steps, expected, actual) so it can be turned into
  a fix or a defect ticket.
- State the testables source (PR / issue / spec / gathered) and the environment the pass ran
  against (checkout, host, data), so the green is auditable.

## Guardrails

- Verification only — do **not** change application code from this command. A failing
  testable is reported; it gets fixed under the normal bug-fixing / PR flow.
- No destructive database commands, and never verify against shared or production data.
