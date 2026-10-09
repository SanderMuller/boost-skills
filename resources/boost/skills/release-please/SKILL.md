---
name: release-please
description: "Set up, run and repair release-please releases in a PHP repository on GitHub: bootstrap the config and manifest, choose the token, check the release PR, hand off the merge, and fix a missing, unwanted or wrongly versioned release. Activates when: setting up release-please, a release PR is open, cutting a release in a release-please repo, a change is missing from a release, an unwanted release PR opened, or when user mentions: release-please, release PR, autorelease, Release-As."
metadata:
  boost-tags: "conventional-commits github release-please"
  boost-requires: "conventional-commits"
---

# release-please

release-please reads the Conventional Commits on the release branch. It keeps one release PR open with the next version and the new `CHANGELOG.md` entry. When the user merges that PR, the next workflow run tags the release and creates the GitHub release.

In the commands below, `<branch>` is the release branch and `{owner}/{repo}` is the repository.

## Facts that decide the procedure

- **`release-type: php` releases on `chore` by default.** Without an explicit `changelog-sections` list, every Dependabot `chore(deps)` merge opens a patch release PR. The config asset hides `chore`.
- **Squash merge only.** release-please reads the whole history, including the commits of a merged branch. Merge commits and rebase merges give duplicate or unwanted entries.
- **The GitHub release body is the merged release PR's body.** The next push to `<branch>` regenerates a hand-edited release PR and overwrites hand commits on its branch.
- **Tokens:**

  | Token | Release PR commit | CI on the release PR | Tag starts workflows | "Require signed commits" |
  |---|---|---|---|---|
  | `GITHUB_TOKEN` (default) | Verified | waits as `action_required` until a human approves | no | passes |
  | GitHub App installation token | Verified | runs | yes | passes |
  | Personal access token | unsigned | runs | yes | blocks the merge |

  Never use a personal access token where commit signing is required.
- **A tag created with `GITHUB_TOKEN` starts no `on: release` or tag-push workflow.** A workflow that must run after a release needs an App token, or must trigger on the push of the release PR's merge commit.

## 1. Bootstrap

Every step that changes the repository on GitHub, or a file outside this repository, is an outward action. Print it, and run it only after the user approves.

1. Resolve the release branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`. Use it for `<branch>` everywhere below. Never assume `main`.
2. Check the merge settings:

   ```bash
   gh api repos/{owner}/{repo} -q '"\(.allow_merge_commit) \(.allow_rebase_merge) \(.squash_merge_commit_title)"'
   ```

   The output must be `false false PR_TITLE`. Otherwise, print the settings from the `conventional-commits` skill (section 3, step 4) and stop until the user applies them.
3. Confirm that a PR-title check runs on pull requests (`.github/workflows/conventional-title.yml` or an equal check). If none exists, run the `conventional-commits` skill's setup (section 3) first. The check is mandatory: release-please skips a header it cannot parse without a warning, so `[ABC-123] feat: …` never reaches a release, and an uppercase `Feat:` bumps only the patch.
4. Read the latest release tag and its format: `git tag --sort=-v:refname | head -1`.
5. Copy `assets/release-please-config.json` from this skill's directory to `release-please-config.json`.
   - Set `include-v-in-tag` to match the existing tags: `false` for `1.2.3`, `true` for `v1.2.3`. A mismatch makes release-please miss the previous release and put the whole history in the changelog.
   - Below 1.0, add `"bump-minor-pre-major": true` and `"bump-patch-for-minor-pre-major": true`. Then `feat` and `fix` bump the patch, and a breaking change bumps the minor.
6. Write `.release-please-manifest.json`:
   - With a release tag: `{".": "<latest version>"}`, without a `v`.
   - With no release tag: `{}`, and set `"initial-version"` in the config, for example `"0.1.0"`. To keep old history out of the first changelog, set `"bootstrap-sha"` to the commit before the first commit to include. This path has not been tested end to end. Check the first release PR closely.
7. Check `CHANGELOG.md`. release-please inserts each entry above the first version heading (`## 1.2.3` or `## [1.2.3]`). If the file has no version heading, add one for the latest release. Otherwise release-please adds a second `# Changelog` header and changes the old headings.
8. If `composer.json` has a `version` field, tell the user that release-please now bumps it in every release PR. It never adds the field.
9. Copy `assets/release-please.yml` to `.github/workflows/release-please.yml`, and set `<branch>` under `on.push.branches`. The action is pinned to a commit. Add a `github-actions` entry to `.github/dependabot.yml` when it has none, so Dependabot keeps the pin current.
10. Delete `.github/workflows/update-changelog.yml`, or any other workflow that writes `CHANGELOG.md`. Two writers give duplicate entries.
11. Choose the token with the table above. With `GITHUB_TOKEN`, the user must allow "Allow GitHub Actions to create and approve pull requests" in the repository or organization settings. For an App token, add an `actions/create-github-app-token` step and pass its output as the action's `token` input.
12. Add the sections test below to the project's test suite and run it.
13. When the project uses boost-core and also declares the `release-automation` tag, exclude that tag's guideline, because this flow replaces it. Add the key to the existing `withExcludedGuidelines([...])` list in `boost.php`. The method replaces the whole list, so keep the existing entries:

    ```php
    ->withExcludedGuidelines([
        // existing entries stay
        'sandermuller/package-boost-php:release-automation',
    ])
    ```

### The sections test

This test pins the change that stops chore-only releases. Put it in the project's test suite, for example `tests/ReleaseConfigTest.php`:

```php
<?php

it('releases only on feat, fix, perf and revert', function (): void {
    $config = json_decode((string) file_get_contents(__DIR__ . '/../release-please-config.json'), true);
    // A package-level list overrides the top-level one, as in release-please itself.
    $sections = $config['packages']['.']['changelog-sections'] ?? $config['changelog-sections'] ?? [];

    $visible = array_column(
        array_filter($sections, fn (array $section): bool => ! ($section['hidden'] ?? false)),
        'type',
    );

    expect($sections)->not->toBeEmpty()
        ->and($visible)->toEqualCanonicalizing(['feat', 'fix', 'perf', 'revert'])
        ->and(array_column($sections, 'type'))
        ->toContain('chore', 'docs', 'style', 'refactor', 'test', 'build', 'ci');
});
```

In a PHPUnit project, write the same assertions with `assertNotEmpty()`, `assertEqualsCanonicalizing()` and `assertContains()`.

## 2. Release flow

This skill owns the release from the quality gate to the published tag.

1. Run the quality gate: `pre-release` steps 0–5 where that skill is synced, otherwise the project's own gate. A fix lands through a PR with a conforming title, never through a push to `<branch>`.
2. Confirm that CI is green on the live `<branch>` HEAD. Resolve that commit from the remote, never from the local checkout:

   ```bash
   SHA=$(git ls-remote origin refs/heads/<branch> | awk '{print $1}')
   gh run list --commit "$SHA" --limit 100 --json name,status,conclusion
   ```

   Where `pre-release` is synced, its step-6 wait loop can poll this `SHA`. Skip its push and its `SHA=$(git rev-parse HEAD)` line.

   The list must not be empty: zero runs is not green. Every run must be `completed`, with a `success` or `skipped` conclusion. If runs are still in progress, wait and query again.
3. Find the release PR: `gh pr list --label "autorelease: pending" --json number,title,headRefOid`.
4. Check the proposed version against the full messages, not only the subjects:

   ```bash
   git fetch origin <branch> --tags
   git log <last-tag>.."$SHA" --format='%H%n%B'
   ```

   Also read each merged PR's body for a `BEGIN_COMMIT_OVERRIDE` block, because it replaces the commit message. From 1.0, `feat` bumps the minor and a breaking change bumps the major. Below 1.0 with both pre-major options, `feat` and `fix` bump the patch and a breaking change bumps the minor.
5. If an expected change is missing, find the cause before you propose a fix. The cause can be an unparsed header, a type the config hides, an override block, or a body paragraph in a squash commit.
6. **The release PR's checks are the gate before publication.** The tag is created in the run that the merge push starts, at the same time as CI on that push. So every check on the release PR must be green, on a head that contains the live `<branch>` HEAD. release-please updates the PR only when its generated body changes, so a push of a hidden type (`ci:`, `chore:`) can leave the PR behind:

   ```bash
   LIVE_SHA=$(git ls-remote origin refs/heads/<branch> | awk '{print $1}')
   HEAD_SHA=$(gh pr view <number> --json headRefOid -q .headRefOid)
   git fetch origin <branch> "$HEAD_SHA"
   git merge-base --is-ancestor "$LIVE_SHA" "$HEAD_SHA" && echo current || echo behind
   ```

   When the PR is behind, ask the user to click "Update branch" on the PR, then wait for its checks again. Under `GITHUB_TOKEN`, tell the user to approve the waiting runs.

   List the checks with `gh pr checks <number>`. They must include the project's tests and static analysis, not only the title check. When the project's CI does not run on pull requests, or a path filter skips the release PR, say so in the handoff: the step-2 check on the branch HEAD is then the only code gate, and the release PR adds only `CHANGELOG.md`, the manifest and a `composer.json` `version`.
7. Hand off: "merge release PR #N". Never merge it yourself.
8. After the merge, confirm the release: `gh release view <tag>`. Then watch the push runs on `<branch>` for the merge commit with the step-2 query. They confirm the release after publication, but they do not gate it.

## 3. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| No release PR opens | Every commit since the last release has a hidden type, or no header parsed. Read `git log <last-tag>..origin/<branch> --format=%s`. |
| No release PR after a new merge | The squash commit contains `[skip ci]`: run the workflow by hand. Or a merged release PR still has the `autorelease: pending` label. That label means the release is not yet created. Check for its release (`gh release view <tag>`) and for a failed release-please run first. When the release does not exist, re-run the workflow and fix what failed. Remove the label only when the release exists. |
| A change is missing, has the wrong type or lacks `!`, or the version is wrong | Before the merge: retitle the PR. After the merge: add an override block to the merged PR's body, with a `Release-As:` line for a wrong version, then run the workflow (below). |
| An unwanted release PR opens | A visible type triggered it. Hide that type in `changelog-sections`, merge that change, then close the release PR. |

An override block in a merged PR's body replaces that PR's commit message on the next run:

```text
BEGIN_COMMIT_OVERRIDE
fix(parser)!: reject empty input

Release-As: 2.0.0
END_COMMIT_OVERRIDE
```

Editing a PR body starts no workflow. Run the release workflow after the edit:

```bash
gh workflow run release-please.yml --ref <branch>
```

Both the edit and the run are outward actions. Do them only after the user approves.
