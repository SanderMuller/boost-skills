# Upgrading

## From 1.7.x to 1.8.0

`boost-skills 1.8.0` aligns with `boost-core 0.9.0`'s conventions-source-flip. The slot vocabulary, the agent-read surface, the schema-versioning contract, and the validation behavior are all unchanged. **The operator-edit surface moves from `CLAUDE.md` (YAML between marker comments) to `boost.php` (the `->withConventions([...])` array).** A single command migrates existing setups.

### Required

Bump `sandermuller/boost-core` to `^0.9.3` (or via a family package — `sandermuller/package-boost-php` / `sandermuller/package-boost-laravel` / `sandermuller/project-boost-laravel` releases that float their `boost-core` constraint to `^0.9.3`). The `0.9.3` floor is defensive: `boost-core 0.9.3` patches a render-fail-then-write data-loss path on `boost sync` where a validation failure between schema-read and CLAUDE.md-write could blank out the rendered block. Pinning to `^0.9.3` (rather than `^0.9.0`) ensures every consumer adopting `1.8.0` gets the patch.

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
  "sandermuller/boost-skills:^1.8" \
  "sandermuller/boost-core:^0.9.3"

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
git commit -m "Adopt boost-skills 1.8.0 + boost-core 0.9.0 + migrate Project Conventions"
```
