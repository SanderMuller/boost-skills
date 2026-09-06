---
name: backend-quality
description: "Runs backend code quality checks in two tiers: Pint + related tests (every change), PHPStan + full suite (completion only). Activate after making changes to PHP files, or when user mentions: phpstan, pint, code quality, static analysis, code style, run checks."
metadata:
  boost-tags: "php"
  schema-required: "^1"
---

# Backend Code Quality

Run backend quality checks after making changes to PHP files. Which checks to run depends on where you are in the workflow — see the two tiers below.

## When to Use This Skill

Activate this skill when:
- PHP files have been created or modified
- Finalizing a feature, bug fix, or refactor that touched PHP code
- The user asks to run backend checks, PHPStan, Pint, or tests
- Before creating a PR with PHP changes

## Two Tiers of Checks

**Test runner.** Your project's configured runner is <!--boost:conv path="testing.backend_framework" mode="inline"-->auto-detected from the project layout — composer.json scripts, or vendor/bin/pest vs vendor/bin/phpunit presence<!--boost:conv:end-->. Every test command and table cell below substitutes that runner automatically (`vendor/bin/pest` or `vendor/bin/phpunit` — both take a file-path argument and `--filter`). For the full suite, prefer the project's `composer test` script when one is defined — it runs whatever the project configured.

### Tier 1: During Development (after each change)

Run these checks every time you modify PHP files — they are fast:

**1. Pint (Code Style)**

```bash
vendor/bin/pint --dirty --format agent
```

Fix any formatting issues. Re-run until clean.

**2. Related Tests Only**

Run the minimum scope needed:

```bash boost:conv
# Specific test file
vendor/bin/<!--boost:conv path="testing.backend_framework" mode="inline"-->pest<!--boost:conv:end--> tests/RelevantTest.php

# Filter by test name
vendor/bin/<!--boost:conv path="testing.backend_framework" mode="inline"-->pest<!--boost:conv:end--> --filter=testMethodName
```

All related tests must pass.

### Tier 2: At Completion (once, at the very end)

Run these checks **only when the feature, bug fix, or spec is fully implemented (all spec phases are complete)** — right before creating a PR or marking work as done. These are slow and should not be run mid-development.

**1. Rector (Automated Refactoring)** — only when the project opts in

Rector enabled for this project: <!--boost:conv path="quality.rector" mode="inline"-->false<!--boost:conv:end-->. Run this step only when that value is `true`; otherwise skip it. The step is strictly opt-in via `quality.rector` — it is never triggered by Rector merely being present in the dependency tree or by a stray `rector.php`. When it applies, run Rector to completion before Pint:

```bash
vendor/bin/rector process
```

Re-run until it reports no changes. Rector's output is **not** style-clean, so always run Pint (step 2) after Rector.

**2. Pint** (re-run to be sure)

```bash
vendor/bin/pint --dirty --format agent
```

**3. PHPStan (Static Analysis)**

```bash
vendor/bin/phpstan analyse --memory-limit=2G
```

Must show 0 errors. Fix any issues found and re-run Pint after fixes.

**4. Full Test Suite**

```bash boost:conv
composer test  # if the project defines a test script
vendor/bin/<!--boost:conv path="testing.backend_framework" mode="inline"-->pest<!--boost:conv:end-->  # otherwise the configured runner
```

Must show 0 failures. This catches cross-cutting regressions.

## Quick Reference

| Check | Command | When to run | Pass criteria |
|-------|---------|-------------|---------------|
| Refactoring | `vendor/bin/rector process` | Completion only, if enabled | No changes |
| Code style | `vendor/bin/pint --dirty --format agent` | Every change | No changes made |
| Related tests | vendor/bin/<!--boost:conv path="testing.backend_framework" mode="inline"-->pest<!--boost:conv:end--> &lt;file&gt; or `--filter` | Every change | 0 failures |
| Static analysis | `vendor/bin/phpstan analyse --memory-limit=2G` | Completion only | 0 errors |
| Full test suite | `composer test`, else vendor/bin/<!--boost:conv path="testing.backend_framework" mode="inline"-->pest<!--boost:conv:end--> | Completion only | 0 failures |

## Important

- Run Rector **before** Pint — Rector's output is not style-clean, so it must be followed by Pint.
- Run Pint **before** PHPStan — style fixes can resolve some PHPStan issues.
- Run Pint **again after** PHPStan fixes — PHPStan fixes may introduce style issues.
- **Do NOT run PHPStan or the full test suite mid-feature.** They are slow and waste time when the code is still in flux.
- When the user explicitly asks to run PHPStan or the full suite, always obey regardless of tier.

## Fixing PHPStan Errors

**Always fix the actual code.** Never suppress PHPStan errors by:

- Adding `@phpstan-ignore`, `@phpstan-ignore-line`, or `@phpstan-ignore-next-line` comments
- Adding entries to `phpstan-baseline.neon`
- Modifying `phpstan.neon` (e.g. `ignoreErrors`, `excludePaths`, lowering the level or otherwise reducing strictness)

**The only exception** is a confirmed upstream bug in a dependency or PHPStan itself that cannot be resolved in the project code. In that case, explain the upstream issue and ask the user for approval before adding any suppression.

### Two Annotations That Fix the Error Instead of Hiding It

Both tell PHPStan something true that it cannot read from a signature. Neither is a suppression: a wrong one makes the analysis worse, so annotate only where the condition holds for every call.

**A parameter decides the return type** — add `@return ($param is Type ? A : B)` even when the method already declares a union return type. The union tells a caller what it might get, never which arm it gets.

```php
/**
 * @return ($channel is Channel::Email ? EmailMessage : ($channel is Channel::Sms ? SmsMessage : never))
 */
public static function make(Channel $channel): EmailMessage|SmsMessage
```

Nest one condition per parameter case and close with `never` when the parameter has more cases than the return type covers — a flat `A : B` claims `B` for every remaining case. The condition also reads a literal `null` (`$key is null`), a bool literal (`$withNull is true`), and a literal string, and it can be negated with `is not`. Narrowing only happens where the caller passes a literal or a default; a caller passing a variable still gets the whole union.

Then clean up the call sites the annotation now narrows. Delete a `@var` that existed only to split the union — that deletion is the proof it narrows. Delete an `instanceof` guard only where the caller passes a literal; elsewhere the guard still runs, and removing it changes behaviour.

**A bool method is a pure type check** — add `@phpstan-assert-if-true` so callers get the narrowed value after the check.

```php
/**
 * @phpstan-assert-if-true !null $this->reference
 */
public function hasReference(): bool
{
    return $this->reference !== null;
}
```

`@phpstan-assert-if-true SomeClass $this` covers an `instanceof` check, `@phpstan-assert-if-true Status::Active $this->status` an enum identity check, and `@phpstan-assert-if-true non-empty-string $this->reference` a helper that also rejects `''`. After the helper returns true, drop the leftover null check or nullsafe operator on the proven value.

Do not annotate a helper that is not a pure predicate: one that checks emptiness rather than type, one that reads a relation which may not be loaded, or one that combines a type check with another condition. Do not spray it across every `has*` and `is*` method — annotate where a caller already calls the helper and then uses the value it proves.
