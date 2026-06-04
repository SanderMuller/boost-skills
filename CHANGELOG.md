# Changelog

All notable changes to `sandermuller/boost-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2.2.0 - 2026-06-04

<!-- verified-sha: 90733eb11d838d8e3b0c8797d6590a06acc706b2 -->
Two optional conventions slots and a generalized `evaluate` skill. Everything here is **additive under conventions `schema-version 1`** — a consumer that declares neither slot, and existing slot-aware skills, behave exactly as before.

### Added

- **`pr.risk` conventions slot** — optional PR risk-tier routing for the `pull-requests` skill. Declare variable-length `tiers` (a `routing` discriminator — `reviewer_count` is implemented, with `codeowners_path` / `blast_radius` / `gate_skill` reserved for a future minor — plus `human_reviewers`, `require_codeowners`, `label`, free-form `extra` actions, and per-tier or slot-level `ai_reviewers`), with optional `matrix_doc` / `assessment_skill`. `pull-requests` renders and routes by your tiers when declared, and falls back to its generic Low/Medium/High question when absent. Orthogonal to `pr.gates` — a gate-only project is never pushed into a tier.
- **`translations` conventions slot** — optional DB-driven translation-key validation, consumed by a new conditional check in the `evaluate` skill. Declare a per-consumer `key_pattern` plus `file_based_prefixes` (`framework_groups` + `vendor_namespace_exempt`) and an optional `rules_doc`. Scoped to database-stored keys that bypass the framework's own file-based validation; absent ⇒ no check.

### Changed

- **`evaluate` skill hardened** with two general-purpose phases, so projects no longer need to shadow it to get them: **evaluation-scope resolution** (resolve the change set once; never fall back to the whole-branch diff) and an **Audit Code Comments** phase (a Remove / Replace / Trim / Keep ladder with tooling-annotation exemptions). The Security review row now also covers auth checks, XSS, and SQL injection alongside the existing checks.
- **README** documents the two new slots and corrects the `boost-core` requirement to the current `^0.20 || ^0.21 || ^0.22 || ^0.23 || ^1.0`.

Validated against real-world adoption (a production app with DB-driven translations and ISO-27001 PR routing) before release: declaring the slots replaces ~200 lines of duplicated host prose with single-source declarative data, with no change for consumers that don't adopt them.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.1.0...2.2.0

## 2.1.0 - 2026-06-04

<!-- verified-sha: d402d36bbaa23b660420c478441a147d969ee047 -->
Adds support for `boost-core 0.23` and the `1.x` line, raises the minimum engine to `^0.20`, and ships a new signed-commits guideline. See [UPGRADING.md](https://github.com/SanderMuller/boost-skills/blob/main/UPGRADING.md) for the one migration step.

### Breaking

- **Requires `boost-core ^0.20`.** The accepted range is now `^0.20 || ^0.21 || ^0.22 || ^0.23 || ^1.0`, dropping `0.16`–`0.19`. This is a support-policy cutoff, not a hard requirement of the shipped skills (they still resolve correctly on `0.16`) — it aligns `boost-skills` with the config API `boost-core` froze for `1.0`: `->withTags(...)` takes a single array as of `boost-core 0.20.0` (it was variadic through `0.19`). If you were already on `boost-core 0.20+`, the only effective change is the added `0.23` / `1.x` support. Consumers on `0.16`–`0.19` should move to `0.20+` and update their `boost.php` `->withTags(...)` call to the array form — see UPGRADING.md.

### Added

- **`boost-core 0.23` and `1.x` support.** `^0.23` and `^1.0` join the require range, so consumers can adopt the upcoming `0.23` engine and the `1.0` line without `boost-skills` capping them.
- **`signed-commits` guideline.** When a repository has commit signing enabled, never fall back to an unsigned commit if the signing agent (1Password, `gpg-agent`, etc.) is unavailable — stop and surface the failure instead of bypassing it with `--no-gpg-sign`. Self-gating: inert for repositories without signing configured, so it never blocks workflows that don't sign.

### Changed

- **Config and README examples use the array `->withTags([...])` form** to match the `boost-core 0.20+` builder signature.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.6...2.1.0

## 2.0.6 - 2026-06-03

<!-- verified-sha: f7c102e232a44d998f30aaf228fb1615497c2482 -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.22` alongside `0.16`–`0.21`, so consumers can adopt the upcoming engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19 || ^0.20 || ^0.21 || ^0.22`.** Forward-compat for the upcoming `boost-core 0.22` release, which freezes the conventions-token and tag/sidecar contracts `boost-skills` depends on as semver-protected public format/behavior. Under Composer's 0.x caret rules each minor is opt-in, so the previous ceiling would have excluded the `0.22` root — this keeps consumers running both packages able to adopt the new engine minor without `boost-skills` capping them. `^0.16` remains the token-resolution floor.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.5...2.0.6

## 2.0.5 - 2026-06-03

<!-- verified-sha: c461dfaac3f6a000898b0dbb8c6aea1450b0144b -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.21` alongside `0.16`–`0.20`, so consumers can adopt the upcoming engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19 || ^0.20 || ^0.21`.** Forward-compat for the upcoming `boost-core 0.21` release. Under Composer's 0.x caret rules each minor is opt-in, so the previous ceiling would have excluded the `0.21` root — this keeps consumers running both packages able to adopt the new engine minor without `boost-skills` capping them. `boost-core 0.21` carries a pre-1.0 breaking change (`FileEmitter::emit()` returns `iterable<EmittedFile>`); `boost-skills` ships skills and guidelines with no `FileEmitter` implementation, so that change is a no-op here. `^0.16` remains the token-resolution floor.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.4...2.0.5

## 2.0.4 - 2026-06-03

<!-- verified-sha: a5edfb580f8ace3fd726a1b335200be3e6fb28ea -->
Maintenance patch. `boost-skills` adopts `boost-core`'s `.config/boost.php` config location for its own dev tooling and widens the engine constraint to accept `boost-core 0.20`. No skill behavior changed.

### Changed

- **Moved `boost.php` to `.config/boost.php`.** `boost-core 0.17+` resolves the engine config from either the project root or `.config/`; this repo adopts the tidier `.config/` location for its own dev setup. The file is dev-only (`export-ignore`d), so consumers — who supply their own boost config — are unaffected. The dev-tooling floor is `boost-core 0.18` here (via `package-boost-php`), which always carries the `.config/` resolver.
- **Bumped the `package-boost-php` dev dependency to `^0.17`.** Pulls `boost-core ^0.18 || ^0.19` into the dev tree.
- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19 || ^0.20`.** Forward-compat for the upcoming `boost-core 0.20` release. Under Composer's 0.x caret rules each minor is opt-in, so the previous ceiling would have excluded the `0.20` root — this keeps consumers running both packages able to adopt the new engine minor without `boost-skills` capping them. `^0.16` remains the token-resolution floor.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.3...2.0.4

## 2.0.3 - 2026-06-02

<!-- verified-sha: 58559d8c438a3076d6d4de66051f509dc38824a2 -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.19` alongside `0.16`, `0.17`, and `0.18`, so consumers can adopt the new engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18 || ^0.19`.** `boost-core 0.19.0` is additive and changes nothing `boost-skills` uses (the conventions-inlining engine is unchanged since `0.16`). But under Composer's 0.x caret rules each minor is opt-in, so the previous `^0.16 || ^0.17 || ^0.18` ceiling excluded the `0.19` root — capping any consumer running both packages at `boost-core <0.19`. `^0.16` remains the token-resolution floor (the `mcp.jira` sub-key token still needs the `0.16.0` resolver); `0.19` is simply now accepted.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.2...2.0.3

## 2.0.2 - 2026-06-02

<!-- verified-sha: 32f4fa76f22f2d022c7d5eab76f28890c6d7962f -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.18` alongside `0.16` and `0.17`, so consumers can adopt the new engine release without `boost-skills` capping them. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17 || ^0.18`.** `boost-core 0.18.0` is additive and changes nothing `boost-skills` uses (the conventions-inlining engine is unchanged since `0.16`). But under Composer's 0.x caret rules each minor is opt-in, so the previous `^0.16 || ^0.17` ceiling excluded the `0.18` root — capping any consumer running both packages at `boost-core <0.18`. `^0.16` remains the token-resolution floor (the `mcp.jira` sub-key token still needs the `0.16.0` resolver); `0.18` is simply now accepted.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.1...2.0.2

## 2.0.1 - 2026-06-01

<!-- verified-sha: 7b624d9692f5f816af90baba0e312ad2414b98ff -->
Compatibility patch. `boost-skills` now accepts `boost-core 0.17` alongside `0.16`, so consumers can adopt the new engine release without a `boost-skills` upgrade getting in the way. No skill behavior changed.

### Changed

- **Widened the `boost-core` require to `^0.16 || ^0.17`.** `boost-core 0.17.0` is additive — it adds `.config/boost.php` support and is fully back-compatible — and changes nothing `boost-skills` uses (the conventions-inlining engine is unchanged since `0.16`). But under Composer's 0.x caret rules a bare `^0.16` resolves to `>=0.16 <0.17`, which excluded `0.17`. That capped any consumer running both packages at `boost-core <0.17`. `^0.16` remains the token-resolution floor (the `mcp.jira` sub-key token still needs the `0.16.0` resolver); `0.17` is simply now accepted.

### Docs

- Documented two `2.0` upgrade gotchas in `UPGRADING.md`: a host `.blade.php` guideline silently dropped during sync, and a host shadow keeping its convention block. Both surfaced from real-world adoption of the `2.0` token-inlining migration.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/2.0.0...2.0.1

## 2.0.0 - 2026-05-31

<!-- verified-sha: e18578c6a76df8005ed2edae28e33085d424c018 -->
Slot-aware skills now resolve their project-convention values **into the skill body at sync time** via `boost-core`'s conventions-inlining tokens (shipped in `0.15.0`), instead of reading the always-loaded `## Project Conventions` block at agent runtime. Once a consumer's synced catalog is fully token-sourced, that block drops entirely — the values are baked into each skill. Adopting needs `boost-core ^0.16`.

### Breaking

- **Requires `boost-core ^0.16` (hard floor).** The 10 slot-aware skills (`jira-create` / `jira-rework` / `jira-updates`, `pull-requests`, `codex-review`, `write-spec`, `interview`, `bug-fixing`, `backend-quality`, `test-writing`) now contain `<!--boost:conv-->` tokens. The inliner ships in `0.15.0`, but the three Jira skills use an `mcp.jira` open-vocab sub-key token that only the `0.16.0` resolver handles — on `0.15` it emits raw, losing the value. On any engine below `0.16` at least one token emits raw into the skill body, so `^0.16` is enforced as a composer `require` constraint, not just documentation. This also makes the slot-aware skills `sandermuller/boost-core`-specific — they don't resolve under `laravel/boost` (no inliner). Adopt a family-package release that floats `boost-core` to include `^0.16` (e.g. `package-boost-php ^0.16.1`). See [UPGRADING.md](UPGRADING.md).

### Changed

- **All slot-aware skills migrated from runtime `$.slot` references to render-time tokens.** Each skill's `## Project Conventions slots` documentation table is removed (obsolete once values inline); the slot dependency is now in the tokens + the schema. Agent behavior is unchanged — skills dispatch identically; the value is inlined instead of read from the block.
- **The three Jira skills inline `mcp.jira` as a clean scalar token** (`<!--boost:conv path="mcp.jira" mode="inline" fallback="mcp-atlassian"-->`), resolving the MCP server-namespace segment directly — declared `mcp.jira` → schema-default `mcp-atlassian` → fallback. (`pull-requests` still renders the whole `mcp` map as YAML for its gate tools.)
- **`conventions-schema.json` gains `render` mode pins** on the structured / list slots (`branches.patterns`, `pr.gates`, `mcp` → `yaml`; `testing.forbid`, `spec.research_docs` → `inline`/`bullets`) as drift guards so a slot always renders in a consistent mode.

### How it works

- **Scalar slots** (`github.default_base_branch`, `codex.invocation_mode`, `jira.project_key`, …) inline their value directly into the prose.
- **Structured slots** (`branches.patterns`, `pr.gates`) render as YAML data the skill's algorithm prose then operates on at agent runtime — the value is inlined, the logic stays in the skill.
- **Unset slots** render a written fallback (a sensible default or a detection instruction), so a skill reads correctly whether or not the convention is declared.
- `boost where --conventions` shows each slot's effective resolved value (declared / schema-default / fallback).

### Upgrading

```bash
composer require --dev "sandermuller/boost-skills:^2.0"
# via a family package that floats boost-core to include ^0.16 (e.g. package-boost-php ^0.16.1)
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel









```
No `boost.php` or slot-vocabulary changes — same `->withConventions([...])`, same schema v1. The `## Project Conventions` block in `CLAUDE.md` disappears once your full synced skill set is token-sourced (the engine keeps it until everything converges, so partial states are safe). See [UPGRADING.md](UPGRADING.md) for the full 1.9.x → 2.0 path.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.9...2.0.0

## 1.9.9 - 2026-05-31

<!-- verified-sha: 11649674a94d98b5f389f24e2e1ee8746efac0f5 -->
### Changed

- **Consumer-facing `boost-core` floor `^0.13` → `^0.13 || ^0.14`** (README + UPGRADING). `package-boost-php 0.15.1` widened its `boost-core` constraint to `^0.13 || ^0.14` (absorbing `0.14.0`'s project-scope reconcile-on-sync), so a fresh family install now resolves `boost-core 0.14.0` — outside the `^0.13` floor `1.9.8` stated (`^0.13` = `>=0.13 <0.14`). The floor now matches the family range, with `0.14.0` added to the notable-versions list (dropped-emitter orphan reaping, sha-gated so operator edits are preserved).
  
  boost-skills has no direct `boost-core` require — the family package pins the engine — so this is prose-floor accuracy, not a composer-constraint change. (boost-core is pre-`v1`; expect the floor to track each engine minor until the public API settles.)
  

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.9"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel










```
No schema, slot, or skill-body changes — floor-tracking only.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.8...1.9.9

## 1.9.8 - 2026-05-31

<!-- verified-sha: d089455c180515a0eee643abd330dc889cf8641a -->
### Changed

- **Consumer-facing `boost-core` floor `^0.11` → `^0.13`** (README + UPGRADING). The `^0.11` floor (set in 1.9.5) had gone stale + disjoint from the family: the current family packages narrow `boost-core` to `^0.13`, so a consumer reading "Requires `^0.11`" while installing a current family package (which pulls `^0.13`) got contradictory guidance — `^0.11` and `^0.13` are non-overlapping ranges. The floor now matches the family line and lists the notable engine versions folded into it:
  
  - `0.9.0` — conventions-source-flip (values move to `boost.php`)
  - `0.9.3` — render-fail-then-write data-loss patch
  - `0.10.0` — cross-agent capability-loss fix + `boost doctor` entry-point banner
  - `0.11.0` — `BoostWrapperContract` (bare-CLI sync stops false-positive-deleting wrapper-injected files)
  - `0.12.0` — **markerless guidance files**: `CLAUDE.md` / `AGENTS.md` become wholesale boost-owned; operator content moves to `.ai/guidelines/`
  
  boost-skills has no direct `boost-core` require (it's a markdown catalog — the family package pins the engine), so this is prose-floor accuracy, not a composer-constraint change.
  

### Internal

- `require-dev` `package-boost-php` `^0.13` → `^0.15` (dev-env dogfood; pulls `boost-core 0.13.0`). The catalog now dev-syncs under the markerless guidance model — verified safe: boost-skills' own `CLAUDE.md` is fully vendor-generated (zero hand-authored content), so wholesale-ownership regenerates it losslessly.
- `.gitignore` managed block adds `.boost/` (the `0.13` sync-manifest dir).

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.8"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel











```
No schema, slot, or skill-body changes — floor-tracking + dev-env only. If you hand-edited content into a generated `CLAUDE.md` / `AGENTS.md`, move it to `.ai/guidelines/` before adopting `boost-core 0.12+` (markerless makes those files wholesale boost-owned); see `boost-core`'s 0.12.0 notes.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.7...1.9.8

## 1.9.7 - 2026-05-31

<!-- verified-sha: 29b5d544c3514a6d69d9f78dd3da3356c91b8ff6 -->
### Changed

- **`test-writing` + `bug-fixing` — `testing.forbid` category-alias expansions rendered inline.** Both skills previously deferred to "see the schema description for alias expansions", but the schema description isn't loaded into the agent's context — so an agent had to know from general knowledge that `js-test-frameworks` includes `cypress`. Now the full expansion is inline in both skills:
  
  | Alias | Expands to |
  |---|---|
  | `js-test-frameworks` | vitest, jest, mocha, cypress, playwright |
  | `browser-test-frameworks` | cypress, playwright |
  | `php-browser-tests` | dusk, panther |
  
  A `forbid: ['js-test-frameworks']` now visibly refuses a Cypress test without the agent needing outside knowledge. Surfaced by runtime-dispatch verification against a proving consumer — an agent resolved the alias membership via general knowledge, which a stricter agent could have missed.
  

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.7"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel












```
No schema or convention changes — the alias map is unchanged (this renders the existing schema map into agent context).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.6...1.9.7

## 1.9.6 - 2026-05-30

<!-- verified-sha: 8278606eaf76c6095ec401a5e1ce03978c258867 -->
### Changed

- **`require-dev` `sandermuller/package-boost-php` `^0.12` → `^0.13`.** package-boost-php 0.13.0 widens its `boost-core` constraint to `^0.10 || ^0.11`. boost-skills' dev environment was pinned `^0.12`, capping the transitive `boost-core` at `^0.10` — inconsistent with the `^0.11` consumer floor that `1.9.5` documents. The bump lets the dev environment resolve `boost-core 0.11.0`, so the catalog now dev-tests against the same floor it tells consumers to use. Dev-only constraint; consumers unaffected.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.5...1.9.6

## 1.9.5 - 2026-05-30

<!-- verified-sha: 07a17e546df12bc29c4559c5a5261aed42b4e423 -->
A dispatch-prose audit across all six under-dogfooded conventions-schema slot groups (`pr.gates`, `codex.invocation_mode`, `testing.forbid`, `spec.filename_pattern`, `mcp.*`, `branches.patterns`) — the slots no real consumer exercises yet, where a vendor-skill prose bug would surface only when someone first adopts them. Caught six real prose/schema gaps that schema validation can't (validation checks input shape, not vendor dispatch prose). Plus a `boost-core ^0.11` floor-bump.

### Changed

- **`pull-requests` (`pr.gates`)** — gate-ordering flow-control clarified (only `stop_and_request` halts; `warn` / `skip` continue to the next gate); `shell_command` failure modes enumerated (exit-127 / crash / timeout / Bash-tool error); `mcp_tool` success + failure shapes defined; default-value annotations added to the YAML examples.
- **`codex-review` (`codex.invocation_mode`)** — auth-failure / `$.codex.setup_doc` / `pr.gates` interaction concerns moved from plugin-nested subsections into a shared "Cross-cutting concerns" section so both invocation modes get parity. Base-branch resolution prose restated inline (first-match-wins) so the skill is self-sufficient without `pull-requests` loaded.
- **`test-writing` (`testing.forbid`)** — now slot-aware: reads `$.testing.backend_framework` (write tests for that runner) + `$.testing.forbid` (never write in forbidden frameworks). Adds `metadata.schema-required: ^1` + a Project Conventions slots table.
- **`jira-updates` (`mcp.*`)** — "Available Tools" header no longer hardcodes the `mcp-atlassian` server name; resolves via `$.mcp.jira` so custom MCP server-name segments work.
- **`conventions-schema.json`** — `spec.filename_pattern` gains its missing `"default": "specs/{slug}.md"` (sibling slots all carry schema defaults; `write-spec` asserted this default the schema didn't back). `branches.patterns` description broadened to name all consumers (base resolution by `pull-requests` + `codex-review`; the `pattern` field's reuse by `write-spec` for `{issue_key}` detection).

### Requires

- **`sandermuller/boost-core ^0.11`** (was `^0.10`). `0.11.0` adds the `BoostWrapperContract` so bare-CLI `boost sync` no longer false-positive-flags wrapper-injected files for deletion — the correctness half of the wrong-entry-point bug class (`0.10.0` closed the discoverability half with the `boost doctor` entry-point banner). `0.10.x` + `0.9.x` improvements ride in transitively.

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.5" "sandermuller/boost-core:^0.11"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel














```
No `boost.php` or convention changes. The slot-vocabulary is unchanged — these are prose/schema-default refinements, not new slots.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.4...1.9.5

## 1.9.4 - 2026-05-29

<!-- verified-sha: 429039c4b99fae4b9e1672bb0a50675da83935d4 -->
Closes a tag-bucketing inconsistency where the `pre-release` skill was the odd-one-out in the release-tooling cluster (`pre-release` tagged `php github` while siblings `readme` / `release-notes` / `upgrading` are all tagged `release-automation`). Surfaced by a downstream consumer who reasonably declared `withTags(Php, Github)` for an application repo and ended up needing to explicitly exclude `pre-release` since the app doesn't do release work.

### Changed

- **`pre-release` skill re-tagged: `php github` → `php github release-automation`.** Subset-AND match — all three tags required for the skill to sync. Preserves PHP+GitHub scoping (the skill references Rector/Pint/Pest/PHPStan + `gh release create`) while adding the opt-in gate to align with sibling release-tooling skills.

### Behavior change for current consumers

- **Package authors with `release-automation` declared** (standard family pattern, gets you readme/release-notes/upgrading siblings): no change — `pre-release` still syncs.
- **PHP+GitHub package authors WITHOUT `release-automation` declared**: lose `pre-release`. Likely correct — if not doing release work, the skill doesn't apply.
- **PHP+GitHub app authors with just `Php` + `Github`** (the surfaced case): correctly stop receiving `pre-release`. If you previously had an explicit `withExcludedSkills(['pre-release'])` to silence it, you can drop that line.

If you want `pre-release` back, add `release-automation` to your `withTags(...)`.

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.4"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel















```
**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.3...1.9.4

## 1.9.3 - 2026-05-29

<!-- verified-sha: de550633851f5cc0576c9b54ed9c28ea9a68a954 -->
### Changed

- **`require-dev` `sandermuller/package-boost-php` `^0.10` → `^0.12`.** Tracks the family-package's `0.11 → 0.12` floor-bump (which itself floored `boost-core` to `^0.10`, aligned with what `boost-skills 1.9.2` already requires). Dev-only constraint — keeps the catalog's own dev environment current with the family. Consumers unaffected (the require-dev constraint doesn't propagate downstream).

### Internal

- `.gitignore` managed-region catches up to current engine output: drops `.github/copilot-instructions.md`, `.github/skills/`, `AGENTS.md`, `CLAUDE.md`. Per the boost-core 0.9.0+ / 0.9.6+ path-ownership contract, those paths are either retired emitters or tracked audit copies.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.2...1.9.3

## 1.9.2 - 2026-05-29

<!-- verified-sha: a83b3548a397e32944d9f8963bf215ba09c0e4c0 -->
Floor-bumps the engine to `boost-core ^0.10` for the cross-agent capability-symmetry fix that landed in `0.10.0`. Laravel projects wiring the bare-CLI hook (`BoostAutoSync::run` in `composer.json` scripts) previously lost bundled `pest-testing` / `livewire-development` / `filament-development` / Inertia / Flux / Volt / Tailwind / Wayfinder / `laravel-best-practices` skills to Cursor / Copilot / Codex — the gap was masked locally by laravel/boost's MCP server for Claude Code only.

### Changed

- **`boost-core` floor `^0.9.3` → `^0.10`** (README + UPGRADING). Load-bearing per `0.10.0`'s entry-point-mismatch banner + the three-case `boost tags` diagnostic split. Earlier `0.9.3` data-loss patch + `0.9.4` diagnostic visibility ride along transitively.
- **UPGRADING.md section renamed** "From 1.7.x to 1.8.0" → "From 1.7.x to 1.9.x (current)". Walkthrough lede, composer-require example, and commit-message exemplar updated to current-floor coherence. Earlier `1.8.0` mis-tag is called out inline — pin `^1.8.1` or `^1.9.0+`, never bare `^1.8`.
- **`release-notes` skill body** (consumer-facing for agents drafting release bodies):
  - Flat top-level section structure (`## Added` / `## Changed` / `## Fixed` / `## Internal`; no `## What's changed` umbrella).
  - "No marketing-tone / audit-narration / framework-fold-in intro paragraphs" rule replaces the old absolute "no opening paragraph" rule; short value-add intros explaining a non-obvious bug class or upgrade-decision context are explicitly allowed.
  - Expanded What-to-omit list: leading version heading, `## Validation` / quality-gate counts, `## Acknowledgments` / pattern-tracking, dogfooding narrative, process choreography, peer-handle credits, "unchanged from prior" segments.
  - Worked good-shape example with section order matching the prescribed structure.
  

### Adoption

```bash
composer require --dev "sandermuller/boost-skills:^1.9.2" "sandermuller/boost-core:^0.10"
vendor/bin/boost sync   # or `php artisan project-boost:sync` in Laravel projects

















```
Per `0.10.0`'s entry-point-mismatch banner: Laravel projects currently wired to the bare-CLI hook in `composer.json` scripts should swap to `@php artisan project-boost:sync` to close the cross-agent symmetry gap. `boost doctor` flags the mismatch automatically once `boost-core 0.10` is installed alongside `project-boost-laravel`.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.1...1.9.2

## 1.9.1 - 2026-05-29

### Changed

- **`autoresearch` skill — Laravel deep-dive subsection absorbed.** Vendor body grew from 286 → 488 lines with a new "Laravel projects — deep-dive variations" section layered on top of the generic flow. Activated for Laravel route/job/Eloquent code paths; skipped for pure-PHP, raw PDO, or CPU-bound targets per an activation-rubric table at the top of the section. The deep-dive covers:
  
  - Two metrics (`query_count` + `execution_median_ms`) instead of one — query count is often the dominant signal for database-heavy work.
  - Transactional benchmark template using the application kernel + Eloquent + factories + `DB::beginTransaction()` / `rollBack()` + `cache()->flush()` / `Once::flush()` between iterations.
  - Optional `sandermuller/stopwatch` profiling helper with explicit fallback to manual `hrtime(true)` checkpoints.
  - Two bottleneck taxonomies — query-count (eager loading, relation reuse, bulk inserts, audit suppression, touch suppression, deferred execution, duplicate elimination) and execution-time (validation overhead, double processing, object creation, event overhead, transaction batching, serialization).
  - Two-metric decision logic: `improved = queries < prev_queries OR execution_ms < prev_ms * 0.98`.
  - Laravel-specific constraints (`migrate:fresh` ban, factories not raw SQL, transaction rollback, `Once::flush()` between iterations, no test modification, preserve API contracts, never weaken security).
  
  Two strong-directive inline pointers in the generic body (Step 2 baseline + Phase 6 decide) route Laravel readers into the deep-dive with explicit consequence framing — "Skipping the deep-dive and drafting a generic benchmark for a Laravel target will leave you optimizing the wrong metric." Generic flow stays intact for non-Laravel consumers; pure-PHP / raw-PDO / different-ORM consumers can skip the deep-dive entirely per the activation rubric.
  
  Consumers maintaining a local `autoresearch` shadow with Laravel-specific content can drop the shadow on `1.9.1` adoption.
  
- **`ai-guidelines` skill — Laravel-substitute note.** Single inline note after the first `vendor/bin/boost sync` reference: Laravel projects with `sandermuller/project-boost-laravel` installed should substitute `php artisan project-boost:sync` for `vendor/bin/boost sync` throughout the skill. The bare `vendor/bin/boost sync` currently errors on `Container::path()` in Laravel projects until a wrapper-side or engine-side fix lands; the note closes the consumer-side friction without polluting the canonical skill with wrapper-specific commands at every reference.
  
- **`README.md` — Requires-line polish + floor-pin discipline cross-link.** Reference to "boost-skills 1.8.0" updated to "boost-skills 1.8.1+" (the `1.8.0` tag was mis-tagged and ships `1.7.2` content). Added a brief sentence on the load-bearing-only floor-pin discipline: polish-tier improvements in subsequent `0.9.x` releases (e.g. `0.9.4` diagnostic-visibility UX) ride along via the range constraint without forcing the floor higher.
  

### Adoption path

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9.1"
vendor/bin/boost sync
vendor/bin/boost validate


















```
Or in Laravel projects with `project-boost-laravel`:

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9.1"
php artisan project-boost:sync
vendor/bin/boost validate


















```
No migration step from `1.9.0`. Drop-in replacement.

### Acknowledgments

`1.9.1` ships absorption-pattern data point #2 (codex-review absorption in `1.8.0-rc1` was #1; `autoresearch` absorption is #2). The shape — universal-content-moves-into-catalog, with the absorbed content scoped via an activation-rubric — continues to earn its place. Real-world adoption signal: a proving consumer maintained a local shadow with substantive content that generalized cleanly to other consumers in the same framework class; absorbing it into the catalog drops the shadow and broadens the value.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.9.0...1.9.1

## 1.9.0 - 2026-05-29

### Changed

- **`pre-release` skill — "user cuts the tag" rule split into two clauses.** Agent must NOT execute `git tag` / `gh release create` / `git push --tags` (preserved). Agent MUST present the explicit `gh release create` command shape in the handoff (new requirement). Prose target-naming is the default-resolution trap; explicit-arg-shape removes it.
  
- **`pre-release` skill — new "Canonical handoff command shape" subsection** between step 7 and step 8. Specifies the required handoff format:
  
  ```bash
  gh release create <TAG> \
      --target <BRANCH> \
      --title "v<VERSION>" \
      -F internal/release-notes-<VERSION>.md
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  ```
  The `--target <BRANCH>` flag is always explicit, even when `main`. The branch named there MUST match the branch containing the verified-sha commit in the notes file.
  
- **`pre-release` skill — "ready to tag" reporting** now references the canonical handoff format instead of stopping at prose-level "ready" framing.
  

### Generalized principle

The discipline generalizes beyond `gh release create`: any agent→user handoff involving a CLI command with default-resolution paths must surface the relevant flag explicit, not rely on prose accuracy. Examples covered by the same principle: `git push` (default remote), `composer require` with version constraint (default stability resolution), `npm` / `yarn` / `pnpm` (default registry resolution). The skill subsection documents the broader pattern.

### Adoption path

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.9"
vendor/bin/boost sync
vendor/bin/boost validate



















```
No migration step from `1.8.1`. Drop-in replacement; the new discipline applies to agents invoking the `pre-release` skill from this version forward.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.8.1...1.9.0

## 1.8.1 - 2026-05-28

**`1.8.1` supersedes `1.8.0`.** The `1.8.0` tag was cut at `main` HEAD (the post-`1.7.2` CHANGELOG-update commit) instead of the prep branch HEAD that carried the `1.8.0` catalog work — so the `1.8.0` tarball ships `1.7.2` content under a `1.8.0` version label. `1.8.1` is `1.8.0`'s intended content, tagged at the correct SHA. **Consumers should pin to `^1.8.1` rather than `^1.8` to skip the broken `1.8.0`.**

### Requires

- `sandermuller/boost-core ^0.9.3` — ships the `->withConventions([...])` builder method, the render-from-boost.php path, the `boost convert-conventions` migration command, the fail-closed both-sources-non-empty reconcile contract, AND the render-fail-then-write data-loss patch from `0.9.3`. The `^0.9.3` floor is defensive: a validation failure between the schema-read and the CLAUDE.md-write on `boost sync` could blank out the rendered block under the `0.9.0` / `0.9.1` / `0.9.2` engines. Polish-tier improvements in subsequent `0.9.x` releases (`0.9.4` diagnostic-visibility UX) ride along via the range constraint without forcing the floor higher.

### Catalog content (all carried over from the intended `1.8.0` cut)

The bulk of the content shipped under `1.8.0-rc1` (rc-cycle, real catalog content). The `1.8.0` stable tag was supposed to ship `1.8.0-rc1` content + the floor-bump; the mis-tag meant `1.8.0` shipped neither. `1.8.1` ships both. See [`1.8.0-rc1`'s release notes](https://github.com/SanderMuller/boost-skills/releases/tag/1.8.0-rc1) for the full per-item detail; summary below.

- **Operator-edit surface flips** — `CLAUDE.md` (YAML block) → `boost.php` (`->withConventions([...])` array). Slot vocabulary, agent-read behavior, schema-versioning contract, and validation semantics unchanged from `1.7.x`.
- **Skill prose update across 9 slot-aware skills** — opening "Project Conventions slots" tables and missing-slot UX prose describe the edit surface as "`boost.php` via `->withConventions([...])`". Skills updated: `jira-create`, `jira-rework`, `jira-updates`, `pull-requests`, `codex-review`, `bug-fixing`, `write-spec`, `interview`, `backend-quality`.
- **`pull-requests` skill body** — last explicit "declare `$.pr.gates` in their CLAUDE.md" reference rewritten to point at `boost.php`'s `->withConventions([...])` array.
- **`ai-guidelines` skill table** — AGENTS.md producer list reflects `boost-core 0.9.0`'s `CopilotTarget` joining the AGENTS.md shared-pool: "Codex / Copilot / Cursor / Amp / Junie / Kiro / OpenCode / etc.".
- **README "Project Conventions schema" section** — `->withConventions([...])` PHP-array example in `boost.php` replaces the marker-bounded YAML-in-CLAUDE.md example. Tooling table includes `boost convert-conventions`. `Migrating from 1.7.x` subsection.
- **`UPGRADING.md`** — canonical migration recipe for `1.7.x` → `1.8.x` consumers.
- **`codex-review` skill absorbs the `codex-plugin-cc` invocation playbook** — vendor skill self-contained for plugin mode: plugin install, Codex CLI install, companion script path resolution, four invocation patterns, polling loop with stale-result trap, result retrieval, auth failure mode, `pr.gates on_missing` interaction. Skill body 220 lines (was 155 pre-rc1).
- **`$.codex.setup_doc` slot description narrowed** — now: "Optional path to a project-owned doc with project-specific codex overrides only [...]. Most consumers leave this slot unset." Backward compatible.
- **Codex invocation patterns reference `$.github.default_base_branch`** — base resolution is slot-driven, not hardcoded.
- **`ai-guidelines` generated-files table** — `.github/copilot-instructions.md` row dropped in `1.7.2`; carried through `1.8.x`.
- **Floor-bump to `boost-core ^0.9.3`** — defensive floor, data-loss-patch rationale documented in `README.md` "Requires" line + `UPGRADING.md` "Required" section + `UPGRADING.md` adoption commit shape.

### Schema design notes

No schema vocabulary changes from `1.7.x`. `conventions-schema.json` v1 remains the contract. `$.codex.setup_doc` description narrowed per the codex-review absorption (no breaking change).

### Validation

- 27/27 skills + 1/1 guideline manifest valid.
- `opis/json-schema ^2.4` schema validation contract unchanged from `1.7.0` (operates on parsed values, format-agnostic for PHP-array vs YAML source).

### Adoption path

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.8.1" \
  "sandermuller/boost-core:^0.9.3"

# 1.7.x consumers only — migrate the edit surface
vendor/bin/boost convert-conventions

vendor/bin/boost sync
vendor/bin/boost validate




















```
The `^1.8.1` floor (rather than `^1.8`) skips the broken `1.8.0` tag. See [`UPGRADING.md`](UPGRADING.md) for the full `1.7.x` → `1.8.x` migration recipe.

### What's Changed

* 1.8.0 stable prep: floor-bump to boost-core ^0.9.3 (CI trigger) by @SanderMuller in https://github.com/SanderMuller/boost-skills/pull/5

### New Contributors

* @SanderMuller made their first contribution in https://github.com/SanderMuller/boost-skills/pull/5

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.8.0...1.8.1

## 1.8.0 - 2026-05-28

### Requires

- `sandermuller/boost-core ^0.9.3` — ships the `->withConventions([...])` builder method, the render-from-boost.php path, the `boost convert-conventions` migration command, the fail-closed both-sources-non-empty reconcile contract, AND the render-fail-then-write data-loss patch from `0.9.3`. The `^0.9.3` floor (rather than `^0.9.0`) is defensive: a validation failure between the schema-read and the CLAUDE.md-write on `boost sync` could blank out the rendered block under the `0.9.0` / `0.9.1` / `0.9.2` engines. `^0.9.3` ensures every consumer adopting `1.8.0` gets the patch by default. Polish-tier improvements in subsequent `0.9.x` releases (`0.9.4` diagnostic-visibility UX) ride along via the range constraint without forcing the floor higher.

### Changed since `1.8.0-rc1`

- **Floor-bump** — `README.md` "Requires" line + `UPGRADING.md` "Required" section + `UPGRADING.md` adoption commit shape all carry `^0.9.3` with the data-loss-patch rationale prose. No skill-body changes; no schema vocabulary changes; no vendor-skill behavior changes.

### Carried forward from `1.8.0-rc1`

The bulk of the `1.8.0` content shipped under `1.8.0-rc1`. The following all stay landed; see [`1.8.0-rc1`'s release notes](https://github.com/SanderMuller/boost-skills/releases/tag/1.8.0-rc1) for the full per-item detail.

- **Skill prose update across 9 slot-aware skills** — opening "Project Conventions slots" tables and missing-slot UX prose describe the edit surface as "`boost.php` via `->withConventions([...])`". Skills updated: `jira-create`, `jira-rework`, `jira-updates`, `pull-requests`, `codex-review`, `bug-fixing`, `write-spec`, `interview`, `backend-quality`.
- **`pull-requests` skill body** — last explicit "declare `$.pr.gates` in their CLAUDE.md" reference rewritten to point at `boost.php`'s `->withConventions([...])` array.
- **`ai-guidelines` skill table** — AGENTS.md producer list reflects `boost-core 0.9.0`'s `CopilotTarget` joining the AGENTS.md shared-pool: "Codex / Copilot / Cursor / Amp / Junie / Kiro / OpenCode / etc.".
- **README "Project Conventions schema" section** — `->withConventions([...])` PHP-array example in `boost.php` replaces the marker-bounded YAML-in-CLAUDE.md example. Tooling table includes `boost convert-conventions`. `Migrating from 1.7.x` subsection.
- **`UPGRADING.md`** — canonical migration recipe for 1.7.x → 1.8.0 consumers.
- **`codex-review` skill absorbs the `codex-plugin-cc` invocation playbook** — vendor skill self-contained for plugin mode: plugin install, Codex CLI install, companion script path resolution, four invocation patterns, polling loop with stale-result trap, result retrieval, auth failure mode, `pr.gates on_missing` interaction. Skill body 220 lines (was 155 pre-rc1).
- **`$.codex.setup_doc` slot description narrowed** — now: "Optional path to a project-owned doc with project-specific codex overrides only [...]. Most consumers leave this slot unset." Backward compatible.
- **Codex invocation patterns reference `$.github.default_base_branch`** — base resolution is slot-driven, not hardcoded.
- **`ai-guidelines` generated-files table** — `.github/copilot-instructions.md` row dropped in `1.7.2`; carried through `1.8.0-rc1` + `1.8.0`.

### Schema design notes

No schema vocabulary changes from `1.7.x` or `1.8.0-rc1`. `conventions-schema.json` v1 remains the contract. `$.codex.setup_doc` description narrowed in `1.8.0-rc1` per absorption (no breaking change).

### Validation

- 27/27 skills + 1/1 guideline manifest valid.
- `opis/json-schema ^2.4` schema validation contract unchanged from `1.7.0` (operates on parsed values, format-agnostic for PHP-array vs YAML source).

### Adoption path

```bash
# 1. Update constraints
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.8" \
  "sandermuller/boost-core:^0.9.3"

# 2. Migrate conventions edit surface (1.7.x consumers only)
vendor/bin/boost convert-conventions

# 3. Re-sync + verify
vendor/bin/boost sync
vendor/bin/boost validate





















```
See [`UPGRADING.md`](UPGRADING.md) for the full `1.7.x` → `1.8.0` migration recipe (or the `boost-skills 1.8.0-rc1 → 1.8.0` adoption note, which is the one-line constraint flip from `^1.8@RC` → `^1.8` plus stability flip).

### Acknowledgments

`1.8.0` shipped under the proving-consumer pattern that's stabilized across the family: a single high-friction consumer (`hihaho`) running the full migration end-to-end through `rc1`, surfacing zero vendor-side regressions and validating the codex-review absorption against real production usage. Engine-side parallel cadence held: `boost-core 0.9.0 → 0.9.4` delivered five patches in close succession with no schema-side adaptation required.

### Migration from `1.7.x`

See [`UPGRADING.md`](UPGRADING.md) for the full migration recipe. One-command path: `vendor/bin/boost convert-conventions` after the constraint bump.

### Migration from `1.8.0-rc1`

Atomic-commit shape, ~30 seconds of work:

```bash
composer require --dev --with-all-dependencies \
  "sandermuller/boost-skills:^1.8"





















```
Then in `composer.json`: `minimum-stability` from `RC` → `stable` (or drop the field if you previously bumped only for this catalog). Run `composer update` to lockfile-flip. `boost-core` floor moves to `^0.9.3` transitively.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.7.2...1.8.0

## 1.7.2 - 2026-05-28

<!-- verified-sha: 05bd62ae8141e35ea602954b6cd405f80bf027a1 -->
### 1.7.2

Aligns the catalog with `sandermuller/boost-core 0.9.0`'s drop of the `.github/copilot-instructions.md` guideline-file emission. After 0.9.0 ships, the `CopilotTarget` no longer writes that file — Copilot now reads root `AGENTS.md` for guideline context per the GitHub Changelog 2025-08-28 + 2026 cloud-agent / CLI / JetBrains rollouts. Boost-core already emits `AGENTS.md` via `CodexTarget`, so the separate copilot-instructions write was duplicate.

Doc-only patch. No schema changes, no skill content rewrites, no functional behavior changes.

#### Changed

- **`ai-guidelines` skill** — removed the `.github/copilot-instructions.md` row from the Generated File/Directory reference table. The remaining `.github/skills/` entry stays (Copilot still consumes skills from that path; only the guideline-instructions emission drops).

#### Notes

- Ships immediately to align with `boost-core 0.9.0`'s release window — consumers adopting `boost-core ^0.9` on `boost-skills 1.7.x` see a correct catalog table during the 0.9.0 → 1.8.0 window without waiting for the larger 1.8.0 conventions-source-flip release.
- If your project previously had `.github/copilot-instructions.md` in your project gitignore, the boost-core write to that path is now dropped — the gitignore entry becomes a dead line and can be removed during your 0.9.0 adoption.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.7.1...1.7.2

## 1.7.1 - 2026-05-28

<!-- verified-sha: 1585e172fd1528e3cd430f341b7dcd3039ff19b4 -->
### 1.7.1

Documentation polish: clarifies that `boost-core`'s `Tag` enum vocabulary is broader than the tag-registry table in this README. Surfaced by real-world adoption (a Laravel-app consumer declared `Tag::Filament` / `Tag::Livewire` in `withTags(...)` as forward-compatible slots and hit "possible typo" diagnostics from `boost tags` despite the declarations being correct + intentional).

No schema changes, no skill content changes, no functional behavior changes. Doc-only release.

#### Changed

- **README Tags section** — added a paragraph after the existing mechanism-vs-vocabulary split clarifying that `boost-core` ships a broader `Tag` enum (`Tag::Filament`, `Tag::Livewire`, `Tag::Volt`, `Tag::Inertia`, `Tag::Flux`, `Tag::Pest`, `Tag::Tailwind`, others) with cases not bound to any current `boost-skills` skill. Declaring these in `withTags(...)` is harmless + forward-compatible — `boost-core` 0.7.5+ preserves declared-but-undiscovered tags across `boost install` picker re-runs.

The tag-registry table below the new paragraph stays unchanged — it documents tags `boost-skills` itself currently ships content under, not the family-wide enum vocabulary.

#### Notes

- The "possible typo" diagnostic wording in `boost-core`'s `boost tags` command is queued for separate engine-side polish; this README clarification removes the consumer-side ambiguity in the docs without waiting on engine release.
- Adoption flow for new consumers is unchanged. Existing consumers don't need to update anything.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.7.0...1.7.1

## 1.7.0 - 2026-05-28

<!-- verified-sha: 74170dfa86f25331955cb359220c040dddd9429b -->
### 1.7.0

Adds the conventions-schema slot-fill mechanism: vendor skills reference project-specific values (Jira project key, repo conventions, branch patterns, test framework, MCP server names, policy declarations) by JSONPath; consumers fill values in a `## Project Conventions` block in `CLAUDE.md` instead of shadowing entire skills. Nine catalog skills rewrite to consume the schema, from two in the `1.7.0-rc1` / `rc2` cycle to nine in stable.

#### Requires

- `sandermuller/boost-core ^0.8.2` — the conventions-schema engine surface. 0.8.2 ships the marker-bounded guideline-write fix that closes the round-trip-safety gap in 0.8.0/0.8.1. Without 0.8.2, the `Project Conventions` block in `CLAUDE.md` would be wiped on every sync by the upstream `AgentTarget` guideline-write step (acknowledged + fixed engine-side after `rc2` dogfood surfaced the failure mode).

#### Added

- **`resources/boost/conventions-schema.json`** (v1) — JSONSchema (draft 2020-12) defining the slot vocabulary. 8 slot groups (`jira`, `github`, `branches`, `pr`, `testing`, `codex`, `spec`, `mcp`), ~15 slots. Strict `additionalProperties: false` per named group (mcp stays open by design for project-defined MCP service keys). See the [Project Conventions schema](https://github.com/sandermuller/boost-skills#project-conventions-schema) section of the README for the prose contract.
- **`pr.gates` typed-policy mechanism** — array of typed-object gates with closed-enum `skill_invoked` / `shell_command` / `mcp_tool` discriminator. Vendor `pull-requests` dispatches on the `type` field; `mcp_tool` is the open escape hatch for project-specific policy (host registers a custom MCP tool, declares it as a gate) without vendor changes. Strict-rejects unknown types via JSONSchema `oneOf` + `additionalProperties: false`.

#### Changed

Nine skills now read project-specific values from the `## Project Conventions` YAML block in `CLAUDE.md` instead of embedding them in the skill body or asking the user every session. Each declares `metadata.schema-required: ^1` to signal the schema-version contract.

| Skill | Slot consumption |
|---|---|
| `jira-create` | `$.jira.project_key`, `$.jira.refuse_other_projects`, `$.jira.description_format_doc`, `$.mcp.jira` |
| `jira-rework` | `$.mcp.jira`, `$.jira.project_key`, `$.jira.refuse_other_projects` |
| `jira-updates` | `$.mcp.jira`, `$.jira.project_key`, `$.jira.refuse_other_projects`, `$.jira.description_format_doc` |
| `pull-requests` | `$.github.*`, `$.branches.patterns` (typed-object iteration with first-match-wins base resolution), `$.pr.title_format` (placeholder substitution), `$.pr.template_path`, `$.pr.gates` (typed-policy dispatch) |
| `codex-review` | `$.codex.invocation_mode` (plugin / bare_cli), `$.codex.setup_doc` |
| `bug-fixing` | `$.testing.backend_framework`, `$.testing.forbid` |
| `write-spec` | `$.spec.filename_pattern` (with `{issue_key}` / `{slug}` / `{date}` placeholder substitution + empty-placeholder-omit rule), `$.spec.research_docs`, `$.jira.project_key` (for `{issue_key}` resolution) |
| `interview` | `$.spec.research_docs`, `$.jira.project_key` |
| `backend-quality` | `$.testing.backend_framework` |

`pull-requests` additionally switches body/title patch commands from `gh pr edit --body-file` to `gh api -X PATCH` REST path — `gh pr edit --body-file` hits a Projects (classic) GraphQL deprecation in some `gh` versions surfaced during pre-release dogfood.

#### Schema design notes

- **Two-pattern slot taxonomy** — value slots (scalars / arrays / paths, vendor reads directly) vs policy slots (typed-object arrays, vendor dispatches on `type` discriminator). Each pattern has its own missing-slot UX: value-slot missing → ask user once per session; policy-slot missing → skip the policy entirely (no enforcement).
- **All 8 groups root-optional** — only `schema-version` is root-required. Capability-gated groups (`jira`, `github`, `branches`, `pr`, `testing`, `codex`, `spec`) don't force prompts on consumers who don't use the corresponding tag.
- **`additionalProperties: false` at root + per named group** — typos at root level (`jria.project_key`) and nested (`jira.projcet_key`) both fail validation. `mcp.*` intentionally stays open (the vocabulary of service keys is consumer-defined).
- **Per-pattern `base` in `branches.patterns`** — handles real-world hotfix/release branch workflows where `hotfix/*` targets `master` while `feature/*` targets `develop`. Sourced from production dogfood.
- **`codex.invocation_mode` enum default `plugin`** — most consumers benefit from the `codex-plugin-cc` companion script (background queueing, project-aware diff scoping, focus-argument handling, stable file-based result retrieval, `/codex:setup` auth bootstrapping). `bare_cli` stays as an opt-in fallback for environments without per-user `.claude/plugins/` cache (service-account CI runners, headless agents).
- **Strict-closed-enum `pr.gates` types in v1** — `skill_invoked` / `shell_command` / `mcp_tool`. Novel policy that doesn't fit closed-enum uses the `mcp_tool` escape hatch.

#### Tooling (via `boost-core ^0.8`)

- `vendor/bin/boost validate` — validates the `## Project Conventions` block against allowlisted vendors' schemas.
- `vendor/bin/boost slots [--vendor=X] [--missing] [--filled] [--json]` — lists slots across allowlisted vendors with filled / unfilled state.
- `vendor/bin/boost doctor --check-conventions` — adds conventions validation to the existing doctor report.
- `vendor/bin/boost paths --managed` — lists agent-managed paths (used by `pr.gates[].window: since_last_code_change` semantics).

#### Adoption path

1. Bump constraint: `sandermuller/boost-skills: ^1.7` and `sandermuller/boost-core: ^0.8.2` (or via family package — `sandermuller/package-boost-php ^0.10` / `sandermuller/package-boost-laravel ^0.11+` once those release with `^0.8.2` floors).
2. Run `composer update`. Auto-sync scaffolds the `## Project Conventions` block in `CLAUDE.md` on first sync.
3. Fill the YAML block with project values. Run `vendor/bin/boost validate` to surface missing/unknown slots; `vendor/bin/boost slots --missing` for fill-status by slot.
4. Drop any local shadows of the 9 rewritten skills if the vendor versions cover the project's needs.

#### Validation

- `opis/json-schema ^2.4` (engine validator): 17 test cases pass (full draft, minimal-required, strict-rejection of unknown gate types, `additionalProperties: false` at root + nested, schema-version `const: 1`, `jira.project_key` pattern, `branches.patterns` typed-object requirements, `testing.backend_framework` enum, `codex.invocation_mode` enum, `mcp.*` open vocabulary).
- 5 end-to-end engine scenarios + 1 new round-trip scenario pass against `boost-core ^0.8.2`: schema discovery + composition, scaffold flow, `boost slots --json` shape, `boost paths --managed`, schema-version seed, AND round-trip preservation of filled YAML across multiple syncs (the failure mode `rc1`/`rc2` dogfood surfaced + 0.8.2 fixed).

#### Migration from `1.7.0-rc2`

Consumers pinned to `^1.7@RC` or `1.7.0-rc2` resolve to stable `1.7.0` automatically once tagged (Composer's stability-suffix semantics: stable wins over RC). No constraint edit needed.

Consumers should also bump `sandermuller/boost-core` to `^0.8.2` if their constraint floor is lower — `1.7.0` requires the engine round-trip fix.

The `1.7.0-rc1` tag at `bf3c606` remains as a historical artefact — it was mis-targeted from `main` HEAD instead of the prep branch and never contained the schema work; `1.7.0-rc2` at `ca118a8` was the corrected RC.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.6.0...1.7.0

## 1.6.0 - 2026-05-27

### Added

- **`readme`** — author and maintain a high-quality README for a Composer package. Covers stub vs comprehensive shapes, voice, anti-patterns, staleness audit. Tagged `release-automation`.
- **`release-notes`** — draft GitHub release bodies for Composer packages. Covers structure (Breaking / Added / Fixed / Internal), past-tense voice, breaking-change callouts with migration code, and what to omit. Tagged `release-automation`.
- **`upgrading`** — canonical structure for UPGRADING.md in a Composer package. Covers when to maintain one, voice, anti-patterns. Tagged `release-automation`.

Content unchanged; only the publishing vendor changed. Tag-gated so consumers opt in via `withTags(..., 'release-automation')`. The vendor-side rationale (narrowing `package-boost-php` to package-author CLI + skill-authoring scope) lives in `package-boost-php`'s 0.10.0 release notes.

### Changed

- **`pre-release` skill** refactored to defer to the new sibling skills for canonical authoring rules. README staleness audit (§5a) now references the `readme` skill's audit section; release-notes drafting (§7) references the `release-notes` skill's structure / voice / breaking-change conventions. `pre-release` retains its orchestration role: timing (when notes draft, only after step-6 CI green), scrubbing rules (no internal noise in public release bodies), and the gating logic. The canonical convention content lives in the called-out skills.
- **`release-automation` tag** scope broadened. Was "CI release-automation convention" (single guideline, owned by `package-boost-php`). Now "release flow content: README authoring, release notes, UPGRADING, CI changelog automation" (3 skills owned by `boost-skills` + 1 guideline owned by `package-boost-php`). Tag registry row updated to reflect shared ownership.

### Migration

**Default upgrade path** — no action required for consumers who haven't declared `release-automation`. These skills are tag-gated; without the tag, sync is unchanged.

**To opt in to the moved skills**:

1. Ensure `sandermuller/boost-skills ^1.6` is in `withAllowedVendors([...])`.
2. Add `'release-automation'` to `withTags(...)` in `boost.php`.
3. Re-sync (`vendor/bin/boost sync` or via `composer install` auto-sync).

**Overlap-window workaround** — until `sandermuller/package-boost-php 0.10.0` ships (planned shortly after this release), consumers running both packages allowlisted AND declaring `release-automation` will hit a vendor-vs-vendor skill collision (`readme`, `release-notes`, `upgrading` published by both vendors). `boost-core` errors on the collision rather than picking a copy. Disambiguate by adding to `boost.php`:

```php
->withExcludedSkills([
    'sandermuller/package-boost-php:readme',
    'sandermuller/package-boost-php:release-notes',
    'sandermuller/package-boost-php:upgrading',
])

























```
The exclusions force resolution to `boost-skills`'s copies during the overlap. Once `package-boost-php >= 0.10.0` is required (the version that drops these 3 skills), remove the `withExcludedSkills` block.

The collision affects only consumers that allowlist both packages AND declare the `release-automation` tag — primarily the boost-family dogfood projects (`boost-core`, `boost-skills`, the family-author packages). External consumers that don't declare the opt-in tag are unaffected.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.5.0...1.6.0

## 1.5.0 - 2026-05-27

- **`eloquent-models`** — creates and maintains Eloquent models with strict conventions: column/relation constants via `final public const`, comprehensive class docblock with typed `@property` and `@property-read` sections, foreign keys via constants, and the Laravel 11+ `casts()` method form referencing column constants. Includes a per-model checklist. Tagged `laravel` — sources content for any project that declares the `laravel` tag in `withTags(...)`. Sourced from production dogfood across multiple Laravel codebases; example domain genericized to parent/child/grandchild/tag for upstream.
- **`laravel` tag** — declared by a project using the Laravel framework (Eloquent ORM, service providers, framework integrations). Owner `boost-skills`. First entry in the registry for Laravel-wide capability tagging; pairs forward with future Laravel-framework-specific skills.

### Notes

- The constant syntax used in `eloquent-models` is `final public const NAME = 'value'` (untyped form, PHP 8.0+) — compatible with every PHP version Laravel 10/11/12 supports.
- The `casts()` method form is Laravel 11+. Laravel 10 consumers should adapt the example to the `protected $casts` property form (silent no-op otherwise).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.4.0...1.5.0

## 1.4.0 - 2026-05-25

Adds the first framework-specific skill (22 → 23) and registers two new capability tags. The skill is gated by tags — non-Laravel-Cloud consumers never see it.

### Added

- **`deploying-laravel-cloud`** — deploys and manages Laravel applications on Laravel Cloud via the `cloud` CLI: environments, databases, caches, domains, instances, background processes, billing. Tagged `laravel-cloud hosting` — a project must declare both to receive it. Sourced from production dogfood in a downstream Laravel-Cloud app; upstreamed here for shared maintenance.
- **`hosting` tag** — declared by a project that deploys to a hosted platform. Forward-compatible parent for platform-specific hosting tags (`laravel-cloud`, future siblings).
- **`laravel-cloud` tag** — declared by a project that deploys to Laravel Cloud specifically. Pair with `hosting` to receive `deploying-laravel-cloud`.

### Changed

- **README tag registry** — tightened wording, restructured the Tags section, added an Install example, and disambiguated `github` from `github-issues` explicitly (a repo hosted on GitHub but tracking issues in Jira declares `github` but not `github-issues`).
- **`boost-extension` tag** registered in the family-wide tag registry — owner `package-boost-php`. Documents the cross-family tag vocabulary even when the content lives elsewhere.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.3.0...1.4.0

## 1.3.0 - 2026-05-22

Adds three new guidelines (3 → 6), closing recurring gaps found across the boost-family repos. All three are tagged — they sync only to projects that declare the matching capability.

### Added

- **`javascript`** — JS/TS control-structure style (curly braces always, no single-line conditionals). Tagged `frontend`.
- **`phpstan-fixing`** — when a PHPStan error maps to a runtime bug, write a failing test before the fix. Tagged `php`.
- **`single-issue-scope`** — keep each session, branch, and PR focused on exactly one issue. **Opt-in** — tagged `single-issue-scope`; declare that tag in `withTags(...)` to receive it.

All three are tagged via `.boost-tags.yaml` (`boost-core` 0.6.0+ reads it; the manifest is inert on older versions or under `laravel/boost`).

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.2.0...1.3.0

## 1.2.0 - 2026-05-22

Guidelines can now be capability-tagged, the same way skills are.

### Added

- **Guideline tag manifest** — a sidecar `resources/boost/guidelines/.boost-tags.yaml` maps a guideline to capability tags, so a guideline ships only to projects that declare the matching capability via `withTags(...)`. `database-safety` and `migrations` are tagged `database`; `verification-before-completion` stays untagged (universal). A project without a database no longer carries the database guidelines.
  
  Guidelines stay frontmatter-free — required for `laravel/boost` compatibility — so the tags live in the sidecar manifest rather than in the file. `boost-core` 0.6.0+ reads it; on older `boost-core` and under `laravel/boost` the manifest is inert and every guideline ships, so this is a forward-safe change.
  
- The CI validator now parse-checks every `.boost-tags.yaml` — invalid YAML, a non-map, a key that names no real guideline file, or a malformed tag fails the build. A bad manifest is a release-blocker, never a consumer surprise.
  

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.1.0...1.2.0

## 1.1.0 - 2026-05-22

Adds two skills (20 → 22) and tightens two existing ones.

### Added

- **`humanizer`** — removes signs of AI-generated writing (inflated significance, promotional language, em-dash overuse, rule-of-three, AI-vocabulary words, hedging, sycophancy) so text reads as natural and human. Vendored from the MIT-licensed `blader/humanizer` skill. Untagged — it applies to any project's prose.
- **`github-issue-updates`** — appends a user-facing description and QA testables to a GitHub issue after a feature ships, and moves the issue on its project board. The GitHub-Issues counterpart of `jira-updates`. Tagged `github-issues` — the first skill to use that capability tag.

### Changed

- **`bug-fixing`** — replaced a validation-library code example with a stack-neutral one (genericization residue a 1.0.0 pass missed).
- **`pre-release`** — sharpened the release-notes scrub step into a concrete grep checklist for internal identifiers.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/1.0.0...1.1.0

## 1.0.0 - 2026-05-21

The first stable release of `boost-skills`. It grows the package from 15 to 20 skills, introduces always-on guidelines as a new content type, and genericizes every shipped skill and guideline so nothing carries project- or framework-specific assumptions.

### Added

#### Skills (15 → 20)

- `interview` — structured Q&A to gather a complex feature's requirements before writing its spec; pairs with `write-spec`.
- `pull-requests` — create and manage your own GitHub PRs via the `gh` CLI: write the description, verify, route by risk.
- `resolve-conflicts` — resolve git merge conflicts without dropping functionality from either side.
- `test-writing` — write specific, descriptively named tests that follow Arrange-Act-Assert.
- `ux-review` — weigh UX/UI options for a new feature, recommend an approach, and document the decision.

#### Guidelines

A new content type — always-on guidelines under `resources/boost/guidelines/`, folded into `CLAUDE.md` / `AGENTS.md` alongside the skills:

- `database-safety` — never run destructive database commands; treat the test database as test-runner-owned.
- `migrations` — keep migration files self-contained; append columns rather than positioning them mid-table.
- `verification-before-completion` — run the verification command and read its output before claiming work is done.

### Changed

- **Genericized every skill and guideline** — removed project- and framework-specific assumptions (hardcoded toolchains, version matrices, framework idioms) so the content applies whatever the stack, and renders correctly under both `boost-core` and `laravel/boost`.
- `backend-quality` and `frontend-quality` made stack-agnostic in their test, lint, and type-check steps.
- Corrected `boost-tags` across the skill set — the package ships 9 capability-tagged skills and 11 universal ones, across the `php`, `frontend`, `github`, and `jira` tags.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/compare/0.1.0...1.0.0

## 0.1.0 - 2026-05-20

First release of `boost-skills` — a package of generic AI agent skills in the `SKILL.md` Agent Skills format, for PHP projects and Composer packages. Skills are authored once here and distributed to every configured AI agent (Claude Code, Cursor, Copilot, Codex, Gemini, and the rest) by `boost-core`. Install `boost-skills` alongside a boost family package; see the README for setup.

### Skills

15 skills ship under `resources/boost/skills/`:

- **Review** — `code-review`, `codex-review`, `pr-review-feedback`, `evaluate`
- **Specs** — `write-spec`, `implement-spec`
- **Quality gates** — `backend-quality`, `frontend-quality`, `pre-release`
- **Debugging & performance** — `bug-fixing`, `autoresearch`
- **Jira workflow** — `jira-create`, `jira-rework`, `jira-updates`
- **AI configuration** — `ai-guidelines`

### Skill tags

Seven skills declare `boost-tags` — capability tags (`php`, `frontend`, `github`, `jira`) that mark which projects a skill is relevant to. A `boost-core` version with tag filtering syncs a tagged skill only to projects that opt into the matching capability; with earlier versions the tags are inert and every skill syncs. The remaining eight skills are universal.

**Full Changelog**: https://github.com/SanderMuller/boost-skills/commits/0.1.0

## [Unreleased]
