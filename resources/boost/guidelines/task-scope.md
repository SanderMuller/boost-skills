## Task Scope and Edits

For session, branch, and PR scope, see the `single-issue-scope` guideline when the project enables it.

### The Task Sets the Scope

- Do not fix a pre-existing bug, a performance problem, or unrelated behaviour you find on the way, unless the requested behaviour cannot work without it. The same holds for refactors, cleanup, and documentation nobody asked for. A defect your own change introduces is not pre-existing: fix it.
- A sibling rule that requires an update on a line you already change still applies. The rule removes extras, not obligations.
- Report the rest as a follow-up in your summary. Propose an issue when the project tracks work that way, and let the user decide whether to file it. Report it; do not fix it.
- Implement every behaviour the task does ask for, completely. This rule cuts extras, never the requested scope.

### One Reading of an Ambiguous Ask

Implement the reading that the wording and the surrounding code support most directly. State that assumption in your summary. Do not build for both readings.

Materially different work is the test. When two readings would produce the same change, pick one and carry on. When they would not, or when a wrong guess is unsafe or makes the work useless, ask before building — through the `clarify` skill where the whole ask is fuzzy, otherwise with a direct question.

### Edit in Place

Change only the lines that must change. Rewrite a whole file only when the file is short, or when most of it changes. A rewrite churns lines the task never touched and can drop content by accident.
