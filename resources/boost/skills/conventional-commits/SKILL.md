---
name: conventional-commits
description: "Choose the Conventional Commits type, scope and breaking marker for a commit or PR title, and set up the CI check that rejects a non-conforming PR title. Activates when: writing a commit message or PR title in a Conventional Commits project, a title check failed, or when user mentions: conventional commits, commit type, feat or fix, breaking change, PR title check, semantic PR."
metadata:
  boost-tags: "conventional-commits"
---

# Conventional Commits

## 1. Choose the type

Ask what the consumer of this code sees after the change. A consumer is whoever uses the package or the application: a developer who installs it, or a user of the running app.

| The change | Type |
|---|---|
| The same behaviour, measurably faster or lighter | `perf` |
| The same behaviour, restructured code | `refactor` |
| A refactor that also fixes a visible defect | `fix` — the consumer sees the fix |
| Documentation that ships with the package (README, docs site) | `docs` |
| Tests only | `test` |
| CI workflows only | `ci` |
| Build or packaging config (`composer.json` scripts, `.gitattributes`) | `build` |
| Formatting only, no behaviour change | `style` |
| A dependency bump that a consumer feels: a raised `require` constraint, a fixed vulnerable version | `fix(deps)` |
| A dependency bump that nobody downstream feels: dev tools, lock-file refresh | `chore(deps)` |
| Undoing an earlier change | `revert` |
| Anything else that does not reach a consumer | `chore` |

GitHub's revert button titles the PR `Revert "feat: …"`. That title fails the check. Retitle it `revert: …`.

When one PR holds two kinds of change, the title takes the kind a consumer sees.

## 2. Decide if it is breaking

Check the public surface the change touches:

- a `public` or `protected` symbol removed, renamed, or given a new required parameter or a narrower type
- a config key removed, renamed, or given a different default
- a published path, a container binding, an event name, or a route removed or renamed
- a CLI command or flag removed, renamed, or given a different default
- a raised floor in `composer.json` `require`: PHP, a framework, or an extension
- a changed output format that a consumer parses

Do not mark an internal or `@internal` change as breaking.

## 3. Set up the check (GitHub)

Do these steps when the project adopts Conventional Commits. Every step that changes the repository on GitHub is an outward action. Print it, and run it only after the user approves.

1. Copy `assets/conventional-title.yml` from this skill's directory to `.github/workflows/conventional-title.yml`.
   - When the project's PR title format puts `{issue_key}` in the scope, widen the scope group in the pattern to `\(([a-z0-9-]+|[A-Z][A-Z0-9]+-[0-9]+)\)`.
   - The pattern must accept the release PR title of a release tool, for example `chore(main): release 1.2.3`. Its scope is the release branch name. When that name has characters outside `[a-z0-9-]`, for example `release/1.x`, widen the scope group.
2. Give Dependabot conforming titles. Add this to every entry under `updates:` in `.github/dependabot.yml`:

   ```yaml
   commit-message:
     prefix: "chore"
     include: "scope"
   ```

   Dependabot titles then read `chore(deps): …` and `chore(deps-dev): …`. Use `fix(deps)` by hand for a bump that a consumer feels (section 1). Add a `github-actions` entry too when the project pins actions to a commit, so Dependabot keeps the pins current.
3. Print the `boost.php` change that makes the `pull-requests` skill write conforming titles. `withConventions()` replaces the whole conventions array, so add the key to the existing array and keep every other value:

   ```php
   ->withConventions([
       // existing keys stay
       'pr' => [
           // existing pr keys stay
           'title_format' => '{type}: {short_title}',
       ],
   ])
   ```

   When the project wants the tracker key in the header, use `'{type}({issue_key}): {short_title}'`. A public package usually keeps the key out: the changelog links the PR, and the PR links the issue.
4. Print the merge settings. A squash merge must use the PR title, including for a PR with one commit:

   ```bash
   gh api -X PATCH repos/{owner}/{repo} -F allow_squash_merge=true -F allow_merge_commit=false \
     -F allow_rebase_merge=false -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK
   ```

   `BLANK` keeps branch commit bodies out of the squash commit. A tool that parses commit bodies then reads only the title.
5. Print a ruleset for the default branch that makes the check required and allows only squash merges. Create it with `gh api -X POST repos/{owner}/{repo}/rulesets --input ruleset.json`:

   ```json
   {
     "name": "conventional-commits",
     "target": "branch",
     "enforcement": "active",
     "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
     "rules": [
       {
         "type": "pull_request",
         "parameters": {
           "allowed_merge_methods": ["squash"],
           "dismiss_stale_reviews_on_push": false,
           "require_code_owner_review": false,
           "require_last_push_approval": false,
           "required_approving_review_count": 0,
           "required_review_thread_resolution": false
         }
       },
       {
         "type": "required_status_checks",
         "parameters": {
           "strict_required_status_checks_policy": false,
           "required_status_checks": [{ "context": "Conventional PR title" }]
         }
       }
     ]
   }
   ```

   Merge these rules into an existing ruleset when the project has one, instead of adding a second.

Open PRs whose titles do not conform must be retitled before they can merge: `gh api -X PATCH repos/{owner}/{repo}/pulls/{number} -f title='<new title>'`.
