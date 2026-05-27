---
name: readme
description: "Author and maintain a high-quality README for a Composer package. Covers stub vs comprehensive shapes, voice, and staleness audits."
metadata:
  boost-tags: "release-automation"
---

# README authoring

## When to apply

- Bootstrapping a new package's README
- Asked to "audit", "refresh", or "improve" an existing README
- Reviewing a PR that touches README

## Two valid shapes

**Stub README** (for early-stage packages, <500 stars):
- One-paragraph description
- Install command
- Minimal usage example
- License + author

**Comprehensive README** (for established packages or ones with substantial API):
- Description + status badges
- Install + requirements
- Usage with multiple examples (basic, advanced, edge case)
- Configuration reference (link to dedicated docs if long)
- Testing/development section
- Contributing pointer
- Changelog pointer
- License + credits

Pick one shape consistently. Don't mix stub-tier and comprehensive-tier
sections in the same README.

## Voice

- Second-person ("Install with Composer", not "Users install via Composer")
- Present tense for current behavior, future tense only for genuinely unshipped work
- Avoid marketing language ("blazing fast", "powerful") — show, don't tell

## Anti-patterns

- Burying the install command below ten paragraphs of motivation
- Examples that don't actually run (always copy-pasteable)
- Stale "TODO" sections — delete them before publishing
- Duplicating CHANGELOG content in README

## Staleness audit

Quarterly: search for old version numbers, deprecated APIs, dead links,
and "coming soon" callouts. Either ship them or remove them.

## See also

- `release-notes` skill for GitHub release body writing
- `upgrading` skill for UPGRADING.md structure
