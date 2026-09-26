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

### In every project

To use some skills outside a project, install the catalog globally and list the skills you want in `~/.boost/user-scope.php` (needs `boost-core` >= 1.13.0):

```bash
composer global require sandermuller/boost-skills
```

```php
<?php

return [
    'skills' => [
        'sandermuller/boost-skills' => ['interview', 'promptimize', 'write-spec'],
    ],
];
```

```bash
boost sync --scope=user --all
```

Each skill is published with a `-user` suffix, for example `/interview-user`, so it never hides a project's own copy. A listed skill also brings the skills it names in `boost-requires`. A package with no entry publishes every skill. User scope has no `boost.php`, so tags do not apply and conventions slots show their defaults. See [Choose user-scope skills](https://sandermuller.github.io/boost-core/guide/automating-sync#choose-user-scope-skills).

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

CI checks this inventory against the shipped skills and their tags. The [skill catalog](https://sandermuller.github.io/boost-core/packages/boost-skills/catalog) page renders the same list.

<details>
<summary>36 skills — click to expand the inventory</summary>

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
| `deploying-laravel-cloud` | Deploy and manage Laravel apps on Laravel Cloud via the `cloud` CLI — environments, databases, domains, billing. | `laravel-cloud` `hosting` |
| `eloquent-models`      | Create and maintain Eloquent models with column/relation constants, comprehensive docblocks, and FK constants. | `laravel`       |
| `evaluate`             | Self-review a full implementation and fix the issues it surfaces.                                    | —               |
| `eye-verification`     | Command-only (`/eye-verification`): mandatory browser pass over a frontend change — resolve the testables, drive each one, publish the proof screenshots. | `frontend`      |
| `final-verification-review` | Closeout verdict: run the full evaluate loop, dry-run the closeout preflight (PR flow *or* no-PR commit/release), report READY / NOT READY. | `github`        |
| `frontend-quality`     | Frontend quality gate: type-checking, linting, and the JS test suite; browser eye-verify for UI changes, with a shipped harness. | `frontend`      |
| `github-issue-updates` | Append a user-facing description and QA testables to a GitHub issue after a feature ships.           | `github-issues` |
| `humanizer`            | Remove signs of AI-generated writing from prose a person reads — never from agent-to-agent text.      | —               |
| `implement-spec`       | Implement a specification file phase by phase with progress tracking.                                | —               |
| `interview`            | Adversarially grill out a complex feature's requirements — code-first, assumptions-audited — before writing its spec. | —               |
| `jira-create`          | Create a Jira issue with a well-formed, user-facing description.                                     | `jira`          |
| `jira-rework`          | Research a Jira issue sent back for rework, then propose fix options.                                | `jira` `github` |
| `jira-updates`         | Update a Jira issue after its PR is created; post Blocked-by-Question comments.                      | `jira`          |
| `migration-squash`     | Create or review a Laravel migration squash safely — pre-flight the dump, then a checklist catching incomplete, contaminated, or data-losing baselines. | `laravel`       |
| `php-generics`         | Docblock generics and shapes: name a repeated `array{...}`, bind a generic base, type a class name.  | `php`           |
| `pr-review-feedback`   | Apply PR review comments, evaluating each critically before acting.                                  | `github`        |
| `pre-release`          | Pre-push gauntlet: Rector, Pint, full test suite, PHPStan, and a doc-staleness audit (README, docs site, `.ai/`). | `php` `github` `release-automation` |
| `promptimize`          | Turn a rough prompt into one optimized, model-agnostic prompt — close gaps, fact-check against the codebase, rewrite, return only the prompt. | —               |
| `pull-requests`        | Create and manage your own GitHub PRs via `gh`: write the description, verify, route by risk.        | `github`        |
| `readme`               | Author and maintain a concise README for a Composer package — stub, comprehensive, or docs-site shape, a problem-first opening, length budgets, curated coverage, voice, staleness/verbosity + docs index/link audits. | `release-automation` |
| `release-notes`        | Draft GitHub release bodies for Composer packages — structure, length budget, voice, breaking-change callouts, what to omit. | `release-automation` |
| `resolve-conflicts`    | Resolve git merge conflicts without dropping functionality from either side.                         | —               |
| `simplify-shape`       | Judge whether a change carries its values in the right type: enum, form request, DTO, query-builder method. | `php`           |
| `test-value`          | Judge the tests a change touched: delete what proves nothing, cover what nothing tests.               | —               |
| `test-writing`         | Write specific, descriptively named tests that follow Arrange-Act-Assert.                            | —               |
| `upgrading`            | Canonical structure for UPGRADING.md in a Composer package — when to maintain one, what to put in it. | `release-automation` |
| `ux-review`            | Weigh UX/UI options for a new feature, recommend an approach, and document the decision.             | —               |
| `write-spec`           | Write implementation-ready specification files with progress-trackable phases.                       | —               |

</details>

## Tags

Most content is universal. The rest carries **capability tags** — a project declares what it has in `boost.php` via `->withTags(...)`, and only matching content syncs. A skill with two tags needs both. **Owner** is the family package that ships the content using the tag.

`github` and `github-issues` are independent: `github` is any GitHub-hosted repo (PR and release skills), `github-issues` only projects tracking issues there. A GitHub repo using Jira declares `github` alone.

<details>
<summary>14 tags — click to expand</summary>

| Tag                  | Meaning                                                     | Owner               |
|----------------------|-------------------------------------------------------------|---------------------|
| `boost-extension`    | opt-in — extending boost-core (custom skills + FileEmitters) | `package-boost-php` |
| `database`           | project has a database                                      | `boost-skills`      |
| `frontend`           | project has a user-facing UI — templates, styles, JS, or any mix; the JS checks skip what the project lacks | `boost-skills` |
| `github`             | hosted on GitHub                                            | `boost-skills`      |
| `github-issues`      | issue tracking in GitHub Issues                             | `boost-skills`      |
| `hosting`            | project deploys to a hosted platform (parent of platform-specific tags) | `boost-skills` |
| `jira`               | issue tracking in Jira                                      | `boost-skills`      |
| `laravel`            | project uses the Laravel framework (Eloquent, service providers, etc.) | `boost-skills` |
| `laravel-cloud`      | app deploys to Laravel Cloud (pair with `hosting`)          | `boost-skills`      |
| `php`                | PHP toolchain — Pint, PHPStan, Rector                       | `boost-skills`      |
| `release-automation` | opt-in — release flow content: README authoring, release notes, UPGRADING, CI changelog automation | `boost-skills`, `package-boost-php` |
| `sentry`             | errors are tracked in Sentry, reachable through a Sentry MCP server | `boost-skills` |
| `single-issue-scope` | opt-in — enforce single-issue PR/branch/session discipline  | `boost-skills`      |
| `voice`              | opt-in — route every writing surface to one voice rule (ASD-STE100 Simplified Technical English) | `boost-skills`      |

</details>

## Guidelines

Short project-wide conventions, folded into `CLAUDE.md` / `AGENTS.md` and always active. Their tags come from a sidecar `.boost-tags.yaml`, because a guideline file stays frontmatter-free for `laravel/boost`.

A second sidecar, `.boost-user-scope.yaml`, lists the guidelines that hold in any repository. `boost sync --scope=user --all` publishes them outside a project (needs `boost-core` >= 1.10.0). A user-scope guideline must render token-free, because user scope has no `boost.php`.

<details>
<summary>10 guidelines — click to expand</summary>

| Guideline                        | What it covers                                                                          | Tags       |
|-----------------------------------|------------------------------------------------------------------------------------------|------------|
| `ask-user-question`               | Avoid first/second-person pronouns in AskUserQuestion payloads — name the actor instead. | —          |
| `database-safety`                 | Never run destructive database commands; treat the test database as test-runner-owned.   | `database` |
| `javascript`                      | JS/TS control-structure style — always use curly braces, no single-line conditionals.    | `frontend` |
| `migrations`                      | Self-contained migration files; append columns instead of positioning them mid-table.    | `database` |
| `phpstan-fixing`                  | Fixing a PHPStan error — write a failing test first when it maps to a runtime bug.       | `php`      |
| `signed-commits`                  | Never fall back to an unsigned commit when signing is enabled — surface the failure to fix it instead. | —          |
| `single-issue-scope`              | Keep each session, branch, and PR focused on exactly one issue.                          | `single-issue-scope` (opt-in) |
| `task-scope`                      | Keep the change to what the task asks, pick one reading of an ambiguous ask, and edit in place. | —          |
| `verification-before-completion`  | Run the verification command and read its output before claiming work is done, and say what you did not verify. | —          |
| `voice`                           | One voice rule per writing surface — a routing table, the Simplified Technical English rules, and how much to write. | `voice` (opt-in) |

</details>

## Subagents

Claude Code subagents this package ships. Each runs in its own context, so it judges a change as code somebody else wrote. `boost-core` >= 1.9.0 emits them to `.claude/agents/boost/<vendor>__<package>/` and leaves your own files in `.claude/agents/` alone. An older engine and agents without subagents get nothing.

<details>
<summary>12 subagents — click to expand</summary>

| Subagent | What it does | Tags |
|------------------------|------------------------------------------------------------------------------------------------------|-----------------|
| `accessibility-reviewer` | Review interactive markup against WCAG 2.2 AA, citing the exact success criterion for every finding. | `frontend` |
| `comment-analyzer`     | Check every comment a change added, changed or made false against the code, then judge whether it earns its place. | — |
| `database-specialist`  | Judge what a MySQL schema change does in production: the algorithm, the lock, the timeout, and where it must run. | `laravel` `database` |
| `db-inspector`         | Report the real schema, indexes and data through the Laravel Boost database tools, read-only. | `laravel` `database` |
| `github-researcher`    | Mine git and GitHub history for the change, pull request and review behind a line of code. | `github` |
| `performance-reviewer` | Find N+1s, unbounded queries, over-fetching and slow request-path work, with measured cost where it can measure. | `laravel` `database` |
| `sentry-researcher`    | Pull the error signal from Sentry — trace, trend, release — for a bug or a release. | `sentry` |
| `security-reviewer`    | Review authorization, injection and data exposure; every rated finding names attacker, source, sink and missing control. | `laravel` |
| `silent-failure-hunter` | Find swallowed exceptions, masking fallbacks, and failures nobody is told about. | `laravel` |
| `simplification-auditor` | Audit a change for code that does not need to exist, and return a ledger accounting for every unit it added. | —               |
| `tech-lead-reviewer`   | Review the approach one altitude above the line: design size, value types, placement, one-way doors.  | —               |
| `test-coverage-auditor` | Find the untested failure paths and the assertions that pass whatever the code does.                 | —               |

</details>

**Already wrote one yourself?** Claude Code picks a subagent by its frontmatter `name`, so your `.claude/agents/tech-lead-reviewer.md` and the shipped one clash, and read order decides which loads. Delete or rename yours; `boost sync` warns until you do.

## Editing skills and guidelines

Skills are `resources/boost/skills/<name>/SKILL.md` with `name` + `description` frontmatter. Guidelines are `resources/boost/guidelines/<name>.md` with **no** frontmatter — they must open at a heading to render under both engines.

**Edit them here, never in a consuming project's synced copy** — `boost-core` overwrites that on the next sync. The `ai-guidelines` skill carries the frontmatter contract.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Security

Found a vulnerability? Email `github@scode.nl` rather than opening a public issue. See [`SECURITY.md`](SECURITY.md) for the disclosure policy.

### Skill scanners report findings here

Static skill scanners such as [SkillSpector](https://github.com/NVIDIA/skillspector) flag this package. The findings are false positives. Three patterns cause them:

- **HTML comments read as prompt injection.** A `<!--boost:conv …-->` token is a `boost-core` placeholder that the sync resolves, and `<!-- verified-sha: … -->` and `<!-- spec:planned-at … -->` are anchors. A scanner cannot tell them from a hidden instruction.
- **Anti-pattern prose read as an instruction.** A skill that lists "without asking" or "skip verification" as a thing *not* to do matches the same string as a skill that tells an agent to do it.
- **Documented shell commands read as tool misuse.** The `autoresearch` skill prints `git reset --hard HEAD~1` because its loop commits before it measures, so a rejected experiment reverts in one step.

Do not add a scanner baseline file to this repository. A baseline written by the package author suppresses the findings in a consumer's own scan, which is why SkillSpector ignores a discovered baseline until the consumer opts in.

## Credits

- [Sander Muller](https://github.com/sandermuller)

## License

MIT. See [`LICENSE`](LICENSE).
