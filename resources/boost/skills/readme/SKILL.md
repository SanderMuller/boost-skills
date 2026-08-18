---
name: readme
description: "Author and maintain a high-quality README for a Composer package. Covers stub, comprehensive, and docs-site shapes (thin README + a docs/ site, for example VitePress on GitHub Pages), voice, staleness audits, and docs index/link sync."
metadata:
  boost-tags: "release-automation"
---

# README authoring

## When to apply

- Bootstrapping a new package's README
- Asked to "audit", "refresh", or "improve" an existing README
- Reviewing a PR that touches README
- The package moves its documentation to a `docs/` site (for example VitePress, published on GitHub Pages)

## Three valid shapes

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

**Docs-site README** (for packages whose documentation lives in a `docs/` site):
- Description + status badges
- One-paragraph pitch + a copy-pasteable teaser example
- Install + requirements
- One minimal usage example
- Documentation section: the published site URL stated exactly once, plus links to every page or to section entry points (pick one policy — see the index-sync rules below — and the link mechanics)
- Standard footer: contributing, changelog, security, credits, license

Pick one shape consistently. Don't mix tiers in the same README.

### Detecting the docs-site shape

A repo is docs-site shaped when `docs/` exists AND any of these signals identifies it as a generated site's source (in precedence order):

1. A generator config inside `docs/` (for example `docs/.vitepress/`, or a `docs/package.json` with a `build` script)
2. A root-level generator config or package script that names `docs/` as its source directory
3. A deploy workflow that builds from `docs/`

A plain-markdown `docs/` matching none of these is the comprehensive shape with linked docs, not the docs-site shape.

## Docs-site conventions

**No duplication.** Deep content lives in `docs/`; the README links to it, never restates it. If a section grows past a teaser, move it to a docs page and link.

**Link mechanics.** README → docs links use repo-relative paths to the actual source pages (for example `docs/01-installation.md`) so GitHub renders them. The recommended layout — a numeric `NN-` filename prefix so GitHub lists `docs/` in reading order, with generator rewrites stripping the prefix so published URLs stay stable when pages are reordered — is this skill's recommended layout (implemented with VitePress rewrites), not a requirement on link form: link whatever the source pages are actually named.

**URL stability.** Prefix-stripping rewrites keep a published URL stable when only the `NN-` prefix changes (a reorder). They do NOT keep it stable when the slug itself changes — a slug rename needs an explicit legacy rewrite/redirect for the old route, or an accepted URL break.

**Index sync.** Every index/navigation surface the repo actually has must agree on the page inventory:

- The **canonical inventory** is the markdown pages in `docs/`, minus the index page itself and any files the generator config excludes from the site. Compare by source page after route normalization — a rewrite renames the published URL, it never drops a page.
- The **docs index** (`docs/README.md` or `docs/index.md`, when present) and an explicit **sidebar config** (when the generator uses one) must each cover the full inventory.
- A **top nav bar** lists sections/entry points by design — check it only for dead entries, never for full coverage.
- The **root README Documentation section** links every page, or only section entry points when the page count makes a full list unreadable — be consistent about which.

The full triple-index layout (README section + docs index + sidebar) is the recommended VitePress shape; a generator that auto-generates navigation or has no docs index page is checked only on the surfaces it has.

**Link audit.** Three link classes resolve differently — don't conflate them:

- **README → docs links** target source files (GitHub rendering) and must resolve on disk.
- **Site-internal links inside `docs/`** resolve through the generator's routing. Under active rewrites a valid link may name the rewritten route, not an existing file — the docs build is authoritative for these; manually flag only links that match neither a source file nor a configured route.
- **Asset references** follow the generator's asset rules.

In-page anchors are best-effort. Dead external URLs belong to the staleness audit below.

## Voice

- Second-person ("Install with Composer", not "Users install via Composer")
- Present tense for current behavior, future tense only for genuinely unshipped work
- Avoid marketing language ("blazing fast", "powerful") — show, don't tell
- Beat the **curse of knowledge**: write for a reader who lacks your context. Spell out the prerequisite, the why, and the gotcha you've internalised — the author always knows more than the page shows.

## Anti-patterns

- Padding the README with motivation prose — **omit needless words**; every sentence should help a reader install or use the package
- Burying the install command below ten paragraphs of motivation
- Examples that don't actually run (always copy-pasteable)
- Stale "TODO" sections — delete them before publishing
- Duplicating CHANGELOG content in README
- (Docs-site shape) Restating a docs page's content in the README, or stating the site URL more than once

## Staleness audit

Quarterly: search for old version numbers, deprecated APIs, dead links,
and "coming soon" callouts. Either ship them or remove them.

For the docs-site shape, the audit also covers `docs/`:

- The same staleness scan over every docs page
- The index-sync check (all existing surfaces agree on the inventory)
- The link audit (README → docs links and asset references resolve; site-internal links per the generator's routing)

## See also

- `release-notes` skill for GitHub release body writing
- `upgrading` skill for UPGRADING.md structure
- `pre-release` skill runs this skill's staleness + docs-site audits at every release
