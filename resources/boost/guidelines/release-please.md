## Releases with release-please

[release-please](https://github.com/googleapis/release-please) owns the version, `CHANGELOG.md`, the tag and the GitHub release.

- After the bootstrap in the `release-please` skill, never edit the version, `CHANGELOG.md` or `.release-please-manifest.json` by hand. Never run `git tag` or `gh release create`.
- The release is the merge of the release PR (`chore(<branch>): release x.y.z`). The user merges it. The agent never does.
- Never edit the release PR's title, body or files, and never commit to its branch: the next push to the release branch overwrites them. To correct what a merged PR feeds into a release, edit that merged PR's body. The `release-please` skill has the steps.
- When the squash commit keeps a body, the body is release input. Never start a body paragraph with `type:`, because it adds a changelog entry. Write `BREAKING CHANGE:` only for a breaking change, because it makes the release major. Never write `[skip ci]` or its variants, because they stop the release run.
- Where the `release-automation` guideline is also loaded, this guideline replaces it in full. Tags and release names follow `release-please-config.json`.
