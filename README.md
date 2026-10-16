# boost-skills

> Sander Muller's personal Composer-distributed catalog of AI agent skills for PHP projects and Composer packages. Adopt it if your preferences align with Sander's, or use it as a template for your own.

[![Latest Version on Packagist](https://img.shields.io/packagist/v/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![Total Downloads](https://img.shields.io/packagist/dt/sandermuller/boost-skills.svg?style=flat-square)](https://packagist.org/packages/sandermuller/boost-skills)
[![License](https://img.shields.io/packagist/l/sandermuller/boost-skills.svg?style=flat-square)](LICENSE)
[![Laravel Boost](https://badge.laravel.cloud/boost-badge.svg?style=flat-square)](https://github.com/laravel/boost)

No runtime code — pure Markdown. A sync engine ([`sandermuller/boost-core`](https://github.com/sandermuller/boost-core) or [`laravel/boost`](https://github.com/laravel/boost)) reads the skills and always-on guidelines in the [catalog](#catalog) and writes them into every AI agent directory you have configured: Claude Code, Cursor, Copilot, Codex, Gemini, and the rest.

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

## Catalog

The package ships skills, always-on guidelines and Claude Code subagents. Most content is universal. The rest carries **capability tags**: a project declares what it has in `boost.php` via `->withTags(...)`, and only matching content syncs.

[`CATALOG.md`](CATALOG.md) lists every skill, tag, guideline and subagent, with its tags.

**Already wrote a subagent yourself?** Claude Code picks a subagent by its frontmatter `name`, so a local `.claude/agents/tech-lead-reviewer.md` and the shipped one clash. Delete or rename yours; `boost sync` warns until you do.

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
