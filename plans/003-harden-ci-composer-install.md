# Plan 003: CI `composer install` no longer runs fork-controlled scripts/plugins

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result. If a STOP condition
> occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d850d7d..HEAD -- .github/workflows/validate-skills.yml`
> If it changed, compare against the "Current state" excerpt before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d850d7d`, 2026-07-03

## Why this matters

`.github/workflows/validate-skills.yml` triggers on `pull_request` — including
PRs from forks — and runs `composer install` with no `--no-scripts`
`--no-plugins`. `composer.json` wires `post-install-cmd`/`post-update-cmd` to
`BoostAutoSync::run`, and Composer also honors any composer-*plugin* declared in
the (fork-controlled) `composer.json`/`composer.lock`. So a forked PR can cause
arbitrary code to run in the CI runner. The blast radius is already contained
(the job has `permissions: contents: read`, references no secrets, and sets
`BOOST_SKIP_AUTOSYNC: 1` which no-ops the boost hook) — but the validator only
needs the Composer autoloader, never scripts or plugins, so disabling them is
free defense-in-depth.

## Current state

`.github/workflows/validate-skills.yml` (full, as of `d850d7d`):
```yaml
name: Validate skills
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
env:
  BOOST_SKIP_AUTOSYNC: 1
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      - run: composer install --no-interaction --no-progress
      - run: php .github/validate-skills.php
```

The consumer of the install is `.github/validate-skills.php`, whose only
dependency on `composer install` is `require __DIR__ . '/../vendor/autoload.php'`
— i.e. it needs the generated autoloader and nothing that a script/plugin
produces.

## Commands you will need

| Purpose               | Command                                                             | Expected                              |
|-----------------------|---------------------------------------------------------------------|---------------------------------------|
| Reproduce CI locally  | `composer install --no-interaction --no-progress --no-scripts --no-plugins` | exit 0, `vendor/autoload.php` present |
| Run the gate          | `php .github/validate-skills.php`                                   | exit 0, `29/29 skills valid`          |

## Scope

**In scope**: `.github/workflows/validate-skills.yml` — the one `composer install` line.
**Out of scope**: everything else. Do not change `permissions`, triggers, the `env` block, or `composer.json`.

## Git workflow

- Branch: `advisor/003-harden-ci-composer-install`; imperative commit message (e.g. `CI: composer install --no-scripts --no-plugins on validate`).
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Add `--no-scripts --no-plugins` to the install step

Change the install line to:
```yaml
      - run: composer install --no-interaction --no-progress --no-scripts --no-plugins
```

**Verify**: `grep -n 'composer install' .github/workflows/validate-skills.yml` → shows both `--no-scripts` and `--no-plugins`.

### Step 2: Confirm the gate still works with those flags locally

**Verify**: from a clean checkout, `composer install --no-interaction --no-progress --no-scripts --no-plugins` exits 0 and `vendor/autoload.php` exists; then `php .github/validate-skills.php` exits 0 with `29/29 skills valid`.

## Test plan

No unit tests apply. The verification is Step 2: the validator still runs green
when Composer is installed with scripts and plugins disabled, proving nothing in
the gate depended on them.

## Done criteria

- [ ] `.github/workflows/validate-skills.yml` install step contains `--no-scripts --no-plugins`.
- [ ] Locally: `composer install ... --no-scripts --no-plugins` exits 0 and `php .github/validate-skills.php` exits 0.
- [ ] The workflow still parses as YAML.
- [ ] `git status --porcelain` shows only the workflow file modified.
- [ ] `plans/README.md` row for 003 updated.

## STOP conditions

- `php .github/validate-skills.php` fails after adding the flags (means something in the gate *did* rely on a script/plugin — report it; don't remove the flags silently).
- A composer-plugin becomes a genuine runtime requirement of the validator in future — then `--no-plugins` would break it; report rather than reverting the hardening.

## Maintenance notes

- If the repo later adds a real MCP server or a build step that needs post-install scripts in CI, reconsider — but scope any such need to a separate, non-fork-triggered job rather than re-enabling scripts on the fork-exposed `pull_request` job.
- Reviewer: confirm the trigger is still `pull_request` (not `pull_request_target`) and the token is still `contents: read`.
