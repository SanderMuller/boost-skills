# Plan 005: `stolt/skill-validator` constraint states its real intent (exact pin)

> **Executor instructions**: Follow step by step; run every verification
> command. If a STOP condition occurs, stop and report. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat d850d7d..HEAD -- composer.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pairs well with plans/004-dependabot-composer.md)
- **Category**: dependencies
- **Planned at**: commit `d850d7d`, 2026-07-03

## Why this matters

`composer.json` requires `"stolt/skill-validator": "^0.0.1"`. For a `0.0.z`
version Composer treats `^0.0.1` as `>=0.0.1 <0.0.2` — i.e. it already resolves
to *exactly* 0.0.1 and will never auto-adopt a `0.0.2`. So the caret is
misleading: it reads as "allow compatible updates" but behaves as an exact pin.
This dependency is the sole logic behind the CI release gate
(`.github/validate-skills.php` uses `Stolt\Ai\Skill\Validator`), and it's
pre-1.0, so silent auto-adoption of a new version would be *undesirable* anyway
(a `0.0.2`/`0.1.0` could rename the `Validator`/`validateFile`/`isValid`/`errors`
API or weaken validation). The right posture is an explicit pin plus deliberate,
reviewed bumps (Plan 004 wires Dependabot to surface them). This change makes
the intent explicit with **no** change to what actually resolves today.

## Current state

`composer.json` (`require-dev` block, as of `d850d7d`):
```json
    "require-dev": {
        "laravel/pao": "^1.0",
        "nunomaduro/collision": "^8.0",
        "sandermuller/package-boost-php": "^1.0",
        "stolt/skill-validator": "^0.0.1"
    },
```
Installed version resolves to `v0.0.1`. `composer.lock` is gitignored (not
committed), so there is no lockfile to update.

The API this validator exposes and the repo consumes (do not change these; just
noting the surface that a bad bump could break): `Stolt\Ai\Skill\Validator`,
`->validateFile($path)`, `->isValid()`, `->errors()` — see
`.github/validate-skills.php:13,43,50,59`.

## Commands you will need

| Purpose             | Command                                             | Expected                     |
|---------------------|-----------------------------------------------------|------------------------------|
| Validate composer.json | `composer validate --no-check-publish`           | `./composer.json is valid`   |
| Reinstall           | `composer update stolt/skill-validator --no-interaction` | resolves `v0.0.1` (unchanged) |
| Run the gate        | `php .github/validate-skills.php`                   | exit 0, `29/29 skills valid` |

## Scope

**In scope**: `composer.json` — the one `stolt/skill-validator` constraint string.
**Out of scope**: any other dependency, `post-install`/`post-update` scripts, the validator script itself.

## Git workflow

- Branch: `advisor/005-skill-validator-pin`; commit e.g. `composer: pin skill-validator exactly (0.0.x caret is a no-op)`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Change the constraint to an explicit exact pin

In `composer.json`, change:
```json
        "stolt/skill-validator": "^0.0.1"
```
to:
```json
        "stolt/skill-validator": "0.0.1"
```

**Verify**: `grep -n 'skill-validator' composer.json` → shows `"0.0.1"` with no caret.

### Step 2: Confirm nothing actually changed in resolution

**Verify**: `composer validate --no-check-publish` → valid; `composer update stolt/skill-validator --no-interaction` → still resolves `v0.0.1`; `php .github/validate-skills.php` → exit 0, `29/29 skills valid`.

## Test plan

No unit tests. Verification is Step 2 — the same version resolves and the gate
still runs green, proving this is a clarifying change, not a behavioral one.

## Done criteria

- [ ] `composer.json` pins `stolt/skill-validator` as `"0.0.1"` (no caret).
- [ ] `composer validate --no-check-publish` passes.
- [ ] `php .github/validate-skills.php` exits 0.
- [ ] `git status --porcelain` shows only `composer.json` modified.
- [ ] `plans/README.md` row for 005 updated.

## STOP conditions

- `composer update` after the change resolves to something other than `v0.0.1`, or the gate fails — stop and report (unexpected; the resolution should be identical).
- If the maintainer's intent is actually to *track* patch releases automatically, this plan is the wrong call — flag it; for a release-gating pre-1.0 dep, deliberate bumps are safer, but it's the maintainer's decision.

## Maintenance notes

- Deeper mitigation lives with Plan 002: characterization fixtures for the
  validator mean a future bad `skill-validator` bump fails *your* tests instead
  of silently passing. Consider that follow-up before ever widening this pin.
- When `skill-validator` reaches a stable 1.0 with a semver contract, revisit —
  a `^1.0` there would be meaningful, unlike `^0.0.1`.
