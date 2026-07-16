# Eye-verify harness (shipped companions)

Framework-agnostic browser tooling the `frontend-quality` skill ships so a project
doesn't have to build its own. `boost sync` (boost-core ≥ 1.3) emits these beside the
rendered `SKILL.md` into each agent's skill dir (e.g.
`.claude/skills/frontend-quality/scripts/`). Edit the sources in
`resources/boost/skills/frontend-quality/scripts/`, not the emitted copies.

## Prerequisite

The catalog does not bundle a browser. Install Playwright in the project once:

```bash
npm i -D playwright && npx playwright install chromium
```

Each script fails fast with this hint when Playwright or its browser is missing.
Emitted assets carry no executable bit — always invoke via `node <script>`.
`console.mjs --axe` additionally needs `npm i -D @axe-core/playwright`.

## The tools

| Script | What it does |
|---|---|
| `screenshot.mjs` | Navigate to a URL, optionally crop to a `--selector` with ≥15px padding (clamped to the page), save a PNG. Backs the design-verification capture step. |
| `console.mjs` | Load a URL and record console errors/warnings, uncaught page errors, the main-document status, and failed requests. `--text-pattern` scans a project-supplied leak regex (e.g. untranslated-key markers) across **both** rendered text and screen-reader attributes (`aria-label`, `title`, `alt`, `placeholder`). `--axe` runs an axe-core accessibility/contrast pass. `--fail-on-error` exits non-zero when the page is not clean: console/page errors, leaks, serious/critical axe violations, a main-document ≥400 (wrong-host / dead page), or a failed application request (xhr/fetch). Every failed request (any type) is listed in `failedRequests` for inspection. |
| `auth-capture.mjs` | Open a **headed** browser, let a human log in by hand, and save a Playwright `storageState.json` when the login-complete signal is reached. The portable auth seam — it knows nothing about any login form. |
| `lib.mjs` | Not a runnable script — helpers a project's own drive-script imports: `createChecker()` (the coverage contract — PASS/FAIL per testable, a NOT-VERIFIED gap list, and failure-artifact capture), `capturePageIssues()` (attach console/`pageerror`/failed-request listeners *before* `goto`), `withFailedRoute()` (fault injection — force an endpoint to fail and assert the UI recovers). Imports no browser; operates on a `page` you pass. |

## Typical flow

```bash
# 1. Authenticated app? Capture a session once (needs a display):
node auth-capture.mjs --url https://localhost/login --out .auth/state.json \
  --success-url-contains /dashboard

# 2. Screenshot a changed element for design verification / the PR:
node screenshot.mjs --url https://localhost/settings --out shot.png \
  --selector "#ai-panel" --storage-state .auth/state.json

# 3. Confirm no runtime errors / untranslated keys / a11y violations on the page:
node console.mjs --url https://localhost/settings --storage-state .auth/state.json \
  --text-pattern '![A-Za-z0-9_.]+!' --axe --fail-on-error
```

The runnable scripts print a JSON report to stdout. Point them at the project's
**already running** app (this catalog does not start it). In an ephemeral clone / git
worktree the app may be served on a different host/port — target *this* checkout and
confirm a real page loads (a hard 404 means the wrong host).

## Writing a drive-script with `lib.mjs`

For anything beyond a one-shot check — a multi-testable flow, a mutation round-trip, a
failure path — write a small drive-script that imports the helpers. `createChecker`
turns the coverage contract into PASS/FAIL output; `capturePageIssues` must be attached
**before** the first `goto`:

```js
import { chromium } from 'playwright';
import { createChecker, capturePageIssues, withFailedRoute } from './lib.mjs';

const browser = await chromium.launch();
const page = await (await browser.newContext({ storageState: '.auth/state.json' })).newPage();
const issues = capturePageIssues(page);            // BEFORE goto — catches a dead bundle
const checker = createChecker({ page, label: 'settings' });

await page.goto('https://localhost/settings', { waitUntil: 'load' });
// issues.clean = no console/page errors, main document not ≥400, and no failed xhr/fetch:
checker.check('page booted cleanly', issues.clean, [...issues.pageErrors, ...issues.failedRequests].join('; '));
checker.check('save button visible', await page.getByRole('button', { name: 'Save' }).isVisible());
checker.skip('email delivery', 'needs a real SMTP credential — QA testable');

await withFailedRoute(page, '**/api/save', async () => {   // drive the failure path
  await page.getByRole('button', { name: 'Save' }).click();
  // wait on the state change, don't one-shot it right after the click (it races the roundtrip):
  const errorShown = await page.getByText('Could not save').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  checker.check('shows a visible error on save failure', errorShown);
});

await checker.summarize();   // prints the tally + gap list; exit code 1 on any failure
await browser.close();
```

See [`../references/eye-verify.md`](../references/eye-verify.md) for the full coverage
contract, the traps that fake a green run, and fault injection.

## What stays per-app — the three seams

This harness is the portable plumbing; three things are structurally the project's and
are not shippable (`references/eye-verify.md` covers them in full):

1. **Programmatic login** to a specific SSO/form — the manual `auth-capture` covers most needs.
2. **Serving + building** the app — this catalog points at an already-running app; host
   resolution and any fresh-bundle / right-checkout guard read the app's own build system.
3. **Data seeding + domain drivers** — sufficient fixtures, off-by-default state, and
   openers like "open this record" / "drive this widget".

See [`../references/design-verification.md`](../references/design-verification.md) for the
per-element scoring rubric these captures feed.
