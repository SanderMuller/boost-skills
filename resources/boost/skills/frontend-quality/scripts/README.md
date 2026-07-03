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

## The three tools

| Script | What it does |
|---|---|
| `screenshot.mjs` | Navigate to a URL, optionally crop to a `--selector` with ≥15px padding (clamped to the page), save a PNG. Backs the design-verification capture step. |
| `console.mjs` | Load a URL and record console errors/warnings, uncaught page errors, and failed requests; `--text-pattern` scans rendered text for a project-supplied leak regex (e.g. untranslated-key markers). `--fail-on-error` exits non-zero when anything is found. |
| `auth-capture.mjs` | Open a **headed** browser, let a human log in by hand, and save a Playwright `storageState.json` when the login-complete signal is reached. The portable auth seam — it knows nothing about any login form. |

## Typical flow

```bash
# 1. Authenticated app? Capture a session once (needs a display):
node auth-capture.mjs --url https://localhost/login --out .auth/state.json \
  --success-url-contains /dashboard

# 2. Screenshot a changed element for design verification / the PR:
node screenshot.mjs --url https://localhost/settings --out shot.png \
  --selector "#ai-panel" --storage-state .auth/state.json

# 3. Confirm no runtime errors / untranslated keys on the page:
node console.mjs --url https://localhost/settings --storage-state .auth/state.json \
  --text-pattern '![A-Za-z0-9_.]+!' --fail-on-error
```

All three print a JSON report to stdout. Point them at the project's **already
running** app (this catalog does not start it). In an ephemeral clone / git worktree
the app may be served on a different host/port — target *this* checkout and confirm a
real page loads (a hard 404 means the wrong host).

## What stays per-app

This harness is the portable plumbing. App-specific glue is not shippable and remains
the project's: programmatic login to a specific SSO/form (the manual `auth-capture`
covers most needs), test-data seeding, and any domain drivers (opening a specific
editor/record, driving a player, etc.). See the skill's
[`references/design-verification.md`](../references/design-verification.md) for the
per-element scoring rubric these captures feed.
