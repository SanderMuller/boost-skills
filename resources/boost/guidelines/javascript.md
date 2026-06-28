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
- If the harness can't run (no seeded data, wrong host served, no login), **stop and ask** —
  don't substitute reasoning for the browser.

The `frontend-quality` skill walks this as a suggested step; the `pull-requests` skill flags
it before a PR.
