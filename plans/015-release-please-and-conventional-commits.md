# Plan 015: Opt-in `conventional-commits` and `release-please` tags

> **Who this is for**: a `boost-skills` peer. §9 lists requests for other family packages. They do
> not block this plan.
>
> **Provenance**: a maintainer request, not an audit finding. The research behind every claim
> here is in `internal/research-release-please.md`: commands, source references and measured
> output.
>
> **Drift check (run first)**:
> - `ls resources/boost/skills | grep -E 'conventional|release-please'` must be empty.
> - `grep -n "rescue\|requires" vendor/sandermuller/boost-core/src/Skills/GuidelineTagFilter.php`
>   must be empty. If guidelines have gained `boost-requires` or tag implication, §3's double tag
>   is no longer necessary. Go to §9.1 first.
> - `gh api "repos/googleapis/release-please-action/contents/package-lock.json?ref=v5" -H "Accept: application/vnd.github.raw" | jq -r '.packages["node_modules/release-please"].version'`
>   must print `17.6.0`. The workflow asset pins the v5.0.0 commit. A later v5 release can bundle
>   another version. Also check that `v5` is still the latest major. On any change, re-run the
>   research harness against the bundled version before execution.

## Status

- **Priority**: P2. This is new, opt-in capability, and no consumer gets it until it declares the tags.
- **Effort**: M. The work is two guidelines, two skills, three asset files, and edits to six
  existing files (§7) plus the README.
- **Risk**: LOW for existing consumers. All new content is behind new tags. The edits to existing
  skills are additive text, or a branch that fires only when `release-please-config.json` exists.
- **Depends on**: nothing.
- **Planned at**: boost-skills `2.49.0`, boost-core `1.13.0`, release-please-action `v5.0.0` (it
  bundles release-please `17.6.0`).
- **Reviewed**: by an independent simplification pass, an architecture pass and a Codex pass before
  execution. Their accepted findings are folded in.
- **Implemented**: 2026-10-09. §8 ran in full: validators, the four tag sets plus exclusion
  controls through `boost sync` (boost-core 1.13.0), 32 title-pattern checks, the inline test
  (pass, and fail with `chore` visible), the shipped config through release-please 17.6.0, and
  actionlint + zizmor on both workflow assets. Not run: an end-to-end release on GitHub (§9.3).

## 1. The ask

A consumer can opt in to Conventional Commits and, on top of that, to release-please. Each opt-in
delivers guidelines and skills. Release-please depends on Conventional Commits. Tags are plain
strings for now. Enum cases in boost-core come later (§9.1).

## 2. Decisions taken before planning

The maintainer accepted these. Do not re-open them during execution.

| # | Decision |
|---|---|
| D1 | Two tags: `conventional-commits` and `release-please`. Each one gets one guideline and one skill. |
| D2 | Tag every release-please unit `"conventional-commits github release-please"`. The CC units stay host-neutral (`"conventional-commits"`). |
| D3 | Resolve the `release-automation` overlap mechanically first. The `release-please` skill's bootstrap adds `'sandermuller/package-boost-php:release-automation'` to the project's `withExcludedGuidelines([...])` list, after the user approves. The method replaces the whole list, so keep the existing entries and add only this key. That method exists since boost-core 0.6.0, and the floor is `^1.4`. The `release-please` guideline carries one precedence sentence as a fallback for a consumer that keeps both guidelines. `pre-release` and `release-notes` detect `release-please-config.json` and step aside. |
| D4 | By default, no issue key goes in a commit. The changelog links the PR, and the PR links the issue. A project opts in through `pr.title_format`, and then the key is the **scope**: `{type}({issue_key}): {short_title}`. Nothing precedes the type. |
| D5 | Merge settings. **Squash-only is mandatory** (§4.4), and bootstrap stops without it. Squash title = PR title is also mandatory, because a one-commit PR otherwise lands with its commit subject. Squash body = `BLANK` is the recommended default. The skills print these settings. The always-on guidelines must hold for both `BLANK` and `PR_BODY`, because a consumer may decline the setting. |
| D6 | Token: `GITHUB_TOKEN` by default. A human approves the release PR's CI runs, which fits "the user owns the release". The documented alternative is a GitHub App token. Never use a PAT where commit signing is required. |
| D7 | Scope: Composer packages and PHP applications. `release-type: php` serves both. |

Dogfooding this repository is a separate follow-up (§9.3).

## 3. Engine facts that force the shape

Traced in boost-core `1.13.0`:

- Tags are AND-only. A unit ships when `unitTags ⊆ projectTags`.
- `boost-requires` rescue exists for skills and subagents only. `GuidelineTagFilter` has none.
- `boost tags` and `doctor` name the missing tag for a filtered skill or guideline.
- `withExcludedGuidelines(['vendor/package:name'])` drops one vendor guideline by name. The key
  grammar is frozen public API.

Consequence: the double tag (D2) makes the dependency fail closed. A project that declares
`release-please` without `conventional-commits` receives none of the release-please units, and
`boost tags` names the missing tag. `deploying-laravel-cloud` (`"laravel-cloud hosting"`) already
uses this pattern.

What ships for each tag set. Verify it in §8.3:

| Project tags | Receives |
|---|---|
| `php github conventional-commits` | the CC guideline and skill |
| `php github release-please` | nothing new; `boost tags` names `conventional-commits` |
| `php github conventional-commits release-please` | the CC and RP guidelines and skills. Not `pre-release`, `readme`, `release-notes` or `upgrading`, because all four are `release-automation`-tagged |
| the same + `release-automation` | all of the above, plus those four skills and `package-boost-php`'s `release-automation` guideline. D3's exclusion line removes that guideline |

The `release-please` skill declares `boost-requires: conventional-commits`. Its bootstrap invokes
that skill's setup to install the title check, which is a hard hand-off. Under D2 the CC skill
ships with it anyway, so the declaration records the hand-off and rescues nothing. Do not declare
`pre-release`. That reference is conditional, and rescue would bring a PHP gauntlet into non-PHP
projects.

## 4. Release-please facts the content must state

Each fact is measured or traced in the research file. Do not soften them.

1. **`release-type: php` releases on `chore`.** Its built-in sections make `chore` visible. Without
   an explicit `changelog-sections` list, every Dependabot `chore(deps)` merge opens a patch release
   PR. The config asset hides `chore`, and the inline test in §6.4 pins that.
2. **An unparseable title is dropped silently**, with only a debug log. This includes
   `[ABC-123] feat: …` and `Add the export`. An uppercase type (`Feat:`) is listed as a feature but
   bumps only the patch. So the CI title check is mandatory.
3. **Commit bodies are release input when the squash body is kept.** A body paragraph that starts
   with `type:` adds a changelog entry. A `BREAKING CHANGE:` paragraph anywhere makes the release
   major. GitHub prefixes branch-commit subjects with `* `, which the parser ignores, but branch
   bodies land without a prefix. A `BLANK` squash body should remove both effects:
   NEEDS-CONFIRMATION (§9.4). Under `BLANK`, only the title marks a breaking change (`!`).
4. **Squash-only is a requirement.** Release-please reads the full history, not first-parent only,
   and applies `BEGIN_COMMIT_OVERRIDE` to every commit that has the PR attached.
5. **The GitHub release body is the merged release PR body.** The next push to the release branch regenerates a
   hand-edited release PR, and it force-overwrites hand commits on the release branch.
6. **To change the release input after a merge, edit the merged PR's body**, not the release PR.
   Add a `BEGIN_COMMIT_OVERRIDE` … `END_COMMIT_OVERRIDE` block. The override replaces the commit
   message on the next run. It can fix the type, add `!`, or carry a `Release-As: x.y.z` line. All
   three were verified at strategy level. Under `BLANK`, a `Release-As:` line in an ordinary PR body
   has no effect, which was measured. Under `PR_BODY`, it works.
7. **Tokens**:

   | Token | Release-PR commit | CI on the release PR | Tag triggers workflows | "Require signed commits" |
   |---|---|---|---|---|
   | `GITHUB_TOKEN` | Verified | runs wait as `action_required` until a human approves | no | passes |
   | App installation token | Verified | runs | yes | passes |
   | PAT | unsigned | runs | yes | blocks the merge |

   `GITHUB_TOKEN` also needs the repository setting "Allow GitHub Actions to create and approve
   pull requests".
8. **A tag cut with `GITHUB_TOKEN` starts no `on: release` or tag-push workflow.** After a release,
   watch the push runs on the release branch for the release PR's merge commit.
9. **`[skip ci]`** and its variants in the squash commit stop the release-please run for that push.
10. **Changelog bootstrap.** Release-please inserts each entry above the first version heading
    (`## 1.2.3` or `## [1.2.3]`). A `CHANGELOG.md` with no version heading gets a second
    `# Changelog` header, and release-please demotes the old headings. The Keep a Changelog layout
    that `update-changelog.yml` writes works as it is.
11. **Tag format must match history.** `include-v-in-tag` defaults to `true`. A mismatch with the
    existing tags makes release-please put the whole history in the changelog. The family uses bare
    tags (`include-v-in-tag: false`).
12. **`composer.json` `version`.** The php updater bumps this field when it exists and never adds
    it.
13. Release-please never writes `UPGRADING.md`. A `!` change is the cue to run `upgrading`.

## 5. Phases

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | `conventional-commits` guideline + sidecar entry | §8.3 render |
| 2 | `conventional-commits` skill + asset | `validate-skills.php` |
| 3 | `release-please` guideline + skill + assets | `validate-skills.php` |
| 4 | Edits to existing content (§7) | `validate-catalog.php` |
| 5 | README rows, verification (§8) | all gates green |

Stop and ask before any schema change other than the description edit in §7.1. Schema text is
public API.

## 6. New content

Write in Simplified Technical English (`voice.md`). Every example is synthetic: `App\…`,
`ABC-123`, `acme/demo`, `Order`, `export command`. Do not name the consumer whose adoption informed
this plan. Always-on guidelines cost tokens in every session, so each line must earn its place.

### 6.1 Guideline `resources/boost/guidelines/conventional-commits.md`

Frontmatter-free and token-free. Sidecar: `conventional-commits.md: "conventional-commits"`. About
20 lines. It must say:

- **Grammar.** `type(scope)!: description`. Types are lowercase: `feat fix perf refactor docs style
  test build ci chore revert`. The description is in the imperative. Nothing precedes the type.
- **The PR title is the commit.** Under squash merge, write the title for the person who reads the
  changelog. Branch commit subjects do not land. PR titles always use this format: when
  `pr.title_format` is set, it starts with `{type}`. Do not ask the user for a title format.
- **Types.** `feat` is something a consumer can use. `fix` is a defect a consumer can see. A
  tests-, tooling- or CI-only change is never `feat`, `fix` or `perf`.
- **Breaking.** A change is breaking when a consumer must edit their code or config. Mark it with
  `!` in the title. Run `upgrading` when the project has that skill.
- **Issue key** (D4). Put it only where `pr.title_format` puts it, and then only as the scope.

The body rules and `[skip ci]` move to the release-please guideline, because only that parser makes
them matter. The "keep the prefix" rule lives in `humanizer` and `voice` (§7).

### 6.2 Skill `resources/boost/skills/conventional-commits/`

```yaml
---
name: conventional-commits
description: "Choose the Conventional Commits type, scope and breaking marker for a commit or PR title, and set up the CI check that rejects a non-conforming PR title. Activates when: writing a commit message or PR title in a Conventional Commits project, a title check failed, or when user mentions: conventional commits, commit type, feat or fix, breaking change, PR title check, semantic PR."
metadata:
  boost-tags: "conventional-commits"
---
```

Add `schema-required: "^1"` only if the body uses a `boost:conv` token (invariant G). The body below
needs none.

Body sections:

1. **Choose the type.** A decision table for the ambiguous cases:
   - refactor or fix
   - perf or refactor
   - a dependency bump a consumer feels: a raised `require` constraint is `fix(deps)`; a raised PHP
     floor is breaking
   - a dependency bump nobody downstream feels: `chore(deps)`
   - docs that ship with the package
   - revert. GitHub's revert button titles a PR `Revert "feat: …"`, which fails the check.
     Retitle it `revert: …`.
2. **Decide if it is breaking.** A checklist over the public surface: `public` and `protected`
   symbols, config keys, published paths, container bindings, CLI flags, and the `composer.json`
   `require` floor.
3. **Set up the check (GitHub).**
   - Copy `assets/conventional-title.yml` to `.github/workflows/`.
   - Add `commit-message: {prefix: "chore", include: "scope"}` to every `updates` entry in
     `.github/dependabot.yml`.
   - Print `->withConventions(['pr' => ['title_format' => '{type}: {short_title}']])` for
     `boost.php`, so `pull-requests` writes conforming titles from configuration.
   - Print the merge settings in §6.5.
   - Run nothing against the repository without the user's approval.

Asset `assets/conventional-title.yml`:

- `on: pull_request` with the types `opened`, `edited`, `reopened` and `synchronize`
- top-level `permissions: {}`
- one bash step that reads the title from `env:`, never from `${{ }}` inside `run:`

Default pattern:

```
^(feat|fix|perf|refactor|docs|style|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: [^ ].*$
```

When the project's title format puts `{issue_key}` in the scope (D4), the skill widens the scope
group to `\(([a-z0-9-]+|[A-Z][A-Z0-9]+-[0-9]+)\)`. Either pattern must accept
`chore(main): release 1.2.3`, which is the release PR's own title. Its scope is the release
branch name. When that name has characters outside `[a-z0-9-]` (for example `release/1.x`), widen
the scope class at setup.

### 6.3 Guideline `resources/boost/guidelines/release-please.md`

Sidecar: `release-please.md: "conventional-commits github release-please"`. About 12 lines:

- Release-please owns the version, `CHANGELOG.md`, the tag and the GitHub release. Never edit them
  by hand. Never run `git tag` or `gh release create`.
- The release is the merge of the release PR (`chore(<branch>): release x.y.z`). The user merges it,
  and the agent never does.
- To correct what a merged PR feeds into a release, edit that merged PR's body (§4.6). Never edit
  the release PR, because the next push overwrites it.
- When the squash body is kept, it is release input. Never start a body paragraph with `type:`.
  Never write `BREAKING CHANGE:` unless the change is breaking. Never write `[skip ci]` or its
  variants.
- Fallback precedence: where the `release-automation` guideline is also loaded, this guideline
  replaces it in full. Tags and release names follow `release-please-config.json`.

### 6.4 Skill `resources/boost/skills/release-please/`

```yaml
---
name: release-please
description: "Set up, run and repair release-please releases in a PHP repository on GitHub: bootstrap the config and manifest, choose the token, check the release PR, hand off the merge, and fix a missing, unwanted or wrongly versioned release. Activates when: setting up release-please, a release PR is open, cutting a release in a release-please repo, a change is missing from a release, an unwanted release PR opened, or when user mentions: release-please, release PR, autorelease, Release-As."
metadata:
  boost-tags: "conventional-commits github release-please"
  boost-requires: "conventional-commits"
---
```

Body sections:

1. **Bootstrap.**
   - Resolve the release branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.
     Use it wherever this skill writes `<branch>`: in the workflow asset, the history check, the
     rerun and the post-merge watch. Never assume `main`.
   - Confirm that a PR-title check is installed. If it is not, run the `conventional-commits`
     skill's setup first (§6.2.3). Without the check, an unparseable title is dropped silently
     (§4.2).
   - Check the merge settings: `gh api repos/{owner}/{repo} -q
     '"\(.allow_merge_commit) \(.allow_rebase_merge) \(.squash_merge_commit_title)"'`. If merge
     commits or rebase merges are allowed, or the squash title is not `PR_TITLE`, print §6.5 and
     stop until the user applies it.
   - Read the latest tag and its format: `git tag --sort=-v:refname | head -1`. With no release tag,
     write the manifest as `{}` and set `initial-version` in the config (for example `0.1.0`). Set
     `bootstrap-sha` when the old history must stay out of the first changelog. This path is
     NEEDS-CONFIRMATION (§9.4).
   - Write `release-please-config.json` from `assets/release-please-config.json`. Set
     `include-v-in-tag` to match the existing tags (§4.11). Below 1.0, add `bump-minor-pre-major`
     and `bump-patch-for-minor-pre-major`.
   - With a tag, write `.release-please-manifest.json` as `{".": "<latest version>"}`.
   - If `CHANGELOG.md` has no version heading, add one for the latest release first (§4.10).
   - If `composer.json` has a `version` field, tell the user that release-please will now bump it
     (§4.12).
   - Copy `assets/release-please.yml` to `.github/workflows/`.
   - Delete `.github/workflows/update-changelog.yml` if it exists, because two writers duplicate
     changelog entries.
   - Choose the token with the §4.7 table. The default is `GITHUB_TOKEN` plus the "Allow GitHub
     Actions to create and approve pull requests" setting.
   - Add the inline sections test below to the project's suite and run it.
   - Print for approval: the D3 exclusion line for `boost.php`, and the §6.5 settings.
2. **Release flow.** This skill is the single owner of the release.
   - Quality gate: `pre-release` steps 0–5 where that skill is synced. Otherwise use the project's
     own gate. Fixes land through a PR with a conforming title, never through a push to the release
     branch. Then confirm that CI is green on the `<branch>` HEAD, with the step-6 per-SHA query
     and without its push.
   - Find the release PR: `gh pr list --label "autorelease: pending"`.
   - Compare its version with the full messages, not the subjects:
     `git log <last-tag>..origin/<branch> --format='%H%n%B'`. For each squash commit, also read
     the merged PR's body for an override block (§4.6). Bodies, footers and overrides are release
     input too (§4.3, §4.6). Apply the configured strategy. From 1.0, `feat` is a minor bump and `!` is a major bump. Below 1.0, with both
     pre-major flags, `feat` and `fix` are patch bumps and `!` is a minor bump.
   - If an expected change is missing, find the cause before you propose a fix. The cause can be an
     unparsed title, a type that the config hides, an override block in the merged PR, or a body
     paragraph in the squash message.
   - **The release PR's checks are the pre-publication gate.** The tag and the release are created
     in the run that the merge push starts, at the same time as CI on that push. So wait for every
     check on the release PR to be green, on a head that contains the live `<branch>` HEAD.
     release-please updates the PR only when its generated body changes, so a push of a hidden
     type can leave it behind. Then the user clicks "Update branch" and the checks run again. Under `GITHUB_TOKEN`,
     those runs wait for the user to approve them.
   - Hand off: "merge PR #N". Never merge it yourself.
   - After the merge, watch the push runs on `<branch>` for the merge commit (§4.8). They confirm
     the release after publication. They do not gate it. Then confirm the
     release with `gh release view <tag>`.
3. **Troubleshooting.**
   - A stale `autorelease: pending` label on an old PR blocks new release PRs. Remove it.
   - A missing change, a wrong type, a missing `!` or a wrong version: before the merge, retitle the
     PR. After the merge, add an override block to the merged PR's body (§4.6). Editing a PR body
     starts no workflow. Also run `gh workflow run release-please.yml --ref <branch>`, or wait for
     the next push to `<branch>`. Do both actions only after the user approves, because both are outward.
   - An unwanted release PR from a visible type: hide that type in `changelog-sections`, then close
     the PR.
   - No release run after a merge: check for `[skip ci]` in the squash commit.

Assets, all without a leading dot, because sync skips hidden files:

- `assets/release-please-config.json`, shown below.
- `assets/release-please.yml`:
  - `on: push: branches: [<branch>]`, with the release branch filled in at bootstrap, plus `workflow_dispatch` so that an override can be applied
    without a new push
  - top-level `permissions: {}`
  - job-level `contents: write`, `issues: write`, `pull-requests: write`
  - `concurrency: {group: release-please, cancel-in-progress: false}`
  - `timeout-minutes: 5`
  - `googleapis/release-please-action` pinned to the v5.0.0 commit
    `45996ed1f6d02564a971a2fa1b5860e934307cf7`, because zizmor's `unpinned-uses` audit flags `@v5`

The sections test goes **inline** in `SKILL.md` as a fenced Pest block, not as a `.php` asset. Sync
copies assets into agent directories, where a consumer's Pint, PHPStan or Rector run could pick up
a `.php` file. The test asserts that the visible types are exactly `feat`, `fix`, `perf` and
`revert`. It also asserts that `chore`, `docs`, `style`, `refactor`, `test`, `build` and `ci` are
listed and hidden. Give a PHPUnit form in one sentence for projects whose
`testing.backend_framework` is PHPUnit. Write it as prose, not as a conventions token, to keep the
skill free of `schema-required`.

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "php",
  "include-v-in-tag": false,
  "include-component-in-tag": false,
  "changelog-sections": [
    { "type": "feat", "section": "Added" },
    { "type": "fix", "section": "Fixed" },
    { "type": "perf", "section": "Changed" },
    { "type": "revert", "section": "Changed" },
    { "type": "chore", "section": "Internal", "hidden": true },
    { "type": "refactor", "section": "Internal", "hidden": true },
    { "type": "docs", "section": "Internal", "hidden": true },
    { "type": "test", "section": "Internal", "hidden": true },
    { "type": "build", "section": "Internal", "hidden": true },
    { "type": "ci", "section": "Internal", "hidden": true },
    { "type": "style", "section": "Internal", "hidden": true }
  ],
  "packages": { ".": {} }
}
```

The section names follow `release-notes` (Added, Fixed, Changed). Release-please adds its own
`### ⚠ BREAKING CHANGES` section.

### 6.5 Merge settings the skills print

```bash
gh api -X PATCH repos/OWNER/REPO -F allow_squash_merge=true -F allow_merge_commit=false \
  -F allow_rebase_merge=false -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK
```

Also print a ruleset on the default branch: a `pull_request` rule with
`allowed_merge_methods: ["squash"]`, and `required_status_checks` that includes the title check.
Print both, and run them only after the user approves. They are persistent repository changes.

## 7. Edits to existing content

| # | File | Change |
|---|---|---|
| 7.1 | `conventions-schema.json` `pr.title_format` description + `pull-requests` "PR Title" | Add the `{type}` placeholder: the bare Conventional Commits type, without `!`. When a change is breaking, `!` goes directly before the `:`, after the scope when there is one: `feat(ABC-123)!: …`. State that `()` counts as a bracket in the empty-placeholder rule, so `{type}({issue_key}): x` with no key gives `feat: x`. Do not add a conditional default. The CC guideline owns the default (§6.1). The edited description line, and the `{issue_key}` bullet beside it, use a real tracker prefix in their examples. Replace it with `ABC-123` (CLAUDE.md). `schema-version` stays `1`. |
| 7.2 | `voice.md`, "Commit messages" row | Generalise the carve-out: "a prefix or token the project's commit format requires (an issue key, a `type(scope)!:` prefix) stays as it is". |
| 7.3 | `humanizer`, "When to Use This Skill" | One line: a Conventional Commits header prefix and the footer tokens (`BREAKING CHANGE:`, `Release-As:`, `Refs:`) stay unchanged. Humanize only the description and the body prose. |
| 7.4 | `pre-release` | A short branch right after the skill's intro paragraph, above "When to Use", so that no unconditional tag-handoff text stands above it. (The first draft said the top of `## Workflow`. The intro already requires the handoff, so the branch moved up.) When `release-please-config.json` exists, run steps 0–5 as a quality gate only, land fixes through a PR, and stop. The `release-please` skill owns the release, and its release-PR check replaces step 6 as the pre-publication CI gate (§6.4). Where that skill is not synced, follow the `release-please` guideline: the user merges the release PR. Steps 6–8 and the `gh release create` handoff do not apply. Reference the skill conditionally. Do not add it to `boost-requires`. |
| 7.5 | `release-notes`, "When to apply" | One bullet: not in a repository with `release-please-config.json`. There, the release body is generated from PR titles. |
| 7.6 | `.boost-tags.yaml` | The two entries from §6.1 and §6.3. |

Leave `final-verification-review`, `codex-review` and `autoresearch` alone.
`final-verification-review` hands a release to `pre-release`, which now branches. Under
squash-only, branch commit subjects never land.

## 8. Verification

1. `php .github/validate-skills.php` and `php .github/validate-catalog.php` must pass. Invariants
   B–E require these README updates first:
   - Skills table: 2 rows, count 36 → 38.
   - Tags table: 2 rows, count 14 → 16, owner `boost-skills`. Mark both rows opt-in, and say that
     `release-please` needs `conventional-commits` and `github`.
   - Guidelines table: 2 rows, count 10 → 12.
2. Render through `vendor/bin/boost sync` in a throwaway host project, once for each of the four
   tag sets in §3. Record what shipped, and compare it with the table.
   - In the `release-please`-only set, run `boost tags` and confirm that it names
     `conventional-commits`.
   - In the fourth set, add the D3 exclusion to a `boost.php` that already excludes another
     guideline. Confirm that both exclusions hold, that the `release-automation` guideline is
     gone, and that the four skills remain.
3. Run the title-check patterns against these lists:
   - Accept: `feat: x`, `fix(parser): x`, `feat!: x`, `refactor(order-export)!: x`,
     `chore(deps-dev): x`, `chore(main): release 1.2.3`.
   - Reject: `Add x`, `feat:x`, `Feat: x`, `feat(Parser): x`, `feat: `, `[ABC-123] feat: x`,
     `feat!(ABC-123): x`, `Revert "feat: x"`.
   - The issue-key variant must also accept `feat(ABC-123): x` and `feat(ABC-123)!: x`.
4. Run the inline sections test against the shipped config asset. Then edit a copy to make `chore`
   visible, and confirm the test fails.
5. Scan the diff for product names, real repository names, real PR numbers and handles
   (CLAUDE.md).

Re-run the research harness only if the drift check fires. In the hand-off, state what you did
not run. This plan includes no end-to-end release on GitHub (§9.3).

## 9. Follow-ups (not in this plan)

1. **boost-core request.**
   - Add tag implication (`release-please` ⇒ `conventional-commits`) or `boost-requires` on
     guidelines, so the double tag can relax. Relaxing removes a tag, which widens the audience
     and breaks no one.
   - Add `Tag::ConventionalCommits` and `Tag::ReleasePlease` enum cases.
2. **`package-boost-php` request.** Add one sentence to its `release-automation` guideline: "In a
   repository with `release-please-config.json`, the `release-please` guideline owns the
   changelog, the release notes and the tag." This removes the need for D3's exclusion line.
3. **Dogfood plan.** Switch this repository to release-please:
   - a manifest at the current version, with `include-v-in-tag: false`
   - remove `update-changelog.yml`
   - the title check and the squash-only settings

   This gives the first end-to-end test of the bare-tag lookup and of the changelog prepend.
4. **Open research items.** Run each one once a real repository uses the setup:
   - the effect of `BLANK` (§4.3)
   - the no-tag bootstrap (`{}` manifest, `initial-version`, `bootstrap-sha`)
   - `BEGIN_COMMIT_OVERRIDE` with `Release-As:` end to end (§4.6)
   - classic vs fine-grained PAT signing
   - Packagist pickup latency for API-created tags
   - whether `can_approve_pull_request_reviews` also controls PR creation

## 10. One-way doors

Confirm these before the first release. After that, each one is public:

- the tag names `conventional-commits` and `release-please`
- the double tag on the RP units, including `github`
- the `{type}` placeholder semantics in the schema description (bare type, `!` placed by the rule
  in §7.1)
- the section names and the hidden set in the config asset, which consumers' tests then pin
- the D3 exclusion key `sandermuller/package-boost-php:release-automation`, which couples this
  package to a guideline name in another family package
