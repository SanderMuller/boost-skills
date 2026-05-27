# Changelog

All notable changes to `sandermuller/boost-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
