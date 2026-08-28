---
name: release-notes
description: "Draft GitHub release bodies for Composer packages. Covers structure, length budget, voice, breaking-change callouts, and what to omit. Activates when release notes read too long, too verbose, or over-explained."
metadata:
  boost-tags: "release-automation"
---

# Release notes

## When to apply

- Asked to draft a GitHub release body
- Reviewing a PR that bumps the version
- Asked to "summarize what's new" for a tag

## Structure

The whole body is a list of bullets under `## ` sections. The only other elements allowed anywhere: fenced code blocks under a bullet, the optional adoption block, the changelog link, and the first-line `verified-sha` comment that `pre-release` requires. Nothing else — no intro, no `###`, no paragraphs.

```
## Breaking

- (any breaking change, whatever the version bump — be explicit)

## Added

- (new features, new public API surface)

## Changed

- (behavior changes, content updates that aren't bug fixes)

## Fixed

- (bug fixes, security fixes)

## Internal

- (refactors, dev-only changes, dep bumps — one line each, three bullets at most)

**Full changelog:** v1.2.3...v1.3.0
```

Hard rules. Each one is checkable — do not reason around them.

- **Only these five sections**, in this order, at `## `. Omit any section with no entries. Do not invent a section (`## Performance`, `## Why this matters`, `## Background`, `## Validation`, `## Acknowledgments`). A performance change is an `## Added` or `## Changed` bullet.
- **No `###` heading anywhere.** A change is a bullet, never a titled subsection. A `###` per change is what turns notes into essays.
- **No prose before the first `## ` section.** No intro paragraph, ever — not for context, not for an upgrade decision, not for a bug class. If a reader needs it to upgrade, it is one bullet under `## Breaking` or `## Changed`.
- **No paragraph anywhere.** Only bullets, code fences, the optional adoption block, and the changelog link. The adoption block sits after the last section and before the changelog link; nothing else goes between sections.
- **One bullet per change, one line, 20 words or less.** A second line, or a fenced migration block under the bullet, is allowed only for an operational consequence: a migration command, a version floor, a deprecation date. Never for context or reasoning. **On a critical bullet the continuation may be ordinary prose** — a data-loss condition or an exposure statement does not always fit a command — but it stays a continuation of that bullet.
- **Critical content is exempt from the word limits, and from nothing else.** A breaking change's migration, a security fix's impact and affected versions, a data-loss or irreversibility warning, an accessibility regression or requirement, and a required prerequisite or version floor are written in full — over 20 words if completeness takes it — and are excluded from the average. They stay **inside a bullet or its indented continuation**: the bullets-only shape, the section list, and the no-`###` rule bind them like everything else. Completeness buys words, never a paragraph. This body becomes the `CHANGELOG.md` entry a consumer reads to decide whether to upgrade; a rule that trims it is a rule that hurts them. Everything else obeys the budget.
- **Budget: 15 words per bullet on average.** That average is the binding rule and never scales. Count bullets only — code fences, the adoption block, the changelog link, and the verified-sha comment do not count. A typical release of up to 10 bullets therefore lands under 150 words; a release with 30 real changes is allowed 30 bullets. Over the average means the changes are over-explained, never that the release is big.

## Voice

- Past tense ("added X", "fixed Y")
- Say the delta the consumer sees. Not the cause, not the mechanism, not the measurement.
- Link PR numbers: `Added foo (#42)`
- Credit external contributors: `Added foo (#42) — thanks @contributor`

```
❌ `SyncCommand` compared paths with a string cast, so a Windows host resolved a
   different destination than the one the emitter reported. A shared normalizer
   now runs first, which makes both sites agree. Measured against 6 real repos.
✅ Fixed `SyncCommand` writing to the wrong destination on Windows (#42).
```

## Breaking changes

Always callout breaking changes explicitly, with the migration the consumer has to make. Usually that is code, but a removal, a version floor, or a replacement name works the same way:

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

## Security fixes

A security fix is a `## Fixed` bullet that names **what an attacker could do, who is exposed, and which versions are affected**, and links the advisory. A reader of `CHANGELOG.md` must be able to judge urgency without leaving the file. The advisory holds the rest — reproduction, exploit conditions, credit, timeline — and that is what is not restated here.

```
## Fixed

- Fixed stored XSS via unescaped output in `Renderer::render()`: any user-supplied string rendered to a page could execute script. Affects 1.0.0–1.4.2, all installs using the renderer. See GHSA-xxxx-xxxx-xxxx.
```

## Adoption / upgrade block (optional)

If the release has a notable adoption shape (constraint bump + migration command, new vendor floor, etc.), close with a short fenced block — NOT a section heading + prose. Three-line code block beats a 20-line paragraph.

```
composer require --dev "vendor/package:^1.2"
vendor/bin/whatever migrate
```

If adoption is the same as the prior version (just `composer update`), omit the block entirely.

## Anti-patterns

- "Various improvements" — useless. Be specific.
- Marketing tone ("massive new feature!") — let users decide what's massive.
- Burying breaking changes in "Internal".
- Duplicating commit messages verbatim — synthesize, don't transcribe.

## What to omit

**Omit needless words** — aggressively. Release notes are for developers checking what changed; everything else is bloat. The PR and the commit carry the story.

**Always omit:**

- **Leading `# <version>` heading** — release title covers it.
- **Every opening paragraph.** Marketing tone, audit narration, framework fold-in, bug-class framing, upgrade framing. There is no case where prose before `## Breaking` earns its place.
- **Mechanism narration** — why the old code was wrong, what it compared against, how the fix works inside, what it was measured on, how many cases it rejected. State the delta; the PR holds the diagnosis.
- **Root-cause and discovery stories** ("Surfaced from a production import profiling…", "Bug surfaced during a consumer's adoption cycle…"). Bullet the FIX.
- **Tables** explaining a decision matrix or a benchmark grid. A table in a release body is an essay in disguise. (An exception: a block a tool injects between markers, for example `<!-- benchmark-start -->`. That is tooling output, not drafting.)
- **`## Requires` / `## Dependencies` saying "unchanged from prior".** If nothing changed, don't write the section.
- **`## Validation` / quality-gate counts** ("27/27 skills valid", "PHPStan baseline drift: none"). CI green is implied.
- **`## Acknowledgments` / pattern-tracking sections** ("Ships absorption-pattern data point #2"). Internal observation — belongs in strategy docs.
- **`## Internal` quality-gate detail** and refactor essays. Internal entries are one line each, three at most, or the section goes.
- **Process choreography** (named release cadences, "Per the load-bearing-only floor-pin rule we codified…").
- **Peer-handle credits / internal session IDs.** Real-name or @-handle credits OK; internal peer codes (`b020i4st` etc.) never.
- **Dependency bumps to other packages** unless they affect users — then callout the implication, not the bump.
- **Internal test refactors, README typo fixes.**
- **"Unchanged from prior" segments** in any section.

## Pre-publish gate

Run this against the drafted file. Any `no` is a rewrite, not a judgment call.

1. Zero `###` headings?
2. Zero prose lines outside a bullet, a code fence, the adoption block, the changelog link, or the first-line verified-sha comment?
3. Every `## ` heading one of Breaking / Added / Changed / Fixed / Internal?
4. Every non-critical bullet 20 words or less? A second line or a fenced block — allowed under a bullet in any section — carries only a command, code, a version, or a date, unless the bullet is critical, where prose is allowed?
5. **Non-critical** bullets averaging 15 words or less? (Critical bullets — breaking migration, security impact, data-loss warning, accessibility regression, required prerequisite — are excluded from the count, never shortened to pass it.)
6. Does every bullet outside `## Internal` name what a consumer sees, with no clause explaining the cause, the mechanism, or the measurement? (`## Internal` names the dev-only change itself, under the same word budget. A **security** bullet is exempt: attacker capability, exposure, affected versions — and the mechanism where it is what tells a reader whether they are exposed — are required, not narration.)

15 words is this package family's budget. Its calibration and its operational rule are measured differently, and conflating them is how a draft passes on paper:

- **The calibration** divided each release body's *whole* word count by its bullet count, across the five most recent releases of `phpstan/phpstan`, `rectorphp/rector`, `livewire/livewire` and `spatie/laravel-data` on 2026-08-29. Nineteen of twenty landed between 10 and 17 words per bullet; the highest was 30. It is crude — headings, code, and links inflate it — and those repos do publish longer bodies, so treat it as a sanity range, not a standard.
- **The rule to apply** counts bullet words only. Deterministically: take the lines starting `- ` or `* ` and their indented continuations, drop every critical bullet, strip fenced blocks, and `wc -w` what remains — a markdown link counts as its visible text plus its URL, a code span as its words, exactly as `wc -w` sees them. Divide by the number of bullets kept.

The two numbers are not comparable, and the second is the one a draft is judged on. A draft at 60+ words per bullet on either measure is narrating.

## Name what a regression would look like

The omit-list above says to leave quality-gate counts out. This is what to write instead.

A consumer cannot check `387 tests, 937 assertions`. They can check a behaviour. For a fix worth
explaining, one clause naming the observable that would change if it regressed is worth more than
any aggregate:

- ❌ `Verified: 387 tests, 937 assertions. PHPStan level max, CI green across the matrix.`
- ✅ `Regressed, this reports the omitted line count and names no path to the output.`

The test: could a reader who installed the package confirm this from outside, without the suite? A
Composer dist usually ships `src/` only, so a consumer reasons about a fix's *class* rather than
reading its test — the clause is the only part that reaches them. The aggregate is checkable by
nobody, and it appears in every release, which is what makes it noise rather than evidence.

Not every bullet needs one. A renamed method or a doc correction has no observable to name. Reach
for it where a reader might reasonably ask "did that actually get fixed" — the bug classes that
recur, and the ones whose symptom is silence.

This is not an invitation to describe the test. Name the behaviour, not the assertion.

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

- Added a `--dry-run` flag to `boost sync` (#118).

## Changed

- Renamed the sync report header to `Diagnostics`, which now also lists stale removals (#121).

## Fixed

- Fixed diagnostics being hidden when sync exited on a top-level error (#124).
- Fixed `SyncCommand` writing to the wrong destination on Windows (#126).

**Full Changelog**: https://github.com/SanderMuller/boost-core/compare/0.9.3...0.9.4
```

That is 4 changes in 44 bullet words. The published prose version of that release ran 392 words: a 5-line opening paragraph, a `###` heading per change, the root cause and discovery story of each one, and an `## Internal` section of "no drift, no schema changes" tautologies. Same four changes, 392 words of body against 44.
