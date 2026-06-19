---
name: release-notes
description: "Draft GitHub release bodies for Composer packages. Covers structure, voice, breaking-change callouts, and what to omit."
metadata:
  boost-tags: "release-automation"
---

# Release notes

## When to apply

- Asked to draft a GitHub release body
- Reviewing a PR that bumps the version
- Asked to "summarize what's new" for a tag

## Structure

Top-level sections at `## `; no umbrella heading. Omit any section with no entries.

```
## Breaking

- (only if MAJOR or pre-1.0 minor with breaking change — be explicit)

## Added

- (new features, new public API surface)

## Changed

- (behavior changes, content updates that aren't bug fixes)

## Fixed

- (bug fixes, security fixes)

## Internal

- (refactors, dev-only changes, dep bumps — keep terse)

**Full changelog:** v1.2.3...v1.3.0
```

**No leading version heading** (`# 1.2.3`). The GitHub release page already shows the version as its title; repeating it in the body is duplicate.

**No marketing-tone, audit-narration, or framework-fold-in intro paragraphs.** Don't lead with "This release ships X, Y, Z..." (summarizes; the section list already covers it), "Polish-tier patch bundling..." (internal classification), "Validates the asymmetric-cadence frame..." (internal pattern-tracking), or audit-narration of how the work was produced.

A short opening paragraph (or a `## Why this matters` / `## Background` section) IS OK when the release closes a non-obvious bug class, changes user-visible behavior in a way the section-list can't fully explain, or names the upgrade-decision context (e.g. "Operators on Laravel projects who wired X experienced silent Y"). The test: does the paragraph give a reader information they need to decide whether/how to upgrade, beyond what the section list already conveys? If yes, keep it terse and informational. If no, drop it.

**Bullets by default, paragraphs only when justified.** A bullet should be one line. If a change needs context that doesn't fit, the bullet can include a second sentence; a full paragraph is justified only when a behavior or migration genuinely needs prose explanation. Long prose embedded in bullets reads as audit-narration, not release notes.

## Voice

- Past tense ("added X", "fixed Y")
- One entry per change, one line each. If it needs two lines, the second one carries operational consequence (migration step, version requirement, deprecation timeline), not narrative context.
- Link PR numbers: `Added foo (#42)`
- Credit external contributors: `Added foo (#42) — thanks @contributor`

## Breaking changes

Always callout breaking changes explicitly with migration code:

```
## Breaking

- Renamed `Foo::oldMethod()` to `Foo::newMethod()`. Migrate:
  ```php
  // before
  $foo->oldMethod($arg);
  // after
  $foo->newMethod($arg);
  ```
```

## Adoption / upgrade block (optional)

If the release has a notable adoption shape (constraint bump + migration command, new vendor floor, etc.), close with a short fenced block — NOT a section heading + prose. Three-line code block beats a 20-line paragraph.

```
composer require --dev "vendor/package:^1.2"
vendor/bin/whatever migrate
```

If adoption is the same as the prior version (just `composer update`), omit the block entirely.

## Anti-patterns

Conceptual quality issues — see "What to omit" below for the specific structural things to leave out.

- "Various improvements" — useless. Be specific.
- Marketing tone ("massive new feature!") — let users decide what's massive.
- Burying breaking changes in "Internal".
- Duplicating commit messages verbatim — synthesize, don't transcribe.

## What to omit

**Omit needless words** — aggressively. Release notes are for developers checking what changed; everything else is bloat.

**Always omit:**

- **Leading `# <version>` heading** — release title covers it.
- **Marketing-tone / audit-narration / framework-fold-in opening paragraphs** before the first `## ` section. A short value-add intro explaining a non-obvious bug class or upgrade-decision context is fine — see "No marketing-tone..." in Structure above.
- **`## Requires` / `## Dependencies` saying "unchanged from prior".** If nothing changed, don't write the section.
- **`## Validation` / quality-gate counts** ("27/27 skills + 1/1 guideline manifest valid", "PHPStan baseline drift: none"). CI green is implied; consumers don't read release notes for QA evidence.
- **`## Acknowledgments` / pattern-tracking sections** ("Ships absorption-pattern data point #2", "Validates the asymmetric-cadence frame"). Internal observation — belongs in strategy docs or internal notes.
- **`## Internal` quality-gate detail** ("No PHPStan baseline drift, no schema changes"). Same — implied by passing CI.
- **Dogfooding narrative** ("Bug surfaced during proving consumer's adoption cycle when..."). Bullet the FIX; don't narrate the discovery.
- **Process choreography** (named release cadences, "Per the load-bearing-only floor-pin rule we codified..."). Internal framework, not developer-facing.
- **Peer-handle credits / internal session IDs.** Real-name or @-handle credits OK; internal peer codes (`b020i4st` etc.) never.
- **Dependency bumps to other packages** unless they affect users — then callout the implication, not the bump.
- **Internal test refactors, README typo fixes.**
- **"Unchanged from prior" segments** in any section. If it's unchanged, don't list it.

## Verified-sha line

Pre-release tooling (`pre-release` skill, step 7) requires the first line of the notes file to be an HTML comment recording the green CI SHA:

```markdown
<!-- verified-sha: 4387b6845b45def9c6ad80e638990f81b74bfb19 -->

## Changed

...
```

HTML comments are stripped by GitHub on render — the line is invisible in the published release body. It's an internal verification anchor for the pre-tag gate, not user-facing content. Keep it as the first line; do not promote it to a visible section.

**The SHA must be a real, green commit — never a placeholder.** Do not write `<!-- verified-sha: TODO -->`, `REPIN-TO-GREEN-SHA`, or a SHA recycled from the previous version's notes. A placeholder is not a "draft in progress" — it is a notes file that defeats the pre-tag gate (which matches this line against live HEAD). If you don't yet have the green SHA from `pre-release` step 6, you are not ready to write this file at all.

**Do not write or edit this file before `pre-release` step 6 is green on the actual release commit.** This skill owns the notes' *content*; `pre-release` owns *when* the file may exist. The two rules that have bitten us: (1) a notes file carried over from the last version is **deleted and redrafted**, never edited in place pre-green — "fixing the content" of a stale file still produces a premature, placeholder-pinned draft; (2) in a PR-based release the green commit is the **post-merge** commit on the release branch, not the feature-branch tip, so the SHA you pin comes from re-running step 6 after the PR merges.

## Example — good shape

Section order follows the Structure list (Breaking → Added → Changed → Fixed → Internal). Sections without entries are omitted.

```markdown
<!-- verified-sha: 4387b6845b45def9c6ad80e638990f81b74bfb19 -->

## Added

- `CONTRIBUTING.md` patterns section codifying the wording-revert-as-regression-test pattern and the meta-rule for when to codify patterns (wait for 2-3 occurrences across distinct contexts).

## Changed

- Diagnostics header renamed to `Diagnostics` (from the legacy conventions-only label). Now covers conventions, stale-removal info, Copilot strip info, and render-fail warnings.

## Fixed

- `SyncCommand` now renders diagnostics before the error short-circuit. Previously, top-level errors hid the safety-gate reassurance alongside them.

**Full Changelog**: https://github.com/SanderMuller/boost-core/compare/0.9.3...0.9.4
```

Versus the verbose shape that triggered this guidance — same release, ~3× the length, opens with a 4-line audit paragraph, embeds dogfooding narrative inside `## Fixed`, ships an `## Internal` section consisting of "no drift, no changes, no surface changes" tautologies. Same information density, ~30% as readable.
