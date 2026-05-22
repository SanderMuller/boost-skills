# Changelog

All notable changes to `sandermuller/boost-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
