## JavaScript & TypeScript

### Control Structures

- Always use curly braces for control structures, even for a single statement.
- Never use single-line `if/return`, `if/break`, or `if/continue` statements.
- Each control-structure statement goes on its own line.

```js
// ❌ WRONG — single-line control structures
if (index === -1) break;
if (! element) return 0;
if (query === '') return;

// ✅ CORRECT — curly braces, each statement on its own line
if (index === -1) {
    break;
}

if (! element) {
    return 0;
}

if (query === '') {
    return;
}
```

## Eye-verify frontend changes (browser/runtime)

A change that renders UI calls for **seeing it run in a real browser** — type-check and linting
can't see runtime/visual bugs: stale state, dead toggles, broken scroll / sticky / fixed
behaviour, z-index show-through, async races, untranslated-key leaks.

- **When:** the diff touches code that renders to users — JS/TS that drives the DOM, or a
  server-rendered template/component.
- **How:** drive it in a real browser. Use the project's browser eye-verify harness if it
  ships one (commonly under `tools/verify/`, with a setup doc loaded on demand); otherwise a
  browser-automation tool (Playwright, or a Playwright MCP server). DOM/console first;
  screenshots back up visual claims.
- **Verify behaviour, not just geometry** — a fixed/sticky element must also not be painted
  over, and pop-out content (dropdowns / tooltips / modals) must still escape.
- **In an ephemeral clone or git worktree**, the app may be served at a different host/port
  than the canonical checkout, so the harness can silently verify the *wrong* tree — confirm
  it targets *this* checkout, and sanity-check the host serves a real page before trusting a
  green. A hard 404 on the expected page is the signature of hitting the wrong host.
- If the harness can't run (no seeded data, wrong host served, no login), **stop and ask** —
  don't substitute reasoning for the browser.

### Verify against the design, per element

When the change has an approved design (a mockup, a Figma frame, a ticket attachment), don't
eyeball the whole image and call it close — *"looks about right"* is how visual regressions
ship (a 4px-vs-8px radius, a lost gradient, a control 3px off-centre). Verify it **element by
element, attribute by attribute**, and record each delta as a fix or a question for the
designer. The full attribute rubric and the per-element scoring table live in the
`frontend-quality` skill's `references/design-verification.md` — that skill walks it as a
suggested step, and the `pull-requests` skill flags it before a PR.
