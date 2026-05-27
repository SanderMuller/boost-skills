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

```
## What's changed

### Breaking
- (only if MAJOR or pre-1.0 minor with breaking change — be explicit)

### Added
- (new features, new public API surface)

### Fixed
- (bug fixes, security fixes)

### Internal
- (refactors, dev-only changes, dep bumps — keep terse)

**Full changelog:** v1.2.3...v1.3.0
```

Omit sections that have no entries. Don't write "(none)".

## Voice

- Past tense ("added X", "fixed Y")
- One entry per change, one line each. If it needs two lines, link to a PR.
- Link PR numbers: `Added foo (#42)`
- Credit external contributors: `Added foo (#42) — thanks @contributor`

## Breaking changes

Always callout breaking changes explicitly with migration code:

```
### Breaking

- Renamed `Foo::oldMethod()` to `Foo::newMethod()`. Migrate:
  ```php
  // before
  $foo->oldMethod($arg);
  // after
  $foo->newMethod($arg);
  ```
```

## Anti-patterns

- "Various improvements" — useless. Be specific.
- Marketing tone ("massive new feature!") — let users decide what's
  massive.
- Burying breaking changes in "Internal"
- Duplicating commit messages verbatim — synthesize, don't transcribe

## What to omit

- Dependency bumps to other packages (unless they affect users — then
  callout the implication, not the bump)
- Internal test refactors
- README typo fixes
