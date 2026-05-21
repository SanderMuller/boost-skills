---
name: frontend-quality
description: "Frontend quality checks: TypeScript type check + linting. Activate after editing JS/TS files. Triggers: eslint, typescript, tsc, type check, lint, frontend checks."
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

If the project uses TypeScript, run its type-check script — commonly `yarn type-check` (or `npm run type-check`); the underlying command is `tsc --noEmit`:

```bash
yarn type-check        # or: npm run type-check
```

Must show 0 errors. Fix any type issues found. Skip this check for a plain-JavaScript project with no type-checker.

### 2. Linting

Run the project's lint script — it runs whatever linter the project uses (ESLint, Biome, oxlint, …):

```bash
yarn lint        # or: npm run lint
```

If the project uses **ESLint**, you can scope it to the changed files for speed instead of linting everything:

```bash
yarn eslint --cache --cache-location ".cache/eslint/" <file1> <file2> ...
```

Must show 0 errors. Fix any linting issues found.

## Quick Reference

| Check | Command | Pass criteria |
|-------|---------|---------------|
| Type checking | `yarn type-check` (TypeScript projects) | 0 errors |
| Linting | `yarn lint` (the project's lint script) | 0 errors |

## Important

- Type-checking is project-wide — a change in one file can surface type errors in another, so a clean run matters beyond the files you edited.
- Know what your project's type-checker covers. Some setups leave certain component file formats (e.g. framework single-file components) out of the static check — those surface errors only at build or runtime.
- Run every applicable check before the work is considered done — all must pass.
