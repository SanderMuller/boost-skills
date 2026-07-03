# Plan 006: Remove the dead `.mcp.json` (references a nonexistent binary/command)

> **Executor instructions**: Follow step by step; run every verification
> command. If a STOP condition occurs, stop and report. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat d850d7d..HEAD -- .mcp.json`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `d850d7d`, 2026-07-03

## Why this matters

`.mcp.json` configures a local MCP server named `laravel-boost` that runs
`vendor/bin/testbench boost:mcp`. Neither piece exists in this repo:
`orchestra/testbench` is not a declared dependency (so `vendor/bin/testbench`
is never installed), and this package's actual engine, `boost-core`, exposes
`vendor/bin/boost` with `sync|doctor|install|validate|…` but **no** `boost:mcp`
command. It's stale config carried over from a laravel/boost application
scaffold; this is a boost-core-based Composer package that ships no MCP server.
Starting the configured server just fails "command not found". The file is
dev-only (`.gitattributes` export-ignores it, so consumers never receive it),
so removing it affects only this repo's local tooling — and it currently does
nothing but fail.

## Current state

`.mcp.json` (full, as of `d850d7d`):
```json
{
    "mcpServers": {
        "laravel-boost": {
            "command": "vendor/bin/testbench",
            "args": [
                "boost:mcp"
            ]
        }
    }
}
```

Confirming it's dead:
- `ls vendor/bin/testbench` → not present (after `composer install`).
- `grep -n 'testbench\|orchestra/testbench' composer.json` → not a declared dep.
- `vendor/bin/boost list` (boost-core's CLI) → no `boost:mcp` command.
- `.gitattributes` contains `.mcp.json  export-ignore` (dev-only; not shipped).

## Commands you will need

| Purpose                 | Command                                             | Expected                          |
|-------------------------|-----------------------------------------------------|-----------------------------------|
| Confirm binary is absent | `test -e vendor/bin/testbench && echo present || echo absent` | `absent`               |
| Confirm gate unaffected | `php .github/validate-skills.php`                   | exit 0, `29/29 skills valid`      |

## Scope

**In scope**: delete `.mcp.json`.
**Out of scope**: `composer.json`, `.gitattributes`, adding any new dependency, wiring a real MCP server (that's a separate feature — see STOP conditions).

## Git workflow

- Branch: `advisor/006-remove-dead-mcp-config`; commit e.g. `Remove dead .mcp.json (testbench boost:mcp does not exist here)`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Verify it's actually dead

**Verify**: after `composer install --no-interaction --no-progress`, run `test -e vendor/bin/testbench && echo present || echo absent` → `absent`, and `grep -c 'orchestra/testbench' composer.json` → `0`.

If either says the binary/dep IS present, STOP (see STOP conditions).

### Step 2: Delete the file

Remove `.mcp.json` from the repo root (`git rm .mcp.json`).

**Verify**: `test -e .mcp.json && echo present || echo gone` → `gone`.

### Step 3: Confirm nothing else depended on it

**Verify**: `php .github/validate-skills.php` → exit 0, `29/29 skills valid` (the file is unrelated to the gate; this is a sanity check). `grep -rn '\.mcp\.json' --include='*.php' --include='*.md' --include='*.yml' . | grep -v vendor/` → no functional reference that now dangles (docs mentions, if any, are acceptable — report them but they don't block).

## Test plan

No unit tests. Verification is Steps 1–3: the referenced binary is absent, the
file is gone, and the CI gate is unaffected.

## Done criteria

- [ ] `.mcp.json` no longer exists at the repo root.
- [ ] `php .github/validate-skills.php` exits 0.
- [ ] `git status --porcelain` shows only the `.mcp.json` deletion.
- [ ] `plans/README.md` row for 006 updated.

## STOP conditions

- `vendor/bin/testbench` **does** exist or `orchestra/testbench` **is** a declared dependency — then the config may be live for some workflow; stop and report instead of deleting.
- The maintainer wants a working local MCP server: that's a separate feature (add `orchestra/testbench` + `laravel/boost`, or point at a real `boost-core` MCP command if one exists in the installed version). Do not build it under this plan — report the intent instead.

## Maintenance notes

- If a local MCP server is wanted later, add `.mcp.json` back pointing at a
  command that actually exists in this repo's dependency set, and add the
  backing dependency. Keep it export-ignored (dev-only) as it is today.
- Reviewer: confirm no CI job or documented dev step invoked the `laravel-boost` server (none found at planning time).
