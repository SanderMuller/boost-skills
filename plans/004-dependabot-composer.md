# Plan 004: Dependabot watches Composer dependencies

> **Executor instructions**: Follow step by step; run every verification
> command. If a STOP condition occurs, stop and report. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat d850d7d..HEAD -- .github/dependabot.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / dx
- **Planned at**: commit `d850d7d`, 2026-07-03

## Why this matters

`.github/dependabot.yml` watches only the `github-actions` ecosystem. The
package declares a runtime dependency (`sandermuller/boost-core`) and several
dev dependencies (`stolt/skill-validator`, `symfony/yaml` transitively, etc.),
all on the CI validator's runtime path. Today a security advisory or fix in
those gets no automated PR — it surfaces only on a manual bump. Adding a
`composer` ecosystem closes that gap with zero runtime effect (Dependabot only
opens PRs).

## Current state

`.github/dependabot.yml` (full, as of `d850d7d`):
```yaml
version: 2
updates:

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

`composer.json` declares (require + require-dev): `sandermuller/boost-core`,
`laravel/pao`, `nunomaduro/collision`, `sandermuller/package-boost-php`,
`stolt/skill-validator`. There is a `composer.json` at the repo root
(`directory: "/"`). Note `composer.lock` is gitignored (not committed) — that's
fine; Dependabot for a library reads `composer.json`.

## Commands you will need

| Purpose            | Command                                                             | Expected            |
|--------------------|---------------------------------------------------------------------|---------------------|
| YAML sanity check  | `php -r "var_dump(is_array(yaml_parse_file('.github/dependabot.yml')));"` *or* the symfony/yaml one below | `bool(true)` |
| YAML (via symfony) | after `composer install`: `php -r "require 'vendor/autoload.php'; var_dump(is_array(Symfony\Component\Yaml\Yaml::parseFile('.github/dependabot.yml')));"` | `bool(true)` |

(Use whichever YAML check is available; the ext-yaml `yaml_parse_file` may not be installed — the symfony/yaml variant always works after `composer install`.)

## Scope

**In scope**: `.github/dependabot.yml` only.
**Out of scope**: `composer.json`, workflows, everything else.

## Git workflow

- Branch: `advisor/004-dependabot-composer`; commit e.g. `Dependabot: watch composer ecosystem`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Add a `composer` updates entry

Append a second entry under `updates:` (keep the existing github-actions entry):
```yaml
  - package-ecosystem: "composer"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

**Verify**: `grep -n 'package-ecosystem' .github/dependabot.yml` → shows both `"github-actions"` and `"composer"`.

### Step 2: Confirm the file still parses

**Verify**: run the YAML sanity check from the commands table → `bool(true)`.

## Test plan

No unit tests. Verification is the YAML parse plus the grep in Step 1. (Dependabot's own config validation runs on GitHub once merged; nothing to run locally.)

## Done criteria

- [ ] `.github/dependabot.yml` has a `composer` updates entry with `directory: "/"` and a weekly schedule.
- [ ] The file parses as valid YAML.
- [ ] `git status --porcelain` shows only `.github/dependabot.yml` modified.
- [ ] `plans/README.md` row for 004 updated.

## STOP conditions

- The file already contains a `composer` entry (someone added it since this plan was written) — then there's nothing to do; report and mark the plan REJECTED/DONE as appropriate.

## Maintenance notes

- Optionally group dev-dep bumps to reduce PR noise (a `groups:` block) — not required for this plan.
- When `stolt/skill-validator` cuts a new release, its Dependabot PR should be reviewed deliberately (see Plan 005 — that dependency gates the release and is pre-1.0).
