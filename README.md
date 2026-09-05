# boost-skills

> Sander Muller's personal Composer-distributed catalog of AI agent skills for PHP projects and Composer packages. Adopt it if your preferences align with Sander's, or use it as a template for your own.

[![Latest Version on Packagist](https://img.shields.io/packagist/v/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![Total Downloads](https://img.shields.io/packagist/dt/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![License](https://img.shields.io/packagist/l/sandermuller/boost-skills.svg?style=flat-square)](LICENSE)
[![Laravel Boost](https://badge.laravel.cloud/boost-badge.svg?style=flat-square)](https://github.com/laravel/boost)

No runtime code — pure Markdown. A sync engine ([`sandermuller/boost-core`](https://github.com/sandermuller/boost-core) or [`laravel/boost`](https://github.com/laravel/boost)) reads the [skills](#skills) and always-on [guidelines](#guidelines) below and writes them into every AI agent directory you have configured: Claude Code, Cursor, Copilot, Codex, Gemini, and the rest.

**Documentation: <https://sandermuller.github.io/boost-core/packages/boost-skills/>**

## Install

Install the catalog beside the family package for your role — the [picker](https://sandermuller.github.io/boost-core/guide/which-package) settles which in two questions:

```bash
composer require --dev sandermuller/boost-skills sandermuller/package-boost-php
```

**Then allowlist the vendor — a catalog ships nothing until you name it:**

```php
return BoostConfig::configure()
    ->withAgents([Agent::CLAUDE_CODE, Agent::COPILOT, Agent::CODEX])
    ->withAllowedVendors([
        'sandermuller/boost-skills',
        'sandermuller/package-boost-php',
    ])
    ->withTags(['php', 'github']);
```

```bash
vendor/bin/boost install   # the picker offers this vendor; select it
vendor/bin/boost sync
```

`vendor/bin/boost tags` lists what a further tag would unlock.

Under `laravel/boost` instead, follow [its setup](https://github.com/laravel/boost) and include this package in what it syncs. Tag filtering and Project Conventions slots are inert there; skills carry visible defaults, so a slot still reads sensibly.

## Documentation

| Topic | Page |
|---|---|
| Adopting the catalog, editing a skill | [Overview](https://sandermuller.github.io/boost-core/packages/boost-skills/) |
| The same inventory, rendered | [Skill catalog](https://sandermuller.github.io/boost-core/packages/boost-skills/catalog) |
| Where skills come from, and which gates apply | [Skill sources](https://sandermuller.github.io/boost-core/guide/skill-sources) |
| How tags and `boost-requires` work | [Tags and dependencies](https://sandermuller.github.io/boost-core/guide/tags-and-dependencies) |
| The conventions slot mechanism | [Project Conventions](https://sandermuller.github.io/boost-core/guide/conventions) |
| Shipping scripts beside a skill | [Skill assets](https://sandermuller.github.io/boost-core/guide/skill-assets) |
| Re-syncing on `composer install` | [Automating the sync](https://sandermuller.github.io/boost-core/guide/automating-sync) |

## Skills

The inventory below is the catalog's contract — CI checks it against the shipped skills and their tags, so it stays exact. The same list, rendered, is on the [skill catalog](https://sandermuller.github.io/boost-core/packages/boost-skills/catalog) page.

<details>
<summary>33 skills — click to expand the inventory</summary>

| Skill                  | What it does                                                                                         | Tags            |
|------------------------|------------------------------------------------------------------------------------------------------|-----------------|
| `ai-guidelines`        | Create and maintain AI skills and guideline files (`.ai/`, `CLAUDE.md`, `AGENTS.md`).                | —               |
| `autoresearch`         | Autonomous performance loop: benchmark, change code, then keep or revert by measured result.         | `php`           |
| `backend-quality`      | Two-tier PHP quality gate: Pint + related tests on every change, PHPStan + full suite on completion. | `php`           |
| `bug-fixing`           | Test-driven bug workflow: reproduce with a failing test, then fix it.                                | —               |
| `clarify`              | Turn a fuzzy ask into sharp, fact-checked intent — reduce ambiguity, sharpen terms, surface assumptions. Shared core of `interview` and `promptimize`. | —               |
| `clean-specs`          | Command-only (`/clean-specs`): remove spec files whose work is fully implemented and proven on the base branch, keeping only live work.               | —               |
| `code-review`          | Review recent changes across functionality, code quality, security, and tests.                      | —               |
| `codex-review`         | Request an independent review from the OpenAI Codex CLI, apply the warranted fixes, re-review until clean. | —               |
| `comment-audit`        | Judge the comments a change added — Remove / Replace / Trim, one at a time, default to none.         | —               |
| `deploying-laravel-cloud` | Deploy and manage Laravel apps on Laravel Cloud via the `cloud` CLI — environments, databases, domains, billing. | `laravel-cloud` `hosting` |
| `eloquent-models`      | Create and maintain Eloquent models with column/relation constants, comprehensive docblocks, and FK constants. | `laravel`       |
| `evaluate`             | Self-review a full implementation and fix the issues it surfaces.                                    | —               |
| `eye-verification`     | Command-only (`/eye-verification`): mandatory browser pass over a frontend change — resolve the testables, drive each one, publish the proof screenshots. | `frontend`      |
| `final-verification-review` | Closeout verdict: run the full evaluate loop, dry-run the closeout preflight (PR flow *or* no-PR commit/release), report READY / NOT READY. | `github`        |
| `frontend-quality`     | Frontend quality gate: type-checking, linting, and the JS test suite; browser eye-verify for UI changes, with a shipped harness. | `frontend`      |
| `github-issue-updates` | Append a user-facing description and QA testables to a GitHub issue after a feature ships.           | `github-issues` |
| `humanizer`            | Remove signs of AI-generated writing so text reads as natural and human.                             | —               |
| `implement-spec`       | Implement a specification file phase by phase with progress tracking.                                | —               |
| `interview`            | Adversarially grill out a complex feature's requirements — code-first, assumptions-audited — before writing its spec. | —               |
| `jira-create`          | Create a Jira issue with a well-formed, user-facing description.                                     | `jira`          |
| `jira-rework`          | Research a Jira issue sent back for rework, then propose fix options.                                | `jira` `github` |
| `jira-updates`         | Update a Jira issue after its PR is created; post Blocked-by-Question comments.                      | `jira`          |
| `migration-squash`     | Create or review a Laravel migration squash safely — pre-flight the dump, then a checklist catching incomplete, contaminated, or data-losing baselines. | `laravel`       |
| `pr-review-feedback`   | Apply PR review comments, evaluating each critically before acting.                                  | `github`        |
| `pre-release`          | Pre-push gauntlet: Rector, Pint, full test suite, PHPStan, and a doc-staleness audit (README, docs site, `.ai/`). | `php` `github` `release-automation` |
| `promptimize`          | Turn a rough prompt into one optimized, model-agnostic prompt — close gaps, fact-check against the codebase, rewrite, return only the prompt. | —               |
| `pull-requests`        | Create and manage your own GitHub PRs via `gh`: write the description, verify, route by risk.        | `github`        |
| `readme`               | Author and maintain a concise README for a Composer package — stub, comprehensive, or docs-site shape, a problem-first opening, length budgets, curated coverage, voice, staleness/verbosity + docs index/link audits. | `release-automation` |
| `release-notes`        | Draft GitHub release bodies for Composer packages — structure, length budget, voice, breaking-change callouts, what to omit. | `release-automation` |
| `resolve-conflicts`    | Resolve git merge conflicts without dropping functionality from either side.                         | —               |
| `simplify-code`        | Two passes over a change — cut what is not needed, then shape what remains into the right type.      | —               |
| `test-value`           | Judge a change's tests both ways — delete the ones that prove nothing, name the missing assertions.  | —               |
| `test-writing`         | Write specific, descriptively named tests that follow Arrange-Act-Assert.                            | —               |
| `upgrading`            | Canonical structure for UPGRADING.md in a Composer package — when to maintain one, what to put in it. | `release-automation` |
| `ux-review`            | Weigh UX/UI options for a new feature, recommend an approach, and document the decision.             | —               |
| `write-spec`           | Write implementation-ready specification files with progress-trackable phases.                       | —               |

</details>

## Tags

Most content is universal. The rest carries **capability tags** — a project declares what it has in `boost.php` via `->withTags(...)`, and only matching content syncs. A skill with two tags needs both. **Owner** is the family package that ships the content using the tag.

`github` and `github-issues` are independent: `github` is any GitHub-hosted repo (PR and release skills), `github-issues` only projects tracking issues there. A GitHub repo using Jira declares `github` alone.

| Tag                  | Meaning                                                     | Owner               |
|----------------------|-------------------------------------------------------------|---------------------|
| `boost-extension`    | opt-in — extending boost-core (custom skills + FileEmitters) | `package-boost-php` |
| `database`           | project has a database                                      | `boost-skills`      |
| `frontend`           | frontend toolchain — type-checking, linting, JS tests       | `boost-skills`      |
| `github`             | hosted on GitHub                                            | `boost-skills`      |
| `github-issues`      | issue tracking in GitHub Issues                             | `boost-skills`      |
| `hosting`            | project deploys to a hosted platform (parent of platform-specific tags) | `boost-skills` |
| `jira`               | issue tracking in Jira                                      | `boost-skills`      |
| `laravel`            | project uses the Laravel framework (Eloquent, service providers, etc.) | `boost-skills` |
| `laravel-cloud`      | app deploys to Laravel Cloud (pair with `hosting`)          | `boost-skills`      |
| `php`                | PHP toolchain — Pint, PHPStan, Rector                       | `boost-skills`      |
| `release-automation` | opt-in — release flow content: README authoring, release notes, UPGRADING, CI changelog automation | `boost-skills`, `package-boost-php` |
| `single-issue-scope` | opt-in — enforce single-issue PR/branch/session discipline  | `boost-skills`      |
| `voice`              | opt-in — route every writing surface to one voice rule (ASD-STE100 Simplified Technical English) | `boost-skills`      |

`boost-core` also ships forward-compatible enum cases no skill here targets yet (`Tag::Filament`, `Tag::Livewire`, `Tag::Pest`, and more). Declaring one is harmless and survives picker re-runs; see `Tag::*` in `boost-core`.

## Guidelines

Short Markdown files of project-wide convention, folded into `CLAUDE.md` / `AGENTS.md`. Unlike skills they are always active — no on-demand activation. They are tagged like skills, but from a sidecar `.boost-tags.yaml` manifest, since a guideline file stays frontmatter-free for `laravel/boost` compatibility.

<details>
<summary>9 guidelines — click to expand</summary>

| Guideline                        | What it covers                                                                          | Tags       |
|-----------------------------------|------------------------------------------------------------------------------------------|------------|
| `ask-user-question`               | Avoid first/second-person pronouns in AskUserQuestion payloads — name the actor instead. | —          |
| `database-safety`                 | Never run destructive database commands; treat the test database as test-runner-owned.   | `database` |
| `javascript`                      | JS/TS control-structure style — always use curly braces, no single-line conditionals.    | `frontend` |
| `migrations`                      | Self-contained migration files; append columns instead of positioning them mid-table.    | `database` |
| `phpstan-fixing`                  | Fixing a PHPStan error — write a failing test first when it maps to a runtime bug.       | `php`      |
| `signed-commits`                  | Never fall back to an unsigned commit when signing is enabled — surface the failure to fix it instead. | —          |
| `single-issue-scope`              | Keep each session, branch, and PR focused on exactly one issue.                          | `single-issue-scope` (opt-in) |
| `verification-before-completion`  | Run the verification command and read its output before claiming work is done.           | —          |
| `voice`                           | One voice rule per writing surface — a routing table plus the Simplified Technical English rules. | `voice` (opt-in) |

</details>

## Editing skills and guidelines

Skills are `resources/boost/skills/<name>/SKILL.md` with `name` + `description` frontmatter. Guidelines are `resources/boost/guidelines/<name>.md` with **no** frontmatter — they must open at a heading to render under both engines.

**Edit them here, never in a consuming project's synced copy** — `boost-core` overwrites that on the next sync. The `ai-guidelines` skill carries the frontmatter contract.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Security

Found a vulnerability? Email `github@scode.nl` rather than opening a public issue. See [`SECURITY.md`](SECURITY.md) for the disclosure policy.

## Credits

- [Sander Muller](https://github.com/sandermuller)

## License

MIT. See [`LICENSE`](LICENSE).
