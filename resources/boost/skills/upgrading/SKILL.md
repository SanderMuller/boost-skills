---
name: upgrading
description: "Canonical structure for UPGRADING.md in a Composer package. When to maintain one, what to put in it."
metadata:
  boost-tags: "release-automation"
---

# Upgrading

## When to apply

- Asked to write/update an UPGRADING.md
- Shipping a MAJOR or breaking minor release
- Pre-1.0 package with breaking change

## When to maintain UPGRADING.md

You need one if:
- You ship MAJOR releases with breaking changes
- Pre-1.0 minor bumps regularly break public API
- Migration involves more than "find/replace one symbol"

You DON'T need one if:
- Your package is fully additive (CHANGELOG is enough)
- Pre-1.0 alpha and you don't care about backporting

## Structure

```markdown
# Upgrading

## From 1.x to 2.0

### Removed

- `Foo::oldMethod()` — use `Foo::newMethod()` instead.
  ```php
  // before
  $foo->oldMethod($x);
  // after
  $foo->newMethod($x);
  ```

### Changed

- `Foo::doIt()` now returns `Result` instead of `bool`.
  Adapt callers:
  ```php
  // before
  if ($foo->doIt()) { /* ... */ }
  // after
  $result = $foo->doIt();
  if ($result->ok()) { /* ... */ }
  ```

### Added (no migration needed)

- (briefly list to spare users from chasing the CHANGELOG)
```

## Voice

- Imperative ("Replace X with Y") not narrative ("We've changed X to Y")
- Code blocks for every migration with concrete before/after
- Section per major version range. Append, never rewrite history.

## Anti-patterns

- "Migration is automatic" with no rector rule shipped — users want
  proof, not promises
- Stale entries from versions nobody uses anymore (compact after 2 majors)
- Duplicating CHANGELOG — UPGRADING is about *how to migrate*, not
  *what changed*
