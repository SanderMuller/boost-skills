---
name: frontend-quality
description: "Frontend quality checks: TypeScript type check, linting, and the JS test suite (Vitest/Jest). Activate after editing JS/TS files. Triggers: eslint, typescript, tsc, type check, lint, vitest, jest, test:js, frontend tests, frontend checks."
metadata:
  boost-tags: "frontend"
---

# Frontend Code Quality

Run all frontend quality checks after making changes to JavaScript or TypeScript files. These checks must all pass before work can be considered complete.

## When to Use This Skill

Activate this skill when:
- JS or TS files have been created or modified
- Finalizing a feature, bug fix, or refactor that touched frontend code
- The user asks to run frontend checks, ESLint, or TypeScript checks
- Before creating a PR with JS/TS changes
- Applying review feedback or rework with JS/TS changes

## Checks (Run in Order)

### 1. Type Checking

If the project uses TypeScript, run its type-check script with the project's package manager — it is defined in `package.json` (commonly a `type-check` script; the underlying command is usually `tsc --noEmit`):

```bash
npm run type-check        # or: yarn / pnpm / bun — match the project's lockfile
```

Must show 0 errors. Fix any type issues found. Skip this check for a plain-JavaScript project with no type-checker.

### 2. Linting

Run the project's lint script — it runs whatever linter the project uses (ESLint, Biome, oxlint, …):

```bash
npm run lint        # or: yarn / pnpm / bun
```

If the project uses **ESLint**, you can scope it to the changed files for speed instead of linting everything. Run the project-local ESLint via its package manager (`npm exec` / `pnpm exec` / `yarn` / `bunx`):

```bash
eslint --cache --cache-location ".cache/eslint/" <file1> <file2> ...
```

Must show 0 errors. Fix any linting issues found.

### 3. Tests

Run the project's JS/TS test suite — its script is in `package.json` (commonly `test`, or a dedicated script such as `test:js`; the underlying runner is Vitest, Jest, etc.):

```bash
npm test        # or the project's script, e.g. `npm run test:js` — match the package manager/lockfile
```

Must show 0 failures. Fix any failing tests. When the change added or altered testable logic, **add or update a test for it** before the work is done — the `test-writing` skill covers what to write and where. During development you can scope to the changed area (e.g. `vitest run <path>`) and run the full suite at completion. Skip only when the project has no JS test setup.

## Quick Reference

| Check | Command | Pass criteria |
|-------|---------|---------------|
| Type checking | `npm run type-check` (TypeScript projects) | 0 errors |
| Linting | `npm run lint` (the project's lint script) | 0 errors |
| Tests | `npm test` (the project's JS test script) | 0 failures |

## Important

- Type-checking is project-wide — a change in one file can surface type errors in another, so a clean run matters beyond the files you edited.
- Know what your project's type-checker covers. Some setups leave certain component file formats (e.g. framework single-file components) out of the static check — those surface errors only at build or runtime.
- Type-check and lint prove the code is well-formed, not that it behaves — run the test suite too, and cover changed logic with a test (see the `test-writing` skill).
- Run every applicable check before the work is considered done — all must pass.
