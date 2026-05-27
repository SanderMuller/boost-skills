# boost-skills

> AI agent skills for PHP projects and Composer packages. Authored once here, synced to every AI agent by the [boost family](#the-boost-family).

[![Latest Version on Packagist](https://img.shields.io/packagist/v/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![Total Downloads](https://img.shields.io/packagist/dt/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![License](https://img.shields.io/packagist/l/sandermuller/boost-skills.svg?style=flat-square)](LICENSE)
[![Laravel Boost](https://badge.laravel.cloud/boost-badge.svg?style=flat-square)](https://github.com/laravel/boost)

`boost-skills` is a skill-bearing package. It ships AI agent skills under `resources/boost/skills/` — code review, bug fixing, spec-driven implementation, release checklists, Jira workflows, deployment, and more — plus always-on [guidelines](#guidelines) under `resources/boost/guidelines/`. Most apply to any project; some are tagged for a specific capability — see [Tags](#tags).

The package carries no runtime code; it's pure Markdown. A sync engine reads these skills and guidelines and writes them into each AI agent directory you've configured (Claude Code, Cursor, Copilot, Codex, Gemini, and the rest). You get that engine through a boost family package.

## The boost family

`boost-skills` ships the skills but does not sync them. Pair it with the package that matches your role:

- [`sandermuller/package-boost-php`](https://github.com/sandermuller/package-boost-php) if you write framework-agnostic Composer packages
- [`sandermuller/package-boost-laravel`](https://github.com/sandermuller/package-boost-laravel) if you write Laravel packages
- [`sandermuller/project-boost`](https://github.com/sandermuller/project-boost) if you build a PHP application
- [`laravel/boost`](https://github.com/laravel/boost) if you build a Laravel application

The three `sandermuller/*` packages bundle the [`sandermuller/boost-core`](https://github.com/sandermuller/boost-core) sync engine, so you rarely install `boost-core` yourself. `laravel/boost` is Laravel's own engine and reads `boost-skills` just as well; follow its setup for that one. If none of these fit (a non-PHP package, say), install `boost-core` directly.

## Install

Install `boost-skills` together with the family package for your role. For a framework-agnostic package author, that is `package-boost-php`:

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
    ->withTags('php', 'github');
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
| `codex-review`         | Request an independent review from the OpenAI Codex CLI, then apply the warranted fixes.             | —               |
| `deploying-laravel-cloud` | Deploy and manage Laravel apps on Laravel Cloud via the `cloud` CLI — environments, databases, domains, billing. | `laravel-cloud` `hosting` |
| `eloquent-models`      | Create and maintain Eloquent models with column/relation constants, comprehensive docblocks, and FK constants. | `laravel`       |
| `evaluate`             | Self-review a full implementation and fix the issues it surfaces.                                    | —               |
| `frontend-quality`     | Frontend quality gate: type-checking and linting for the project's frontend toolchain.               | `frontend`      |
| `github-issue-updates` | Append a user-facing description and QA testables to a GitHub issue after a feature ships.           | `github-issues` |
| `humanizer`            | Remove signs of AI-generated writing so text reads as natural and human.                             | —               |
| `implement-spec`       | Implement a specification file phase by phase with progress tracking.                                | —               |
| `interview`            | Structured Q&A to gather a complex feature's requirements before writing its spec.                   | —               |
| `jira-create`          | Create a Jira issue with a well-formed, user-facing description.                                     | `jira`          |
| `jira-rework`          | Research a Jira issue sent back for rework, then propose fix options.                                | `jira` `github` |
| `jira-updates`         | Update a Jira issue after its PR is created; post Blocked-by-Question comments.                      | `jira` `github` |
| `pr-review-feedback`   | Apply PR review comments, evaluating each critically before acting.                                  | `github`        |
| `pre-release`          | Pre-push gauntlet: Rector, Pint, full test suite, PHPStan, and a doc-staleness audit.                | `php` `github`  |
| `pull-requests`        | Create and manage your own GitHub PRs via `gh`: write the description, verify, route by risk.        | `github`        |
| `resolve-conflicts`    | Resolve git merge conflicts without dropping functionality from either side.                         | —               |
| `test-writing`         | Write specific, descriptively named tests that follow Arrange-Act-Assert.                            | —               |
| `ux-review`            | Weigh UX/UI options for a new feature, recommend an approach, and document the decision.             | —               |
| `write-spec`           | Write implementation-ready specification files with progress-trackable phases.                       | —               |

## Tags

Most skills and guidelines are universal — they sync to every project. Some carry **capability tags** naming what the project needs (or has opted in to) for the content to be useful. A project declares its capabilities in `boost.php` via `->withTags(...)`, and only matching content syncs. The table below is the family-wide registry of tag values; **Owner** names the boost-family package that ships the content using each tag.

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
| `release-automation` | opt-in — CI release-automation convention                   | `package-boost-php` |
| `single-issue-scope` | opt-in — enforce single-issue PR/branch/session discipline  | `boost-skills`      |

**`github` and `github-issues` are independent.** `github` covers any GitHub-hosted repo (used by PR and release skills); `github-issues` is the narrower tag for projects that track issues in GitHub Issues specifically. A repo hosted on GitHub but tracking issues in Jira declares `github` but not `github-issues`. Both are independently declarable in `->withTags(...)`.

A skill or guideline can carry more than one tag, and then applies only where the project declares *all* of them — `jira-rework` is `jira` + `github`. Skill tags live inline in the skill's `SKILL.md` frontmatter (`metadata.boost-tags`); guideline tags live in a sidecar `.boost-tags.yaml` manifest (guidelines stay frontmatter-free for `laravel/boost` compatibility). Filtering needs `boost-core` 0.5+ for skills and 0.6+ for the guideline manifest; on older versions or under `laravel/boost`, the tags are inert and everything in this package syncs.

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
