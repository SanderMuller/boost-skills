# Anonymize Skills, Guidelines, Docs, and Plans

This is a **public, open-source repository**. The skill bodies in
`resources/boost/skills/`, the guideline files in `resources/boost/guidelines/`,
and `README.md` / `UPGRADING.md` ship in the Composer dist archive **and** are
world-readable on GitHub. `CHANGELOG.md`, `plans/`, and `.ai/` are
`export-ignore`d, but that only trims the archive; it hides nothing on GitHub.
Only `internal/` is gitignored — that is the one place real provenance may
live (release-notes drafts already do).

Every example — a code snippet in a skill, a sample PR or issue body, a sample
commit message, a sample prompt, a plan's illustration — must be **synthetic**.
Never copy proprietary application code or internal text — from hihaho or any
consumer/dogfooding codebase — into one. Reconstruct the smallest generic
example that demonstrates the point, then strip every domain detail not needed
to make it.

This keeps internal domain models, naming, business terms, and logic out of a
public artifact, and it makes for better examples: the instruction stands out
instead of being buried in incidental domain noise.

## Anonymize these

- **Class and namespace names** — use framework-conventional placeholders
  (`App\Models\Article`, `App\Http\Resources\PostResource`). Don't reach for
  a product's real domain entities.
- **Variable, property, and method names** that carry domain meaning.
- **String literals** — route paths, table and column names, config keys,
  labels, messages. Invent neutral values; never paste a real schema column
  or route key.
- **Ticket keys and project prefixes** in sample issues, commits, and `gh` /
  Jira invocations — use an `ABC-123`-style placeholder, never a real
  tracker's project key.
- **Sample PR / issue / commit text** — write it about a fictional change,
  not a paraphrase of a real internal one.
- **Business terminology and comments** lifted from real code or tickets.
- **Logic and control flow** that mirrors a real implementation.

## Keep these — they are not leaks

- **Framework and vendor public symbols** (`Illuminate\…`, `Route`,
  `JsonResource`, `Model`) and public tool names (`gh`, `composer`,
  `vendor/bin/pest`, `vendor/bin/boost`). Skills have to name these to work,
  and they are public API.
- **Generic example nouns** — `User`, `Post`, `Order`, `Article`, `Comment`.
- **The convention a skill or guideline enforces** (formats, naming rules,
  checklist steps). That is this package's public contract, not proprietary.

## Plans and the CHANGELOG leak provenance, not just code

A plan in `plans/` rarely contains a real schema column — its leak vector is
**provenance metadata** describing where the work came from. The CHANGELOG
carries the same risk. Scrub all of it:

- **Internal PR / issue / ticket numbers** ("modelled on PR #1234",
  "ABC-123"). Describe the *change* generically ("a manual code-style cleanup")
  instead of citing the source. (Don't reference a real PR number here either —
  these examples are deliberately fake.)
- **Employee names, handles, and authorship** of the originating work.
- **Real domain method / class names** copied from the source change, even in
  prose (e.g. "the source change's `recalculateScore()`/`markProcessed()`
  calls"). Use the same neutral placeholders the plan's code examples use.
- **Dogfooding / consumer-app references** ("from the hihaho app", file/line
  counts of a private PR).

State *what* a skill does and *why*, never *which internal change or person*
it came from. If real provenance must be written down, put it in `internal/`.

## Rule of thumb

An example should read like a generic framework tutorial snippet, not like a
slice of one company's application. If a reader could tell which product it
came from, anonymize further — prefer a neutral noun (`Article`, `Order`) over
an actual product entity or feature name from the host product.

## When adding or editing a skill, guideline, doc example, or plan

1. Keep only the public symbols and tool names the instruction needs.
2. Replace real names, keys, and strings with neutral equivalents.
3. Keep each example consistent with the instruction it illustrates; for a
   plan, strip provenance (see "Plans and the CHANGELOG leak provenance"
   above).
4. Before committing, scan the diff for product names, real ticket keys,
   domain jargon, and internal PR/ticket/person references — across
   `resources/`, `plans/`, `README.md`, `UPGRADING.md`, and `CHANGELOG.md`.

---

## AskUserQuestion Phrasing

When writing an `AskUserQuestion` question, option labels, or option descriptions, **avoid first- and second-person pronouns** — `I`, `me`, `my`, `we`, `our`, `you`, `your`. In that tool the user is reading a question *from* the assistant and answering it, so the roles are inverted and these pronouns are ambiguous: the reader cannot tell whether `I`/`my` means the assistant or themselves, nor whether `you`/`your` means them or the assistant.

Name the actor explicitly instead — "the assistant" (these guidelines are shared across agents, so avoid hard-coding a product name like Claude or Copilot) and "the user" (or a concrete role) for the person answering — or rephrase to drop the pronoun entirely.

```text
❌ "Which approach do you want me to take?"
❌ "Should I keep the existing tests you wrote?"

✅ "Which approach should the assistant take?"
✅ "Keep the existing tests, or replace them?"   (pronoun dropped)
✅ "Should the assistant keep the tests already in the repo?"
```

This applies to every part of the question payload: the `question` text, each option `label`, and each option `description`.

---

## Fixing PHPStan Errors

When fixing a PHPStan error, first decide whether it represents a runtime bug a test could catch — and if so, write that test before the fix.

### Process

1. **Assess testability** — does the error represent a runtime bug a test could reproduce (a wrong argument type, a missing method, an incorrect return type used downstream)?
2. **Write the test first** — if a test can catch it, write a failing test that reproduces the error before applying the fix.
3. **Fix the code** — apply the fix so both the PHPStan error and the new test pass.
4. **Verify both** — confirm PHPStan reports no error and the test passes.

### When to Write a Test

Write a test when the PHPStan error indicates a fault that would surface at runtime:

- A method call on a value of the wrong type
- Missing or incorrect arguments to a function or method
- A return-type mismatch that would break callers
- Accessing a property or method that does not exist
- Any type error that would manifest as a runtime exception

### Annotate Rather Than Suppress

Some errors are PHPStan reading a signature that says less than the code does — a return type a parameter decides, a bool helper that proves a type. The `backend-quality` skill carries the two annotations that state the missing fact, and the rules for when each one lies.

### When to Skip the Test

Skip the test when the error is purely static and cannot cause a runtime failure:

- Missing return-type declarations
- PHPDoc mismatches with no runtime impact
- Unused variables or imports
- Generic-type parameter issues

---

## Signed Commits

Applies **only when the repository has commit signing enabled** (e.g. `git config commit.gpgsign` is `true`, or a `user.signingkey` / `gpg.format` is set). If signing is not enabled, this guideline does not apply — commit normally.

### Never fall back to an unsigned commit

When signing is enabled, every commit must be signed. If the signing backend or agent (1Password, `gpg-agent`, `ssh-agent`, a hardware key, etc.) is unavailable, locked, or not responding:

- **Stop and surface the failure** to the user with the exact error.
- **Do not** retry with `--no-gpg-sign`, unset `commit.gpgsign`, or otherwise produce an unsigned commit to "get past" the problem.

A missing signature is a blocker to resolve (unlock the agent, re-authenticate 1Password, plug in the key), not a step to skip. Let the user fix the signing setup, then commit signed.

---

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

---

## Verification Before Completion

Before claiming any work is complete or successful, run the verification command fresh and confirm the output. Evidence before claims, always.

### Claims About How the Code Behaves — Trace, Don't Assume

A claim about **how the code currently behaves** — a root cause, an existing mechanism, or present behavior — in a spec, PR, commit message, code-review finding, issue, comment, or answer must be traced to the actual code (or observed at runtime) **before** you write it, never asserted from plausibility. (This governs statements of *fact about the present code*; the *intended* future behavior a spec or PR proposes is fine when it's clearly framed as a requirement, proposal, or decision — not disguised as a fact about what already exists.) Every illustrative example must be one you actually observed, never invented to fit a guess. A wrong "why" is worse than none: reproduction steps, tests, QA testables, and the fix itself all get built on the stated cause, so one unverified guess corrupts everything derived from it. When you have not traced it, say so — mark it `NEEDS-CONFIRMATION` or ask — rather than asserting. (A ticket once claimed a list was "sorted by display name" and backed it with an example that could not occur; the sort actually keyed on an internal identifier — one grep away. The trace is cheap; the false premise is not.)

### Required Before Any Completion Claim

1. **Run** the relevant command (in the current message, not from memory)
2. **Read** the full output
3. **Confirm** it supports the claim
4. **Then** state the result with evidence

| Claim            | Required verification                                            |
|------------------|------------------------------------------------------------------|
| Tests pass       | The project's test command, output showing 0 failures            |
| Code style clean | The project's formatter/style checker, output showing no changes |
| Linting clean    | The project's linter, output showing 0 errors                    |
| Types check      | The project's type checker, output showing 0 errors              |
| Bug fixed        | The previously failing test now passes                           |
| Feature complete | All related tests pass                                           |

Use the project's own commands — check its `composer.json` / `package.json` scripts, CI config, or sibling docs to find them. Do not assume a specific tool.

### Delegating the checks

Where the project has dedicated quality-check skills synced, delegate to them — `backend-quality` for backend files, `frontend-quality` for frontend files, both when a change spans both. Otherwise, run the project's own equivalent commands directly.

### A Commit Is a Claim Too

Commit a change once its own checks pass against the tree as it stands, not while the approach is still being tried. A commit reads as a decision. The next defect then gets patched on top of the approach instead of the approach being dropped, and each extra commit raises the cost of the revert that was the right answer.

Deferring is not "never commit". Uncommitted work is unprotected, and a commit is still the safe way to set work aside or to hand it over. A measurement loop inverts the rule on purpose — it commits before it measures, so a rejected experiment reverts in one step. Where a skill states that it commits first, that skill wins for its own flow.

### Never Use Without Evidence

- "should work now"
- "that should fix it"
- "looks correct"
- "I'm confident this works"

These phrases indicate missing verification. Run the command first, then report what actually happened.

---

## Voice — Which Rule, Which Surface

This table decides which rule applies to a piece of text. Never apply both to the same words, and never guess.

| Surface | Rule |
|---|---|
| Chat replies to the user | Simplified Technical English |
| PR titles, descriptions, checklists | Simplified Technical English |
| PR review comments and replies to reviewers | Simplified Technical English |
| Issue and ticket descriptions, comments, QA testables | Simplified Technical English |
| Spec files | Simplified Technical English |
| `AskUserQuestion` questions, options, descriptions | Simplified Technical English — plus the pronoun rules in the `AskUserQuestion Phrasing` guideline, when the project has it |
| Commit messages | Simplified Technical English — an issue key the project's commit format requires stays as it is |
| Text an end user reads — in-app copy, translations, release notes, help text, seed content | The project's own tone-of-voice rules, not this guideline |
| Suggested translation strings inside an issue or ticket | The project's own tone-of-voice rules — the prose around them stays Simplified Technical English |
| Code and code comments | Neither — the language guidelines own those |
| Prose the user asks for in a named style, or an artifact whose own skill defines its voice — `humanizer`, `readme`, `release-notes` | That instruction or skill wins. This guideline does not override it |

A surface the table does not list gets Simplified Technical English, unless an end user reads it. Then it gets the project's tone-of-voice rules. A project without documented tone-of-voice rules gets Simplified Technical English everywhere.

This guideline governs **how a sentence is built**. It never overrides what a document is allowed to say: an issue-format doc still owns issue content, and a PR template still owns its sections.

### Simplified Technical English

**Write in ASD-STE100 Simplified Technical English.** Say the same thing in fewer, simpler words.

- One idea per sentence. Keep procedural sentences to 20 words or less, descriptive sentences to 25 or less.
- Use the active voice. Name the actor. Use the passive only when the actor is unknown.
- Use simple tenses only — simple present, simple past, simple future, infinitive, imperative. No complex constructions built from auxiliary verbs.
- Use one word for one meaning. Use the same word for the same thing every time — do not vary it for style.
- Keep articles (`the`, `a`, `an`) and other small words that make a sentence clear. Simplified is not clipped.
- One topic per paragraph, six sentences at most. Use a list when there is more than one item.
- Cut filler, hedging, and repetition. Do not restate the question or summarise what you are about to say.
- Give the answer first. Add detail after it, and only if the reader needs it.
- Use everyday words. Write "use", not "utilise"; "help", not "facilitate". Keep technical terms exact — a class name, a flag, or an error message is quoted as it is.
- Write Latin abbreviations out: "for example", not "eg"; "that is", not "ie"; "and so on", not "etc".
- Do not shout. No exclamation marks, no capitals for emphasis, and no bold used only to raise the volume. Structural bold that a template defines — `**Before:**`, `**Expected:**`, a table header, a labelled line — is not emphasis and stays.
- No metaphors, no clichés, no jokes that carry meaning the plain sentence does not.

The sentence limits, the tense list, the article rule, and the paragraph limit come from the ASD-STE100 writing rules. The everyday-words, Latin-abbreviation, no-shouting, and no-metaphor rules come from the GOV.UK content style guide.

---

# Package Boost Guidelines

These guidelines replace Laravel Boost's default foundation for
repositories that ship as Composer packages — Laravel-targeted or
framework-agnostic. The framing, tooling, and trade-offs differ from
application development; follow this version when working inside a
package codebase.

## Foundational Context

This codebase is a **Composer package**, not an application. The rules
below hold regardless of which framework (if any) the package targets.

- There is no `app/`, `bootstrap/`, `routes/`, `.env`, or database by
  default. Tooling that assumes an application context (e.g. running
  `php artisan` against the package itself) does not apply.
- The primary artefact is the package's public API — entry-point
  classes, service providers, exposed contracts. Everything else is
  scaffolding.
- Downstream consumers depend on this package via Composer. Every
  public change is a user-facing API change governed by semver.
- `composer.json` is the source of truth for supported PHP versions
  and any framework constraints. Check `require.php` (and any
  `require.<framework>/*` entries) before using version-specific
  features.

## Source Layout

- `src/` — package source, PSR-4 autoloaded per `composer.json`
- `tests/` — Pest or PHPUnit suite
- `config/` — publishable defaults shipped with the package, when
  applicable
- `resources/` — views, translations, Boost skills / guidelines, when
  applicable
- `database/migrations`, `database/factories` — only if the package
  ships them
- `workbench/` — developer-only Testbench scaffolding when Testbench
  is in use; never shipped

Check sibling files before inventing structure. Do not introduce new
top-level directories without a clear reason.

## Tests Are the Specification

The package has no running application to click through. Tests are how
behaviour is pinned down.

- Write tests alongside any behavioural change.
- Do not create "verification scripts" when a test can prove the same
  thing.
- Run the project's configured test runner (`vendor/bin/pest` or
  `vendor/bin/phpunit`) before claiming a change is done.

## Public API Discipline

- Every `public`, `protected`, or exported symbol is part of the
  package's surface. Breaking changes require a major version bump.
- Prefer `final` classes and `private`/`@internal` markers for
  anything not intended for extension.
- Keep config keys, published asset paths, and service container
  bindings stable across patch and minor versions.

## Conventions

- Match existing code style, naming, and structural patterns — check
  sibling files before writing new ones.
- Use descriptive names (`resolvePublishDestination`, not `resolve()`).
- Reuse existing helpers before adding new ones.
- Do not add dependencies without approval; every new `require` is a
  constraint downstream consumers inherit.

## Extending boost-core

If your package authors a custom `FileEmitter` (to write a file like
`.mcp.json` into the host during `boost sync`), declare the
`boost-extension` tag in your `boost.php` `withTags([...])`. That pulls
the `writing-file-emitter` skill — gated off by default so consumers
who do not extend the engine don't carry it, which is why an
emitter-authoring package has to opt in explicitly. The same tag pulls
`skill-authoring` for writing boost-family skills.

## Documentation Files

Only create or edit documentation (README, CHANGELOG, docs/) when
explicitly requested or when a behaviour change requires it.

## Replies

Be concise. Focus on what changed and why. Skip restating what the
diff already shows.

---

# Release Automation

Conventions the package-boost family shares for release flow. The
procedural detail lives in the `pre-release` and `release-notes`
skills — loaded on-demand, not pinned here.

## CHANGELOG is CI-managed

`.github/workflows/update-changelog.yml` prepends the release body to
`CHANGELOG.md` on `release: released` and commits to the release's
target branch (typically `main`). Don't hand-edit `CHANGELOG.md` as
part of a release. Post-release typo fixes are committed directly.

## Release notes live in `internal/release-notes-<version>.md`

`internal/` is gitignored — drafts stay local. The notes file becomes
the release body. The first line pins the green commit so the pre-tag
gate can fail closed on drift:

```
<!-- verified-sha: <full sha> -->
```

## Tag and title

- Tag: bare version (`0.7.0`) — Composer and Packagist read the tag.
- Release title: `v`-prefixed (`v0.7.0`) — cosmetic.
- Notes file: bare (`internal/release-notes-0.7.0.md`).

## Agent handoff

Agents stop at the ready-to-tag handoff. The user runs the pre-tag
gate and publishes the release (GitHub UI, `gh`, or otherwise). See
the `pre-release` skill for the full procedure and the no-release-create
rule.
