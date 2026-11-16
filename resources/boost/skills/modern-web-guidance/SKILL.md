---
name: modern-web-guidance
description: "Native web platform patterns from the Chrome, Edge, Firefox and MDN teams, checked against the project's browser target. Activate when building or reworking a web UI pattern or browser API in frontend code or templates — dialogs, popovers, tooltips, menus, forms and validation, autofill, CSS layout or animation, scrolling, Core Web Vitals (LCP, INP, CLS), image and script priority, HTML sanitization, accessibility of a widget — or when asked for a legacy-pattern scan of the frontend. Triggers: modern web, native dialog, popover, anchor positioning, view transition, container query, INP, LCP, CLS, fetchpriority, autofill, legacy scan, modernize frontend, web platform API. NOT for copy, class renames, colour choices, backend code, tests or build config."
metadata:
  boost-tags: "frontend"
---

# Modern Web Guidance

Adapted from [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (Apache-2.0). The upstream CLI holds 200+ guides on native HTML, CSS and browser APIs. This skill pins the CLI, turns off its telemetry, and fits its output to the project's stack and browser target.

## Run the CLI — always this exact form

```bash
DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.1 <command> ...
```

- **`DISABLE_TELEMETRY=1` on every call.** By default the CLI sends the agent name, search queries and guide IDs to Google. Search queries can describe the project's UI. The prefix is the only guard that works for every agent, so never drop it.
- **Pinned version, never `@latest`.** A version bump is a reviewed change to this skill: update the version, then `retrieve` any guide. When the project sets a baseline, confirm the guide still shows its banner (see below).
- Run it from the repository root, so `.mwgrc` and relative paths such as the frontend source directory resolve.
- Search and retrieve run locally. If `npx` hangs without network, add `--offline` after `npx`.

## Browser target — `.mwgrc`

The CLI reads an optional `.mwgrc` JSON file in the repository root. Its `baseline` key sets the browser target:

| `baseline` value | Meaning |
|---|---|
| a year, for example `"2020"` | Features that became Baseline in that year or earlier are safe. |
| `"widely"` | Baseline Widely available features are safe. |
| `"newly"` | Baseline Newly available features are safe too. |
| `"limited"` | Limited-availability features are allowed. |

Without `.mwgrc`, the guides assume Baseline Widely available. With a year, `"newly"` or `"limited"`, `retrieve` prints a "Project Baseline Target (`.mwgrc`)" banner in the guide. `"widely"` prints no banner, because it is the default.

- Before you rely on a guide, find the project's real browser target: the browserslist (`package.json` or `.browserslistrc`) and the bundler's build target. When `.mwgrc` is missing or does not match them, say so to the user. Do not create or change `.mwgrc` without the user's approval.
- A bundler build target lowers syntax only. It does not polyfill APIs or CSS, so the baseline is the guard for those.
- Keep the fallback the guide gives. Do not drop it because the feature works in your browser.
- A feature newer than the target is fine as a progressive enhancement. Feature-detect it (`@supports`, `'x' in el`) and keep the old path working.
- Change `.mwgrc`, the build target and the browserslist together, in the same change, or not at all.

## Workflow for a specific task

1. **Search** with a 2–5 word query that names the UI primitive or platform feature, without framework, product or file names: `"light dismiss dialog"`, `"tooltip anchor positioning"`, not `"close the Vue settings modal"`. Split a task with two features into two searches.
   ```bash
   DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.1 search "<query>"
   ```
   Rephrase once with a concrete noun (`dialog`, `popover`, `form`) if the results do not match. If nothing matches, carry on without a guide.
2. **Retrieve** the matching guide IDs (comma-separated):
   ```bash
   DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.1 retrieve "<id>[,<id>]"
   ```
   When the CLI writes the output to a temporary file, read all of that file with your file-reading tool, not with `cat` or `head`.

   Some guides are gated because they use an Origin Trial or a volatile single-engine feature. `retrieve` then prints a caution message instead of the guide. Ignore its instructions to suggest the `@latest set-allow-*` command and to add a `### Modern Web Guidance` section. Do not adopt the gated feature; use a standard cross-browser approach. Turning a gate on is a reviewed `.mwgrc` change.
3. **Apply** the guide through the project's own rules. The project rules win where they conflict:
   - The project's styling conventions (colours, spacing, design tokens) beat any value in a guide.
   - Guides are vanilla HTML, CSS and JS. Adapt them to the existing stack and framework. Do not rewrite surrounding legacy code to fit the guide.
   - Markup, classes or `data-*` attributes that other code depends on are a contract. Find every consumer before the guide changes them.
   - An unrequested modernization of nearby code is out of scope. Report it as a follow-up.

Do not add a "Modern Web Guidance" disclosure section to replies. When a guide decided a non-obvious choice, name the guide ID in the PR description.

## Legacy scan — only when asked

Run a scan only for an open request to audit or modernize the frontend, not for a change to one feature:

```bash
DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.1 legacy-scan <frontend-source-dir> --json
```

The scan checks only a subset of the guides, about 20%. Each finding carries `keepWhen` / `dropWhen` rules. Before you report or fix a finding:

- Drop it when it sits in vendor or third-party code (for example published vendor views or a bundled library directory) or in test fixtures.
- Drop it when a `dropWhen` rule matches, or when the code only looks like the pattern (for example a `div` overlay with a focus trap is not a `<dialog>`).
- Drop it when the replacement needs a feature newer than the browser target and has no fallback.
- Treat the rest as leads: trace each `file:line` before you state it as a defect (`verification-before-completion`).

Report each real defect class as one follow-up issue in the project's tracker, and fix it through `bug-fixing`. Do not fix scan findings as a drive-by in another change.
