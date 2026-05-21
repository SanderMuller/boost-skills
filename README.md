# boost-skills

> Generic AI agent skills for PHP projects and Composer packages. Authored once here, synced to every AI agent by the [boost family](#the-boost-family).

[![Latest Version on Packagist](https://img.shields.io/packagist/v/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![Total Downloads](https://img.shields.io/packagist/dt/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![License](https://img.shields.io/packagist/l/sandermuller/boost-skills.svg?style=flat-square)](LICENSE)

`boost-skills` is a skill-bearing package. It ships AI agent skills under `resources/boost/skills/` — code review, bug fixing, spec-driven implementation, release checklists, Jira workflows, and more — plus always-on [guidelines](#guidelines) under `resources/boost/guidelines/`. Most apply to any project; some skills are tagged for a specific capability — see [Skill tags](#skill-tags).

The package carries no runtime code; it's pure Markdown. A sync engine reads these skills and writes them into each AI agent directory you've configured (Claude Code, Cursor, Copilot, Codex, Gemini, and the rest) on every `composer install` or `composer update`. You get that engine through a boost family package.

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
composer boost:install
```

`boost:install` generates a `boost.php` in your project root and lets you pick target agents and allowlisted vendors. Skills sync only from allowlisted vendors, so make sure `sandermuller/boost-skills` is selected. The result looks like:

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
    ]);
```

Then fan the skills out:

```bash
composer boost:sync
```

After that, every `composer install` or `composer update` re-syncs automatically. The generated agent directories (`.claude/skills/`, `.github/skills/`, and the rest) stay out of version control; `boost-core` manages that `.gitignore` block.

## Skills

| Skill                | What it does                                                                                         | Tags            |
|----------------------|------------------------------------------------------------------------------------------------------|-----------------|
| `ai-guidelines`      | Create and maintain AI skills and guideline files (`.ai/`, `CLAUDE.md`, `AGENTS.md`).                | —               |
| `autoresearch`       | Autonomous performance loop: benchmark, change code, then keep or revert by measured result.         | `php`           |
| `backend-quality`    | Two-tier PHP quality gate: Pint + related tests on every change, PHPStan + full suite on completion. | `php`           |
| `bug-fixing`         | Test-driven bug workflow: reproduce with a failing test, then fix it.                                | —               |
| `code-review`        | Review recent changes across functionality, code quality, security, and tests.                      | —               |
| `codex-review`       | Request an independent review from the OpenAI Codex CLI, then apply the warranted fixes.             | —               |
| `evaluate`           | Self-review a full implementation and fix the issues it surfaces.                                    | —               |
| `frontend-quality`   | Frontend quality gate: type-checking and linting for the project's frontend toolchain.               | `frontend`      |
| `implement-spec`     | Implement a specification file phase by phase with progress tracking.                                | —               |
| `interview`          | Structured Q&A to gather a complex feature's requirements before writing its spec.                   | —               |
| `jira-create`        | Create a Jira issue with a well-formed, user-facing description.                                     | `jira`          |
| `jira-rework`        | Research a Jira issue sent back for rework, then propose fix options.                                | `jira` `github` |
| `jira-updates`       | Update a Jira issue after its PR is created; post Blocked-by-Question comments.                      | `jira` `github` |
| `pr-review-feedback` | Apply PR review comments, evaluating each critically before acting.                                  | `github`        |
| `pre-release`        | Pre-push gauntlet: Rector, Pint, full test suite, PHPStan, and a doc-staleness audit.                | `php` `github`  |
| `pull-requests`      | Create and manage your own GitHub PRs via `gh`: write the description, verify, route by risk.        | `github`        |
| `resolve-conflicts`  | Resolve git merge conflicts without dropping functionality from either side.                         | —               |
| `test-writing`       | Write specific, descriptively named tests that follow Arrange-Act-Assert.                            | —               |
| `ux-review`          | Weigh UX/UI options for a new feature, recommend an approach, and document the decision.             | —               |
| `write-spec`         | Write implementation-ready specification files with progress-trackable phases.                       | —               |

## Skill tags

Most skills are universal — they sync to every project. Several declare `boost-tags` in their `SKILL.md` frontmatter `metadata`, naming a capability the project needs for the skill to be useful:

| Tag        | Meaning                                      |
|------------|----------------------------------------------|
| `php`      | PHP toolchain — Pint, PHPStan, Rector        |
| `frontend` | frontend toolchain — type-checking, linting  |
| `github`   | hosted on GitHub                             |
| `jira`     | issue tracking in Jira                       |

A skill can carry more than one tag, and then applies only where the project has *all* of them — `jira-rework` is `jira` + `github`. A boost-core version with tag filtering uses these tags to sync a tagged skill only to projects that opt into the matching capabilities, so a project is never offered skills for tools it doesn't use. With earlier boost-core versions the tags are inert and every skill syncs.

## Guidelines

Alongside skills, the package ships **guidelines** under `resources/boost/guidelines/` — short Markdown files of project-wide conventions that the sync engine folds into `CLAUDE.md` / `AGENTS.md`. Unlike skills, guidelines are always active (no on-demand activation) and currently always sync (no tag filtering).

| Guideline                        | What it covers                                                                         |
|-----------------------------------|-----------------------------------------------------------------------------------------|
| `database-safety`                 | Never run destructive database commands; treat the test database as test-runner-owned.  |
| `migrations`                      | Self-contained migration files; append columns instead of positioning them mid-table.   |
| `verification-before-completion`  | Run the verification command and read its output before claiming work is done.          |

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
