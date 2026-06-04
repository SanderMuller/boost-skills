# Upgrading

## From 2.0.x to 2.1.0 (boost-core floor raised to `^0.20`)

**Breaking: requires `boost-core ^0.20`.** 2.1.0 drops `boost-core 0.16–0.19` from the accepted range (now `^0.20 || ^0.21 || ^0.22 || ^0.23 || ^1.0`). This is a support-policy cutoff, not a hard requirement of the shipped skills — they still resolve correctly on `0.16` (the `mcp.jira` conventions-token resolver remains the actual content floor). The cutoff aligns boost-skills with the config API `boost-core` froze for `1.0`: `->withTags(...)` became a single `array` argument in `boost-core 0.20.0` (it was variadic through `0.19`), and both the README setup example and boost-skills' own `boost.php` now use the array form.

### Required

- Move `sandermuller/boost-core` to `0.20+` (normally pulled by the family package you adopt; boost-skills 2.1.0 also declares the `^0.20` floor directly).

### Migrate your `boost.php` — `withTags` is now an array

When you move to `boost-core 0.20+`, update your project's `->withTags(...)` call to the single-array form. `boost sync` migrates a variadic call it parses, but update it by hand to avoid a `TypeError` the next time the config is loaded directly:

```php
// before (boost-core ≤0.19)
->withTags(Tag::Php, Tag::Github)
->withTags('php', 'github')

// after (boost-core 0.20+)
->withTags([Tag::Php, Tag::Github])
->withTags(['php', 'github'])
```

### What stays the same

- The slot vocabulary, schema v1, every `->withConventions([...])` value, and all skill/guideline behavior — nothing in your conventions data changes.
- If you were already on `boost-core 0.20+`, the only effective change is the added `^0.23` in the accepted range.

## From 1.9.x to 2.0 (conventions inlining)

**Breaking: requires `boost-core ^0.16`.** In 2.0 every slot-aware skill resolves its convention values at sync time via `boost-core`'s conventions-inlining tokens (`<!--boost:conv-->`, shipped in `0.15.0`) instead of reading the always-loaded `## Project Conventions` block at agent runtime. The three Jira skills additionally use an `mcp.jira` sub-key token that only the `0.16.0` resolver handles (earlier engines emit it raw, losing the value). On any engine below `0.16` at least one token emits raw into the skill body, so `^0.16` is a hard floor — this is why 2.0 is a major bump.

### Required

- Adopt a family-package release that floats `boost-core` to include `^0.16` (`package-boost-php ^0.16.1` / `package-boost-laravel` / `project-boost` / `project-boost-laravel`). `boost-skills` 2.0 also declares a direct `boost-core ^0.16` require, so the constraint holds even if a family package lags.

### What changes

- **Nothing in the slot vocabulary or your `boost.php`.** Same `->withConventions([...])` slots, same schema v1. You don't edit anything.
- **The `## Project Conventions` block in `CLAUDE.md` disappears** once your full synced skill set is token-sourced (and nothing needs runtime, no token errored). The values are now baked into each skill at sync. The drop is automatic — the engine's fail-toward-keep gate keeps the block until everything converges, so a partial state is safe.
- **`boost where --conventions`** shows each slot's effective resolved value (declared / schema-default / fallback) — use it to confirm what your tokens resolve to before/after.

### What stays the same

- Agent behavior: skills dispatch identically — the value is just inlined instead of read from the block.
- The slot schema, `boost validate`, `boost slots`, and every convention you've declared.

### Gotcha — host `.blade.php` guidelines silently vanish

Not a conventions change, but it bites on the same sync: **`boost-core 0.16`'s guideline loader only renders `.md` host guidelines natively (PassthroughRenderer). A host `.ai/guidelines/*.blade.php` file is silently dropped from the rendered `CLAUDE.md` / `AGENTS.md` on the v2/0.16 sync** — and `boost validate` passes anyway (it checks the conventions schema, not guideline-render completeness), so the drop is silent. Reported by two real consumers (mijntp, hihaho) that ship a `.blade.php` style guide.

Fix: register a Blade renderer in `boost.php`:

```php
->withSkillRenderers([new BladeRenderer])
```

This works when you sync via `php artisan project-boost:sync` (the Laravel path bootstraps the container the `BladeRenderer` needs). After registering, re-sync and the `.blade.php` guideline content is restored. If all your host guidelines are `.md`, this doesn't apply. (Root cause is engine-side; a future `boost-core` may render `.blade.php` natively or warn on an unrenderable host guideline instead of dropping it silently.)

### Gotcha — a host shadow of a slot-aware skill keeps the block

If you keep a **host shadow** (`.ai/skills/<name>/SKILL.md`) of a slot-aware vendor skill (`write-spec`, `pull-requests`, `codex-review`, the `jira-*` skills, `bug-fixing`, `backend-quality`, `test-writing`, `interview`) carried over from the 1.9 line, that shadow still contains `$.slot` references. On 2.0 the **vendor** skill is token-migrated, but **your host shadow is not** — and the gate's legacy-ref check (a `$.<slot-root>` ref such as `$.spec…` / `$.jira…` → "skill requires runtime") sets `fullyMigrated = false`, so the `## Project Conventions` block is (correctly) kept in `CLAUDE.md`. A real consumer (hihaho) hit exactly this: a `$.spec.filename_pattern` ref in their `write-spec` shadow held the block.

This is invisible to `boost validate` / `boost doctor` — the leak scan catches raw `<!--boost:conv-->` tokens, not legacy `$.` refs. Grep your host sources directly:

```bash
grep -rnE '\$\.[a-z]' .ai/skills .ai/guidelines
```

Fix — **preferred: drop the shadow** (adopt the migrated vendor skill), unless it carries project-specific content no slot feeds. If you must keep it, **replace the `$.slot` refs with the literal resolved values** (e.g. write the actual filename pattern in place of `$.spec.filename_pattern`).

⚠️ **Do not migrate a kept shadow to `<!--boost:conv-->` tokens if its agent-dir entry is a symlink to your `.ai/` source.** boost declines to write through a user-placed symlink (by design — writing through it would clobber your `.ai/` source; it records `SKIPPED_SYMLINK` instead), so the raw source is served verbatim and a token there is never inlined — it reaches the agent literally. This is about **real-file vs user-symlink, not which sync command**: a token inlines wherever boost writes a real file (bare-CLI `boost sync` or `project-boost:sync`, equally), and *any* user-symlinked shadow is served raw under either. (A bare-CLI consumer who symlinks `.claude/skills/x` → `.ai/skills/x` hits the same thing.) For any symlinked shadow, **use literal values or drop the shadow** — this is the durable rule, not a temporary state: boost will not write through a user symlink, so there is no future mode that inlines tokens there. (boost-core #88 makes the leak scan read through the link so a stray token surfaces instead of reading clean.)

Re-sync; once no synced source carries a legacy `$.` ref or pointer phrase, the block drops. Note the block only ever lived in `CLAUDE.md` (by design — other agent files get the values inlined into skill bodies, never the block), so a `0` count in `AGENTS.md`/`GEMINI.md` is expected, not a drop. A legacy `$.<root>` ref is worth removing regardless of the block: it is never resolved (only detected), so under a non-Claude agent — which never gets the block — the ref dangles unresolved.

## From 1.7.x to 1.9.x

The `1.8.x → 1.9.x` line's substantive migration step is the conventions-source-flip that originally shipped in `1.8.1` (the `1.8.0` tag was mis-tagged; pin to `^1.8.1` or `^1.9.0+` if migrating from `1.7.x`). The flip aligns with `boost-core 0.9.0`'s engine surface: slot vocabulary, agent-read surface, schema-versioning contract, and validation behavior are all unchanged. **The operator-edit surface moves from `CLAUDE.md` (YAML between marker comments) to `boost.php` (the `->withConventions([...])` array).** A single command migrates existing setups. Engine versions past `0.9.0` add further improvements (cross-agent capability-loss fix in `0.10.0`, wrapper-injection-aware drift in `0.11.0`, markerless guidance files in `0.12.0`) that the current floor tracks.

### Required

Bump `sandermuller/boost-core` to `^0.13 || ^0.14` (the 1.9.x-era range — normally pulled by the family package you adopt). 1.9.x's slot-aware skills read convention values from the rendered `## Project Conventions` block at runtime, so they work on any `boost-core 0.9.0+`; the `^0.13 || ^0.14` range just tracks the family line at the 1.9.x cutoff. (The hard `^0.16` floor applies only to 2.0+ — see the 1.9.x → 2.0 section above.)

### Migrate existing conventions

If you adopted `1.7.0` / `1.7.1` / `1.7.2` and have a filled `## Project Conventions` YAML block in `CLAUDE.md`, run:

```bash
vendor/bin/boost convert-conventions
```

What it does:

1. Reads the existing YAML block from the marker-bounded region in `CLAUDE.md`.
2. Decodes the YAML into a PHP nested array.
3. Writes the array into `boost.php` as a `->withConventions([...])` call on the `BoostConfig` builder chain (appends the method to the existing chain if absent).
4. On the next `boost sync`, the rendered YAML block in `CLAUDE.md` regenerates from `boost.php` as the audit-trail copy.

Example before:

```markdown
## Project Conventions

<!-- boost-core:conventions:start -->
\`\`\`yaml
schema-version: 1
jira:
  project_key: HPB
github:
  owner: my-org
  repo: my-app
\`\`\`
<!-- boost-core:conventions:end -->
```

Example after (in `boost.php`):

```php
return BoostConfig::configure()
    ->withAgents([Agent::CLAUDE_CODE, Agent::COPILOT, Agent::CODEX])
    ->withAllowedVendors(['sandermuller/boost-skills', /* ... */])
    ->withTags(Tag::Php, Tag::Github, Tag::Laravel)
    ->withConventions([
        'schema-version' => 1,
        'jira' => [
            'project_key' => 'HPB',
        ],
        'github' => [
            'owner' => 'my-org',
            'repo' => 'my-app',
        ],
    ]);
```

The rendered YAML block in `CLAUDE.md` after `boost sync` looks identical to your pre-migration block, but is now sourced from `boost.php` and regenerates on each sync.

### Fail-closed reconcile path

If `boost.php` already declares `->withConventions([...])` AND the YAML block in `CLAUDE.md` also has non-empty content that differs, `convert-conventions` refuses to run and asks the operator to choose a side. Neither source is silently destroyed. After you reconcile manually — pick one source, clear the other — re-run.

This case mostly affects projects that hand-bootstrapped `->withConventions([...])` before running the migration command. Most consumers will not hit it.

### What stays the same

The migration is operator-edit-surface only. The following do not change:

- **Slot vocabulary** — the same `jira` / `github` / `branches` / `pr` / `testing` / `codex` / `spec` / `mcp` groups, the same `pr.gates` typed-policy with `skill_invoked` / `shell_command` / `mcp_tool` discriminator branches.
- **Schema-versioning contract** — `metadata.schema-required: ^1` on vendor skills still pins the schema-version range; `1.8.0`'s schema stays at v1.
- **Agent-read behavior** — vendor skills still read `$.X.Y` slots from `CLAUDE.md` at agent runtime. The rendered block has the same shape as the hand-edited block. Slot-aware skills (`jira-create`, `pull-requests`, `codex-review`, `bug-fixing`, `write-spec`, `interview`, `jira-rework`, `jira-updates`, `backend-quality`) need no changes.
- **`boost validate` / `boost slots` / `boost doctor --check-conventions`** — same commands, same behavior. They now operate on the parsed PHP-array source rather than the YAML source, but the validation behavior is identical (opis operates on parsed values, format-agnostic).
- **CLAUDE.md tracking in git** — preserved through 0.9.0 per `boost-core 0.8.3`'s decision. No `git rm --cached CLAUDE.md` step.

### Skill body prose updated for the new edit surface

All nine slot-aware skill bodies now describe the edit surface as "`boost.php` via `->withConventions([...])`" rather than "the `## Project Conventions` block in `CLAUDE.md`". When a slot-aware skill needs a missing value, it tells the user to add the slot to `boost.php`'s `withConventions([...])` array (was: "add to CLAUDE.md's Project Conventions block"). Same friction reduction, different destination.

### Codex-review skill body now self-contained for plugin mode

`codex-review` previously deferred to a project-owned `.ai/docs/codex-setup.md` (referenced via `$.codex.setup_doc`) for plugin install + invocation patterns. As of `1.8.0`, the universal `codex-plugin-cc` invocation playbook is folded into the vendor skill body. Consumers running plugin mode (the default per `codex.invocation_mode`) no longer need a project-side setup doc.

The `$.codex.setup_doc` slot stays — narrowed in description to "optional path to project-specific codex overrides only". If you maintained a `.ai/docs/codex-setup.md` that contained only the universal playbook (no project-specific overrides), you can delete it and clear the slot value.

### `.github/copilot-instructions.md` no longer emitted

`boost-core 0.9.0` drops the separate `CopilotTarget` guideline-instructions write. GitHub Copilot reads root `AGENTS.md` for guideline context per the [GitHub Changelog 2025-08-28](https://github.blog/changelog/) — `boost-core` already emits `AGENTS.md` via `CodexTarget`, and `CopilotTarget` now joins the `AGENTS.md` shared-pool the same way `CursorTarget` / `JunieTarget` / `KiroTarget` / `OpenCodeTarget` do.

If you previously had `.github/copilot-instructions.md` in your project's `.gitignore`, the entry becomes a dead line. Safe to remove during your 0.9.0 adoption commit.

### Adoption commit shape

Most consumers will land the migration as a single atomic commit:

```bash
# 1. Update constraints
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9" \
  "sandermuller/boost-core:^0.13 || ^0.14"

# 2. Migrate conventions edit surface
vendor/bin/boost convert-conventions

# 3. Re-sync
vendor/bin/boost sync

# 4. Verify
vendor/bin/boost validate

# 5. Optional cleanup: remove dead .github/copilot-instructions.md
#    gitignore line and stale .ai/docs/codex-setup.md if it was the
#    universal-playbook copy.

# 6. Commit
git add boost.php composer.json composer.lock CLAUDE.md .gitignore
git commit -m "Adopt boost-skills 1.9.x + boost-core 0.11 + migrate Project Conventions"
```
