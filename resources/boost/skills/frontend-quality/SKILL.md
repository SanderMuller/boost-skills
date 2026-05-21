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
- Applying feedback or rework for a PR or Jira issue with JS/TS changes

## Checks (Run in Order)

### 1. TypeScript Type Checking

```bash
yarn type-check
```

Must show 0 errors. Fix any type issues found.

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
| Type checking | `yarn type-check` | 0 errors |
| Linting | `yarn lint` (the project's lint script) | 0 errors |

## Important

- TypeScript checking validates all `.ts`/`.js` files in the include glob — a change in one file can cause type errors in another. `.vue` SFCs are NOT type-checked by this command (no `vue-tsc` in toolchain); SFC type errors surface only at runtime / via the Vue compiler in Mix.
- `tsgo` is the `@typescript/native-preview` binary (TS 7 beta) and the standard tool for pure-TS/JS type checking. Use `yarn type-check`; fall back to `yarn tsc --noEmit` only if a `tsgo` bug is suspected.
- ESLint can be scoped to specific files for speed. Pass the changed file paths directly.
- Never skip a check. Both must pass.
