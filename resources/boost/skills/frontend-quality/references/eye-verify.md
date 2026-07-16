# Eye-verify — see a UI change actually run, and prove what you saw

> Loaded on demand. Read this when a change renders UI and you're about to drive it in a
> browser. Type-check and lint prove the code is well-formed; they can't see stale state,
> dead toggles, broken scroll / sticky / fixed behaviour, z-index show-through, async
> races, or untranslated-key leaks. Eye-verify is how you catch that class — and this doc
> is how you keep the pass *honest* instead of a happy-path glance that reports green.
>
> For matching an approved design 1:1, pair this with
> [`design-verification.md`](design-verification.md). This skill ships a small harness
> (`scripts/`) so a project needn't build one — see [`../scripts/README.md`](../scripts/README.md).

## Which browser tool — reproducible harness first

There are two ways to drive a browser, and they are not interchangeable:

- **A reproducible harness on your own working tree** (this skill's `scripts/`, the
  project's own harness, or a Playwright MCP server pointed at the local app). This is the
  default and the answer to *"does my change work?"* — it drives the code you just edited
  and can be re-run by another agent or in a loop, producing evidence (screenshots,
  console/`pageerror` counts, PASS/FAIL lines).
- **An ad-hoc / live browser** (a browser-automation tool pointed at a deployed URL). Use
  this **only** for what the harness structurally cannot reach: reproducing a bug in a
  live/deployed environment where the deployed state is the thing under test, or a flow
  that needs a real external service the harness can't seed (SSO, a payment provider, a
  third-party video/OAuth host).

The tie-breaker: an ad-hoc browser drives *whatever URL you point it at* with no guarantee
it's your freshly-built code, so it can silently verify the wrong thing. It is
investigation, not evidence. For "did my diff work?" the answer is the harness.

## The coverage contract — map every testable to a check, name what you skipped

The failure mode of eye-verify is not broken tooling — it's **quietly verifying less than
the change's surface** (happy path only, a read-only probe of a create/edit/delete feature,
one of seven variants) and reporting green. Close it with a contract, *before* driving
anything:

1. **Derive the checklist first.** Enumerate every testable from the ticket / PR description
   ("steps to reproduce", acceptance criteria), the change's edge cases, and — for design
   work — **every annotation on the design** (a sticky-note "clicking this also opens the
   popup" is a requirement, not a hint). If there's no written source, gather them from the
   diff yourself: for each changed surface, the happy path, the boundary/empty/error states,
   the permission-denied path, and both sides of any toggle. List them so coverage is
   visible; don't silently invent one happy-path check and call it covered.
2. **One assertion per testable.** A drive-script that "ran without throwing" verifies
   nothing. Assert the *expected value* and print PASS/FAIL per line. `createChecker()` in
   [`../scripts/lib.mjs`](../scripts/lib.mjs) does this — `check(name, condition, detail)`
   per testable, then `summarize()`.
3. **Mutations count.** A create/edit/delete feature is not verified by reading seeded
   state — drive create → round-trip (reload, confirm it persisted) → delete, and restore
   any seeded row you changed. Record the before-state first.
4. **Full flows over first steps.** If the testable is "it pauses, asks each question, then
   resumes", drive *through the last step* — don't stop at "the overlay appeared", which
   silently halves the testable.
5. **Declare the gaps.** Anything on the checklist you could not drive (needs a real API
   key, another tenant, a manual play-through) is listed at the end as **NOT VERIFIED —
   reason**, never dropped. `checker.skip(name, reason)` records it. A green run with an
   explicit gap list is honest; an unqualified green that skipped cases is the failure mode
   this contract exists to kill.

## Traps that fake a green (or a red) run

Portable ways a browser pass lies. Most cost a real session to diagnose once:

- **Attach the error listeners *before* `goto`.** A `console` listener alone misses uncaught
  module-scope exceptions (`pageerror`); a bundle that dies on load produces a page with
  **zero console errors** where nothing ever initialized — it looks clean and silent.
  `capturePageIssues(page)` (in `lib.mjs`) wires `console` + `pageerror` + failed-request
  listeners in one call; attach it before the first navigation. (`scripts/console.mjs` does
  this internally for a one-shot check.)
- **A stale bundle greens against old code.** The build output usually survives a branch
  switch, so serving "the right checkout" does **not** mean the served JS was built from
  your edits — an old bundle verifies old code and reads green. Rebuild the frontend after
  editing JS/CSS, before driving. If the app has a way to assert the served build matches
  the checkout, use it.
- **Use real clicks, not synthetic ones.** Delegated event handlers (common in
  jQuery/Alpine/Livewire UIs) often no-op on a synthetic `element.click()` fired from
  `page.evaluate` — the "click" runs and nothing happens. Drive through the real input layer
  (Playwright `locator.click()` / `page.keyboard.press(...)`), which dispatches trusted events.
- **Never `waitForTimeout` across a server roundtrip.** Submit / save / delete flows race a
  fixed sleep — sometimes it's enough, sometimes not, and the flake reads as a bug. Wait on
  the *state change itself* (`page.waitForFunction(...)` keyed on the id/count you changed,
  or a selector that only appears once the roundtrip lands).
- **`fullPage` screenshots misplace `position: fixed` elements** (a floating save bar renders
  mid-page). That artifact is not a layout bug — crop to the element or use a viewport shot
  before reporting one.
- **Drive tables/lists with ≥ 2 rows.** A whole class of ORM bug (lazy-load / N+1 blow-ups,
  per-row state bleed, key collisions) only arms with more than one row — a single-row table
  and a single-record unit test both stay green while the real list crashes. Seed at least
  two rows before driving any list surface.
- **Read live state, not the boot snapshot.** The initial-state payload the page booted from
  (a JSON blob, a hydration array) never updates after an action. Read the live model /
  re-query the DOM after the action; a probe that reads the frozen boot payload reports a
  working feature as broken (or a broken one as working).
- **Placeholder / untranslated strings hide copy bugs.** A branch-new i18n key renders as its
  raw marker (`!key!`, `domain.section.key`, …) — invisible to type-check and lint, and to a
  visible-text-only scan when the leak is in an `aria-label` / `title` / `alt`. Scan for the
  project's key marker with `scripts/console.mjs --text-pattern '<regex>'` (it scans both
  rendered text and screen-reader attributes). A locally-unseeded key is expected in-review
  state, documented — not a bug; a key that shouldn't be raw is.

## Fault injection — drive the failure path too

A feature is not verified until its **failure** path was driven — that's where most
"works locally" bugs live, because nobody drives it. Force the endpoint to fail, assert the
UI surfaces a **visible error and leaves the user a way forward** (a retry, a dismiss — not
a silent hang or a falsely-successful state), then clear the fault and assert recovery.
`withFailedRoute(page, urlPattern, action)` in `lib.mjs` does the routing:

```js
import { withFailedRoute } from './lib.mjs';

await withFailedRoute(page, '**/api/save', async () => {
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('text=Could not save');   // visible error, not a hang
});
// route cleared — now retry and assert it succeeds (recovery).
```

## Promote a verified flow to a committed regression spec

A drive-script that proved a feature shouldn't be throwaway. Once a flow is understood,
promote it into a **committed spec** in the project's browser-test suite (`@playwright/test`
or whatever the project runs) so the flow becomes a permanent regression guard — reusing the
same `createChecker` / `capturePageIssues` / `withFailedRoute` helpers. A pixel **visual
baseline** (a golden screenshot diffed on later runs) is worth adding for a stable surface,
but baselines are typically **machine-local** (anti-aliasing differs per machine) — gitignore
the snapshots and recreate them deliberately, or adopt a hosted visual-review service when
the habit sticks. Don't pixel-baseline a surface that never settles (an animating timeline);
guard those numerically instead.

## What stays per-app — the three seams

The shipped `scripts/` are the portable plumbing; three things are structurally the
project's, and the harness leaves clean seams for them:

1. **Programmatic login.** Auth differs per app. `scripts/auth-capture.mjs` is the portable
   seam — a human logs in once by hand and the session is saved for reuse; it knows nothing
   about any login form, so it works anywhere. A *scripted* login (SSO, computing a 2FA code,
   a non-prod login route) is the project's to add.
2. **Serving + building the app.** This catalog points at the project's **already-running**
   app; it does not start or build it. Host resolution, dev-server vs static build, and any
   "am I serving the right checkout / a fresh bundle?" guard read the app's own build system,
   so they live in the project. In an ephemeral clone or git worktree the app may be served
   on a different host/port — target *this* checkout and confirm a real page loads (a hard
   404 is the signature of the wrong host).
3. **Data seeding + domain drivers.** Making the fixture sufficient (enough rows to overflow
   a scrollable table; the app in the state that reveals an off-by-default feature — run its
   migration, set the flag/field, rebuild), and any domain-specific driver ("open this
   record", "drive this widget to time T"), are the project's. Revert seeded test data after.

If a seam genuinely can't be met this session (no running app, an external service that
can't be seeded), that's an explicit deferral — name it in the NOT-VERIFIED list and, where
it matters, as a QA testable. "Couldn't set up the environment" without a specific failing
step is not a verification result.
