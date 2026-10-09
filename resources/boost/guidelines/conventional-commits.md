## Conventional Commits

Every commit header and every PR title is a [Conventional Commit](https://www.conventionalcommits.org): `type(scope)!: description`.

- **Grammar.** The type is lowercase: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore` or `revert`. The scope is optional. The description is in the imperative. Nothing comes before the type.
- **The PR title is the commit.** A squash merge uses the PR title as the commit header, so write the title for the person who reads the changelog. Branch commit subjects do not land. When `pr.title_format` is set, it starts with `{type}`. When it is not set, use `{type}: {short_title}` and do not ask the user for a format.
- **Type.** `feat` is something a consumer can use. `fix` is a defect a consumer can see. A change to tests, tooling or CI only is never `feat`, `fix` or `perf`.
- **Breaking.** A change is breaking when a consumer must edit their code, config or environment. Mark it with `!`. Run the `upgrading` skill when the project has it.
- **Issue key.** Put a tracker key in the header only where `pr.title_format` puts it, and then only as the scope: `fix(ABC-123): …`.

The `conventional-commits` skill has the decision table for an ambiguous type and the checklist for a breaking change.
