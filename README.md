# boost-skills

> Sander Muller's personal Composer-distributed catalog of AI agent skills for PHP projects and Composer packages. Adopt it if your preferences align with Sander's, or use it as a template for your own.

[![Latest Version on Packagist](https://img.shields.io/packagist/v/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![Total Downloads](https://img.shields.io/packagist/dt/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![License](https://img.shields.io/packagist/l/sandermuller/boost-skills.svg?style=flat-square)](LICENSE)
[![Laravel Boost](https://badge.laravel.cloud/boost-badge.svg?style=flat-square)](https://github.com/laravel/boost)

`sandermuller/boost-skills` is one example of a Composer-distributed AI-skill catalog. It ships a curated mix of generic workflow skills (code review, bug fixing, spec-driven implementation, release checklists, Jira workflows, deployment, and more), tag-gated framework-specific extras, and always-on [guidelines](#guidelines) — see the full [Skills](#skills) and [Guidelines](#guidelines) inventories below.

The package carries no runtime code; it's pure Markdown. A sync engine ([`sandermuller/boost-core`](https://github.com/sandermuller/boost-core) or [`laravel/boost`](https://github.com/laravel/boost)) reads these skills and writes them into each AI agent directory you've configured (Claude Code, Cursor, Copilot, Codex, Gemini, and the rest).

## Where do skills come from?

Anywhere you want. Skill sources stack — mix and match freely:

- **Your own `.ai/skills/` folder**, hand-authored next to the rest of the project. Same convention `laravel/boost` and `boost-core` both pick up automatically.
- **A Composer-installed catalog package**. Any package that ships `resources/boost/skills/` works. Sander publishes his personal catalog at [`sandermuller/boost-skills`](https://github.com/sandermuller/boost-skills) (this repo) — adopt it if your preferences align with Sander's, or use it as a template for your own private/public catalog.
- **External, non-Composer sources** via `boost-core`'s `withRemoteSkills()`. Pull GitHub-published `.skill` bundles or single-skill repos straight from a URL.
- **`laravel/boost`'s bundled Laravel skills** — Laravel-specific skills shipped by Laravel via `laravel/boost` (Laravel apps only).

`withAllowedVendors()` gates Composer-scanned vendors (source 2) only. `withTags()` filters sources 2, 3, and 4 (Composer vendors, remote skills, `laravel/boost` bundle). Host `.ai/skills/` (source 1) bypasses **both** gates — your project authored those skills, so the engine treats them as canonical and applies neither filter.

## The boost family

If you adopt `sandermuller/boost-skills` (or any Composer-distributed catalog), pair it with the sync engine that matches your role:

- [`sandermuller/package-boost-php`](https://github.com/sandermuller/package-boost-php) if you write framework-agnostic Composer packages
- [`sandermuller/package-boost-laravel`](https://github.com/sandermuller/package-boost-laravel) if you write Laravel packages
- [`sandermuller/project-boost-php`](https://github.com/sandermuller/project-boost-php) if you build a PHP application
- [`sandermuller/project-boost-laravel`](https://github.com/sandermuller/project-boost-laravel) if you build a Laravel application (coexists with `laravel/boost` — adds nine-agent fanout, tag filter, vendor allowlist, remote skills)

The four `sandermuller/*` packages bundle the [`sandermuller/boost-core`](https://github.com/sandermuller/boost-core) sync engine, so you rarely install `boost-core` yourself. [`laravel/boost`](https://github.com/laravel/boost) (Laravel's own engine, MCP server, and docs API) coexists with `project-boost-laravel` in Laravel apps — the family-package layers the nine-agent fanout and filters on top. If you'd rather skip the family controls and use `laravel/boost` standalone, it reads any Composer-distributed catalog (including this one) just as well; follow its setup for that one. Project-convention slots that `boost-core` would inline still read cleanly under `laravel/boost` — the skills carry visible defaults (see [Project Conventions schema](#project-conventions-schema)), so you get sensible default wording even though `laravel/boost` doesn't resolve the slots. If none of these fit (a non-PHP package, say), install `boost-core` directly.

## Install

If you adopt `sandermuller/boost-skills` as your catalog, install it together with the family package for your engine role. For a framework-agnostic package author, that is `package-boost-php`:

```bash
composer require --dev sandermuller/boost-skills sandermuller/package-boost-php
```

Swap `package-boost-php` for `package-boost-laravel` or `project-boost` to match your role. The steps below use the `boost-core` engine's commands; on `laravel/boost`, follow [its own setup](https://github.com/laravel/boost) instead and ensure `sandermuller/boost-skills` is among the packages it syncs.

`boost-core`, pulled in by the family package, ships an interactive setup command:

```bash
vendor/bin/boost install
```

`boost install` generates a `boost.php` in your project root and lets you pick target agents and allowlisted vendors. Skills sync only from allowlisted vendors, so make sure `sandermuller/boost-skills` is selected. The result looks like:

```php
return BoostConfig::configure()
    ->withAgents([
        Agent::CLAUDE_CODE,
        Agent::COPILOT,
        Agent::CODEX,
    ])
    ->withAllowedVendors([
        'sandermuller/boost-skills',
        'sandermuller/package-boost-php',
    ])
    ->withTags(['php', 'github']);
```

Declare your project's capabilities in `->withTags(...)` — tagged skills and guidelines sync only to projects that opt in. Common starters are `'php'` and `'github'`; see the [Tags](#tags) registry for the full vocabulary. After a sync, `vendor/bin/boost tags` shows which tagged content is currently filtered out vs synced — handy for spotting capabilities you may want to declare.

Then fan the skills out:

```bash
vendor/bin/boost sync
```

Re-sync after edits by running `vendor/bin/boost sync`, or wire the [`BoostAutoSync` callback](https://github.com/sandermuller/boost-core#auto-sync-on-composer-install) into your `composer.json`'s `post-install-cmd` / `post-update-cmd` to re-sync automatically on every `composer install` / `composer update`. The generated agent directories (`.claude/skills/`, `.github/skills/`, and the rest) stay out of version control; `boost-core` manages that `.gitignore` block.

## Skills

| Skill                  | What it does                                                                                         | Tags            |
|------------------------|------------------------------------------------------------------------------------------------------|-----------------|
| `ai-guidelines`        | Create and maintain AI skills and guideline files (`.ai/`, `CLAUDE.md`, `AGENTS.md`).                | —               |
| `autoresearch`         | Autonomous performance loop: benchmark, change code, then keep or revert by measured result.         | `php`           |
| `backend-quality`      | Two-tier PHP quality gate: Pint + related tests on every change, PHPStan + full suite on completion. | `php`           |
| `bug-fixing`           | Test-driven bug workflow: reproduce with a failing test, then fix it.                                | —               |
| `code-review`          | Review recent changes across functionality, code quality, security, and tests.                      | —               |
| `codex-review`         | Request an independent review from the OpenAI Codex CLI, apply the warranted fixes, re-review until clean. | —               |
| `deploying-laravel-cloud` | Deploy and manage Laravel apps on Laravel Cloud via the `cloud` CLI — environments, databases, domains, billing. | `laravel-cloud` `hosting` |
| `eloquent-models`      | Create and maintain Eloquent models with column/relation constants, comprehensive docblocks, and FK constants. | `laravel`       |
| `evaluate`             | Self-review a full implementation and fix the issues it surfaces.                                    | —               |
| `final-verification-review` | Closeout verdict: run the full evaluate loop, dry-run the closeout preflight (PR flow *or* no-PR commit/release), report READY / NOT READY. | `github`        |
| `frontend-quality`     | Frontend quality gate: type-checking and linting for the project's frontend toolchain.               | `frontend`      |
| `github-issue-updates` | Append a user-facing description and QA testables to a GitHub issue after a feature ships.           | `github-issues` |
| `humanizer`            | Remove signs of AI-generated writing so text reads as natural and human.                             | —               |
| `implement-spec`       | Implement a specification file phase by phase with progress tracking.                                | —               |
| `interview`            | Adversarially grill out a complex feature's requirements — code-first, assumptions-audited — before writing its spec. | —               |
| `jira-create`          | Create a Jira issue with a well-formed, user-facing description.                                     | `jira`          |
| `jira-rework`          | Research a Jira issue sent back for rework, then propose fix options.                                | `jira` `github` |
| `jira-updates`         | Update a Jira issue after its PR is created; post Blocked-by-Question comments.                      | `jira` `github` |
| `pr-review-feedback`   | Apply PR review comments, evaluating each critically before acting.                                  | `github`        |
| `pre-release`          | Pre-push gauntlet: Rector, Pint, full test suite, PHPStan, and a doc-staleness audit.                | `php` `github`  |
| `pull-requests`        | Create and manage your own GitHub PRs via `gh`: write the description, verify, route by risk.        | `github`        |
| `readme`               | Author and maintain a high-quality README for a Composer package — stub vs comprehensive shape, voice, staleness audit. | `release-automation` |
| `release-notes`        | Draft GitHub release bodies for Composer packages — structure, voice, breaking-change callouts, what to omit. | `release-automation` |
| `resolve-conflicts`    | Resolve git merge conflicts without dropping functionality from either side.                         | —               |
| `test-writing`         | Write specific, descriptively named tests that follow Arrange-Act-Assert.                            | —               |
| `upgrading`            | Canonical structure for UPGRADING.md in a Composer package — when to maintain one, what to put in it. | `release-automation` |
| `ux-review`            | Weigh UX/UI options for a new feature, recommend an approach, and document the decision.             | —               |
| `write-spec`           | Write implementation-ready specification files with progress-trackable phases.                       | —               |

## Tags

Most skills and guidelines are universal — they sync to every project. Some carry **capability tags** naming what the project needs (or has opted in to) for the content to be useful. A project declares its capabilities in `boost.php` via `->withTags(...)`, and only matching content syncs.

The tag **mechanism** (subset-AND match, `withTags()` declaration in `boost.php`, `metadata.boost-tags` in skill frontmatter, the `.boost-tags.yaml` sidecar manifest for guidelines) is family-canonical — defined by `boost-core` and applies to any Composer-distributed catalog. The tag **vocabulary** below is one catalog's choice — Sander's mix of capabilities surfaced by skills and guidelines `boost-skills` ships. Other catalogs may organize differently. **Owner** names which boost-family package ships the content using each tag.

`boost-core` ships a broader `Tag` enum (`SanderMuller\BoostCore\Enums\Tag`) with cases not bound to any skill in this catalog — `Tag::Filament`, `Tag::Livewire`, `Tag::Volt`, `Tag::Inertia`, `Tag::Flux`, `Tag::Pest`, `Tag::Tailwind`, and others. These are forward-compatible slots in the family vocabulary. Declaring them in your `withTags(...)` is harmless today (no shipped skill targets them yet) and survives `boost install` picker re-runs per `boost-core`'s declared-but-undiscovered preservation rule. The table below covers only the tags `boost-skills` itself currently ships content under; see `Tag::*` in `boost-core` for the full enum vocabulary.

| Tag                  | Meaning                                                     | Owner               |
|----------------------|-------------------------------------------------------------|---------------------|
| `boost-extension`    | opt-in — extending boost-core (custom skills + FileEmitters) | `package-boost-php` |
| `database`           | project has a database                                      | `boost-skills`      |
| `frontend`           | frontend toolchain — type-checking, linting                 | `boost-skills`      |
| `github`             | hosted on GitHub                                            | `boost-skills`      |
| `github-issues`      | issue tracking in GitHub Issues                             | `boost-skills`      |
| `hosting`            | project deploys to a hosted platform (parent of platform-specific tags) | `boost-skills` |
| `jira`               | issue tracking in Jira                                      | `boost-skills`      |
| `laravel`            | project uses the Laravel framework (Eloquent, service providers, etc.) | `boost-skills` |
| `laravel-cloud`      | app deploys to Laravel Cloud (pair with `hosting`)          | `boost-skills`      |
| `php`                | PHP toolchain — Pint, PHPStan, Rector                       | `boost-skills`      |
| `release-automation` | opt-in — release flow content: README authoring, release notes, UPGRADING, CI changelog automation | `boost-skills`, `package-boost-php` |
| `single-issue-scope` | opt-in — enforce single-issue PR/branch/session discipline  | `boost-skills`      |

**`github` and `github-issues` are independent.** `github` covers any GitHub-hosted repo (used by PR and release skills); `github-issues` is the narrower tag for projects that track issues in GitHub Issues specifically. A repo hosted on GitHub but tracking issues in Jira declares `github` but not `github-issues`. Both are independently declarable in `->withTags(...)`.

A skill or guideline can carry more than one tag, and then applies only where the project declares *all* of them — `jira-rework` is `jira` + `github`. Skill tags live inline in the skill's `SKILL.md` frontmatter (`metadata.boost-tags`); guideline tags live in a sidecar `.boost-tags.yaml` manifest (guidelines stay frontmatter-free for `laravel/boost` compatibility). Filtering needs `boost-core` 0.5+ for skills and 0.6+ for the guideline manifest; on older versions or under `laravel/boost`, the tags are inert and everything in this package syncs.

## Project Conventions schema

Some vendor skills in this catalog reference project-specific values — Jira project key, GitHub owner / repo, branch-naming patterns, PR title format, test framework, codex invocation mode, MCP server-name mappings. Rather than baking those values into vendor skill bodies (which would force every consumer to shadow the skill to override the embedded value), `boost-skills 1.7.0+` ships a **JSONSchema vocabulary** at `resources/boost/conventions-schema.json` that names the slots. Consumers declare values in `boost.php` via `->withConventions([...])`; `boost sync` inlines each slot value directly into the skill bodies at sync time (2.0+; the `1.7`–`1.9` line instead rendered a `## Project Conventions` block that skills read at agent runtime).

**Requires** `sandermuller/boost-core ^1.2.1`. Slot-aware skills carry **paired visible-default tokens** — `<!--boost:conv path="…" mode="…"-->default words<!--boost:conv:end-->` — which `boost-core` resolves at sync time, replacing the whole span with the configured value (or the schema default, or the visible default as fallback). The visible default is what makes the catalog usable under **any** engine: one that doesn't resolve `boost:conv` — notably `laravel/boost`, which installs `SKILL.md` and preserves the markers verbatim — leaves the default *value* sitting in the text as readable content (`Write tests in …Pest…`), rather than trapped inside a comment `fallback=` attribute where the prior bare-token form hid it. The surrounding `<!--boost:conv …-->` / `<!--boost:conv:end-->` markers stay as inert noise the agent reads past; in `mode="yaml"` fenced blocks they show inside the code fence, so the default value is still present, just wrapped. The paired form was added in `boost-core 1.2.1` (the `1.2.0` tag shipped without it and is skipped); an older engine would emit both the resolved value and the visible default, hence the `^1.2.1` floor. (Earlier the catalog used bare `<!--boost:conv … fallback="…"-->` tokens — resolver since `0.15.0`, `mcp.*` sub-keys since `0.16.0` — whose fallback lived inside the comment and so vanished under `laravel/boost`; the paired form is the cross-engine fix.)

Skill bodies inline slots via paired `<!--boost:conv path="jira.project_key" mode="inline"-->default<!--boost:conv:end-->` tokens, resolved at sync time; the `boost slots` command lists the same slots in dotted form (`jira.project_key`). The `path=` and dotted forms name the same slot.

Declare conventions in `boost.php`:

```php
return BoostConfig::configure()
    ->withAgents([Agent::CLAUDE_CODE, Agent::COPILOT, Agent::CODEX])
    ->withAllowedVendors(['sandermuller/boost-skills', /* ... */])
    ->withTags([Tag::Php, Tag::Github, Tag::Laravel])
    ->withConventions([
        'schema-version' => 1,
        'jira' => [
            'project_key' => 'HPB',
        ],
        'github' => [
            'owner' => 'my-org',
            'repo' => 'my-app',
        ],
        // … other slot groups consumer needs …
    ]);
```

`boost sync` renders the array into a marker-bounded YAML block under `## Project Conventions` in `CLAUDE.md` (agent-read surface). `boost.php` is the single source of truth; edit there, run `boost sync`, the rendered block updates automatically.

### Slot taxonomy

Two patterns:

- **Value slots** — scalar / array / path values. Vendor skill reads and uses directly. Example: `jira.project_key` is a string; vendor `jira-create` substitutes it into mutation calls.
- **Policy slots** — typed-object arrays with a `type:` discriminator. Vendor dispatches on the discriminator. Example: `pr.gates` is a list of typed gates (`skill_invoked` / `shell_command` / `mcp_tool`); vendor `pull-requests` enforces each in declared order.

Missing-slot behavior is per-slot: value slots prompt the user once per session; policy slots are skipped silently (no enforcement) when absent.

### Slot groups (v1)

| Group | Purpose | Used by skills |
|---|---|---|
| `jira` | Jira issue tracker — project key, refuse-other-projects policy, description-format doc | `jira-create`, `jira-rework`, `jira-updates` |
| `github` | GitHub repo identity — owner, repo, default base branch | `pull-requests`, `pr-review-feedback`, `github-issue-updates` |
| `branches` | Branch-name patterns + per-pattern base resolution (typed-object array) | `pull-requests` |
| `pr` | PR conventions — title format, template path, pre-PR gates, risk-tier routing (`pr.risk`) | `pull-requests`, `final-verification-review` |
| `testing` | Test framework conventions — `phpunit` / `pest`, forbid list | `bug-fixing`, `test-writing`, `backend-quality` |
| `quality` | Automated code-quality tooling (optional) — `rector` opt-in (Rector before Pint at completion / PR preflight) | `backend-quality`, `pull-requests` |
| `codex` | Codex invocation — `plugin` (default) / `bare_cli`, setup doc | `codex-review` |
| `spec` | Spec-file conventions — filename pattern, research docs | `write-spec`, `implement-spec`, `interview` |
| `mcp` | Project-specific MCP server-name mappings (open vocabulary) | `jira-*`, `pull-requests` (when MCP-mediated) |
| `translations` | DB-driven translation-key validation (optional; DB-stored keys only) — per-consumer key pattern + file-based exemptions | `evaluate` |
| `fixtures` | Test-fixture / code-sample anonymization gate (optional) — guideline pointer, scan scope (`src/` + `tests/`), optional denylist | `evaluate` |
| `review` | PR review-feedback conventions (optional) — extra bot-reviewer logins + colleague-gate on/off toggle | `pr-review-feedback` |

All 12 groups are root-optional — only `schema-version: 1` is root-required. A consumer without (say) a Jira tracker simply doesn't declare the `jira` group; no scaffold noise, no forced placeholder. Inside each declared group, leaves with `required` semantics must be present (e.g. `jira.project_key` is required if `jira` is declared at all). The full machine-readable contract lives in [`resources/boost/conventions-schema.json`](resources/boost/conventions-schema.json).

### Tooling

| Command | What it does |
|---|---|
| `vendor/bin/boost validate` | Validates the `->withConventions([...])` declaration in `boost.php` against allowlisted vendors' schemas. Surfaces missing-required, unknown-slot, schema-version mismatches as `SyncResult::diagnostics`. |
| `vendor/bin/boost slots [--vendor=X] [--missing] [--filled] [--json]` | Lists declared slots across allowlisted vendors; flags filter to missing / filled subsets. |
| `vendor/bin/boost doctor --check-conventions` | Adds conventions-validation to the existing doctor report. |
| `vendor/bin/boost convert-conventions` | One-time migration: extracts a `1.7.x`-era hand-edited YAML block from `CLAUDE.md` and writes it into `boost.php`'s `->withConventions([...])` array. See [Migrating from 1.7.x](#migrating-from-17x). |
| `vendor/bin/boost paths --managed` | Lists agent-managed paths (for vendor skills resolving `since_last_code_change` window semantics in `pr.gates`). |

### Schema-versioning

Vendor skills declare `metadata.schema-required` in their frontmatter — a Composer-style semver range naming which `schema-version` they consume. boost-skills' v1 vocabulary is `schema-version: 1`; current slot-aware skills (`jira-create`, `pull-requests`) declare `schema-required: ^1`. A future v2 schema is published via a vendor minor bump; consumers update their host `schema-version` declaration when their full vendor lineup supports it. Skills with mismatched `schema-required` skip-write with a warning; no broken syncs.

### Vendor schema vs catalog vocabulary

The mechanism (JSONSchema validation, `->withConventions([...])` builder method, `boost-core` engine surface) is family-canonical — defined by `boost-core` and applies to any vendor catalog. The slot vocabulary above is THIS catalog's choice; other Composer-distributed catalogs can ship their own schemas at `resources/boost/conventions-schema.json` and contribute to the host's combined slot vocabulary (subject to the engine's collision-handling rules: first-allowlisted wins on same-type, throws on type-mismatch).

### Migrating from 1.7.x

If you adopted `boost-skills 1.7.0` / `1.7.1` / `1.7.2`, your `## Project Conventions` block lived as a hand-edited YAML region inside `CLAUDE.md` (the `boost-core 0.8.x` shape). Under `boost-core 0.9.0`+, `boost.php` becomes the single source of truth; the YAML block in `CLAUDE.md` is regenerated from `boost.php` at every sync.

One-command migration:

```bash
vendor/bin/boost convert-conventions
```

This reads the existing YAML block from `CLAUDE.md`, decodes it, and writes the values into `boost.php`'s `->withConventions([...])` array (or appends the method to the existing builder chain if absent). After conversion, `boost sync` rerenders the block from the new source. CLAUDE.md remains tracked in git; no `git rm --cached` step is needed (the `0.8.3` tracking decision carries through 0.9.0).

If `boost.php` already declares `->withConventions([...])` and the CLAUDE.md block also has non-empty content that differs, `convert-conventions` fails closed and asks the operator to reconcile manually — never silently destroys either source. After reconciliation, re-run.

## Guidelines

Alongside skills, the package ships **guidelines** under `resources/boost/guidelines/` — short Markdown files of project-wide conventions that the sync engine folds into `CLAUDE.md` / `AGENTS.md`. Unlike skills, guidelines are always active — no on-demand activation.

Guidelines can be tagged, like skills, so one ships only to projects with the matching capability. But a guideline file stays frontmatter-free (for `laravel/boost` compatibility — it has no guideline frontmatter parser), so the tags live in a sidecar `resources/boost/guidelines/.boost-tags.yaml` manifest instead. `boost-core` 0.6.0+ reads it; on older `boost-core` and under `laravel/boost` the manifest is inert and every guideline ships.

| Guideline                        | What it covers                                                                          | Tags       |
|-----------------------------------|------------------------------------------------------------------------------------------|------------|
| `database-safety`                 | Never run destructive database commands; treat the test database as test-runner-owned.   | `database` |
| `javascript`                      | JS/TS control-structure style — always use curly braces, no single-line conditionals.    | `frontend` |
| `migrations`                      | Self-contained migration files; append columns instead of positioning them mid-table.    | `database` |
| `phpstan-fixing`                  | Fixing a PHPStan error — write a failing test first when it maps to a runtime bug.       | `php`      |
| `single-issue-scope`              | Keep each session, branch, and PR focused on exactly one issue.                          | `single-issue-scope` (opt-in) |
| `verification-before-completion`  | Run the verification command and read its output before claiming work is done.           | —          |

## Editing skills and guidelines

Each skill is a Markdown file at `resources/boost/skills/<name>/SKILL.md` with YAML frontmatter — `name` and `description`, plus optional `metadata` (a skill's `boost-tags` live here) and `argument-hint`. Guidelines are plain Markdown at `resources/boost/guidelines/<name>.md` with **no** frontmatter — they must start directly at a heading, so they render correctly under both `boost-core` and `laravel/boost`. Edit both here in this repository, not in a consuming project's synced copy, which `boost-core` overwrites on the next sync. The `ai-guidelines` skill documents the frontmatter contract and authoring conventions.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Security

Found a vulnerability? Email `github@scode.nl` rather than opening a public issue. See [`SECURITY.md`](SECURITY.md) for the disclosure policy.

## Credits

- [Sander Muller](https://github.com/sandermuller)

## License

MIT. See [`LICENSE`](LICENSE).
