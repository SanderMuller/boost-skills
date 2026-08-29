---
name: readme
description: "Author and maintain a concise, high-quality README for a Composer package. Covers stub, comprehensive, and docs-site shapes (thin README + a docs/ site, for example VitePress on GitHub Pages), length budgets, curated coverage, voice, staleness audits, and docs index/link sync. Activates when: writing or auditing a README or a docs page, or when the user says the docs are too long, too verbose, over-explained, or asks to shorten or trim them."
metadata:
  boost-tags: "release-automation"
---

# README authoring

## When to apply

- Bootstrapping a new package's README
- Asked to "audit", "refresh", "improve", "shorten", or "trim" an existing README or docs page
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
- Usage examples for the **common** cases only — see the coverage tiers below, which decide what gets an example, a table row, or nothing
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
- Documentation section: the published site root URL stated once in prose, plus links to every page or to section entry points (pick one policy — see the index-sync rules below — and the link mechanics). Page links are navigation and do not count against the once rule
- Standard footer: contributing, changelog, security, credits, license

Pick one shape consistently. Don't mix tiers in the same README.

### Detecting the docs-site shape

A repo is docs-site shaped when `docs/` exists AND any of these signals identifies it as a generated site's source (in precedence order):

1. A generator config inside `docs/` (for example `docs/.vitepress/`, or a `docs/package.json` with a `build` script)
2. A root-level generator config or package script that names `docs/` as its source directory
3. A deploy workflow that builds from `docs/`

A plain-markdown `docs/` matching none of these is the comprehensive shape with linked docs, not the docs-site shape.

## Length is a constraint, not an outcome

A reader skims a README to install the package and get one thing working. Every sentence past that costs them. Write to a budget and cut to fit it — **the budget is not a target to fill**.

Counted the same way everywhere: **`wc -w` on the whole file** — code fences, tables and frontmatter included. One command, no judgement about what counts.

| Surface | Budget (`wc -w`) | Over it? |
|---|---|---|
| Stub README | ~350 words | Cut, or move to the comprehensive shape |
| Comprehensive README | ~900 words, hard ceiling ~1,200 | Move detail to a `docs/` site |
| Docs-site README | ~700 words | The README is restating a docs page — link instead |
| One docs page | ~800 words | Split it, turn prose into a table, or cut the low-value half |

Well-regarded packages in this ecosystem land inside those numbers, and they get there structurally, not by writing shorter sentences: the page is mostly code fences, tables, and one-line bullets, with prose only where it frames the next example.

**The count is whole-file; the cut is prose.** A page over budget because it carries several necessary examples is fine — cut the paragraphs around them first, and only then ask whether an example is redundant. Over budget is a signal to look, not an instruction to delete.

**The budget has a floor.** Never cut a security caveat, a data-loss or irreversibility warning, a required prerequisite or version constraint, an accessibility note, or a breaking-change pointer to hit a number. If a page is over budget and only load-bearing content remains, it is not too long — it is two pages. Trim rationale, motivation, and restated code before touching anything a reader can be harmed by missing.

Two structural rules do most of the work:

- **Reach a code block in under ~80 words** — on a README or a task page (install, usage, configuration). A reader who has to scroll past motivation to find the install line is being made to pay for the author's enthusiasm. A page with no task in it — a concept explainer, a security or accessibility note, a troubleshooting page — is exempt from this rule and from the prose-majority one below: prose is the right form there, and the word budget plus the paragraph cap still apply.
- **Cap a paragraph at ~100 words.** Count words between blank lines, not lines — a soft-wrapped file puts a 250-word wall on one line, so any line-based measure reads it as short. Healthy pages peak around 40–80 words per paragraph; a paragraph past ~100, or a section where paragraph words exceed the words in its code fences, tables and lists combined, is a defect. The content is skimmable as a list or table, or it is explaining something that does not need documenting at all.

## Coverage is curated — completeness is not the goal

Documenting every command, endpoint, option, and event is how a page becomes unreadable. Most of them are discoverable from the tool itself (`--help`, an IDE, a config file with comments), and a reader who needs the rare one will look there. **Reference material the tool already publishes does not need a prose copy.**

Sort every command / endpoint / option into three tiers and write to the tier:

Judge the tier from the repository, never from a guess about how many users need something:

| Tier | Repository evidence | Treatment |
|---|---|---|
| **Common** | On the critical path: named in the quickstart, the first example, or the default config | Prose + a runnable example |
| **Occasional** | Part of the documented public API or shipped config, but no example uses it | One table row: name, one-line effect. No example, no rationale |
| **Rare** | Not referenced by any example or default, and self-describing from `--help`, a typed signature, or a commented config key | Collapse it, or leave it out entirely |

**One tier overrides the other three: critical.** A prerequisite without which the package does not work, a security caveat, a destructive or irreversible operation, a data-loss risk, an accessibility requirement, and a compatibility limit are documented **in full and in place**, next to the action they govern — never collapsed, never demoted for being rare, never cut to meet a budget. Frequency does not apply to them: the reader who hits a data-loss case once is the reader who needed the sentence. Everything below is about the *rest* of the surface.

**"Undocumented" is a legitimate tier.** A rarely-used flag that behaves the way its name suggests needs no entry. Leaving it out is not an omission to apologise for in a "not documented here" note — say nothing.

### Collapse the long tail

Low-value material that has to exist — an exhaustive option table, a driver matrix, a long output sample, low-impact troubleshooting — goes inside `<details>`. Recovery steps stay visible: a failed upgrade, a restore, anything touching data loss or security is critical-tier and is never collapsed. It renders on GitHub and in the common static-site generators, and it keeps the page's skimmable line count low:

```markdown
<details>
<summary>All formatting options</summary>

| Option | Effect |
|---|---|
| `--format=json` | machine-readable output |
| `--format=table` | aligned columns |

</details>
```

Leave a blank line after `</summary>`, or the markdown inside renders as source.

### Explain "why" only where its absence causes a mistake

Rationale is the single biggest source of bloat, because every decision has one and each feels worth a sentence. It earns its place in exactly two cases:

- **A gotcha with a cost** — the reader will otherwise misuse the feature, lose data, or hit a failure they cannot diagnose.
- **A choice that looks wrong** — the surprising default, the one argument order that is not the obvious one.

Everything else gets the *what* and stops. "`--format=json` prints machine-readable output" is complete. Why JSON was chosen, how it is serialised, and which internal fields it omits are the author's context, not the reader's — and a paragraph defending a design decision belongs in an ADR or a release note, never in a usage section.

## Docs-site conventions

**No duplication.** Deep content lives in `docs/`; the README links to it, never restates it. If a section grows past a teaser, move it to a docs page and link.

**A docs site is not a licence to write more.** Moving content out of the README does not exempt it from the budgets above — the page limit, the ~100-word paragraph cap, the coverage tiers, and the why-rule all apply per docs page, and a site makes them matter more: a reader lands on one page from a search result and needs their answer on it. One page, one job. A page past ~800 words is usually two pages, or one page plus a collapsed reference table.

**Link mechanics.** README → docs links use absolute published-site URLs (for example `https://acme.github.io/example-package/installation`), not repo-relative paths to `docs/*.md`. This is the ecosystem convention — spatie/laravel-permission, spatie/laravel-medialibrary, livewire/livewire, inertiajs/inertia, and laravel/framework all link their READMEs to the published site. Absolute URLs render everywhere the README lands: GitHub, Packagist, IDE package viewers, forks, and the installed vendor copy — where `docs/` is export-ignored and a repo-relative link is dead.

Keep at most one repo-relative pointer to `docs/` as the source location (for example `[docs/](docs/README.md)`). Repo-relative links to individual pages are the non-recommended form — flag them in the audit.

The recommended `docs/` layout — a numeric `NN-` filename prefix so GitHub lists `docs/` in reading order, with generator rewrites stripping the prefix so published URLs stay stable when pages are reordered — is this skill's recommended layout (implemented with VitePress rewrites). It is about filenames, not link form.

**URL stability.** Prefix-stripping rewrites keep a published URL stable when only the `NN-` prefix changes (a reorder). They do NOT keep it stable when the slug itself changes — a slug rename needs an explicit legacy rewrite/redirect for the old route, or an accepted URL break. Because README links are absolute site URLs, a slug rename breaks them too, not only external inbound links.

**Index sync.** Every index/navigation surface the repo actually has must agree on the page inventory:

- The **canonical inventory** is the markdown pages in `docs/`, minus the index page itself and any files the generator config excludes from the site. Compare by source page after route normalization — a rewrite renames the published URL, it never drops a page.
- The **docs index** (`docs/README.md` or `docs/index.md`, when present) and an explicit **sidebar config** (when the generator uses one) must each cover the full inventory.
- A **top nav bar** lists sections/entry points by design — check it only for dead entries, never for full coverage.
- The **root README Documentation section** links every page, or only section entry points when the page count makes a full list unreadable — be consistent about which.

The full triple-index layout (README section + docs index + sidebar) is the recommended VitePress shape; a generator that auto-generates navigation or has no docs index page is checked only on the surfaces it has.

**Link audit.** Three link classes resolve differently — don't conflate them:

- **README → docs links** are absolute site URLs. They cannot be validated on disk — check each one against a route the generator actually produces (the source page after slug and rewrite normalization). On-disk resolution still applies to the single repo-relative `docs/` source pointer and to non-docs repo links (`UPGRADING.md`, `CONTRIBUTING.md`, `LICENSE.md`). Flag repo-relative links to individual docs pages as the non-recommended form.
- **Site-internal links inside `docs/`** resolve through the generator's routing. Under active rewrites a valid link may name the rewritten route, not an existing file — the docs build is authoritative for these; manually flag only links that match neither a source file nor a configured route.
- **Asset references** follow the generator's asset rules.

In-page anchors are best-effort. Dead external URLs belong to the staleness audit below.

## Voice

- Second-person ("Install with Composer", not "Users install via Composer")
- Present tense for current behavior, future tense only for genuinely unshipped work
- Avoid marketing language ("blazing fast", "powerful") — show, don't tell
- Beat the **curse of knowledge on the critical path**: install, first working example, and the one gotcha that breaks people. Spell out the prerequisite you have internalised *there*. This is not a mandate to explain every flag — applied page-wide it is the main cause of bloat, and it is bounded by the coverage tiers and the why-rule above.

## Anti-patterns

- Padding the README with motivation prose — **omit needless words**; every sentence should help a reader install or use the package
- Burying the install command below ten paragraphs of motivation
- Examples that don't actually run (always copy-pasteable)
- Stale "TODO" sections — delete them before publishing
- Duplicating CHANGELOG content in README
- Documenting every command, endpoint, or option because it exists — coverage is curated, and "undocumented" is a tier
- A paragraph explaining why a low-importance detail works the way it does
- Restating in prose what the code block below already shows
- A "Features" list that renames the table of contents
- Announcing what a section will cover before covering it
- (Docs-site shape) Restating a docs page's content in the README, or stating the site root URL more than once in prose (page links to the site don't count)

## Staleness audit

**At every release** (`pre-release` runs it), and quarterly when releases are less frequent: search for old version numbers, deprecated APIs, dead links, and "coming soon" callouts. Either ship them or remove them.

### Verbosity audit

Run this with the staleness scan — docs rot by growing, not only by aging. Every release adds a paragraph, and nothing ever removes one.

- **Over budget** — a README or docs page past its word budget. Cut or split; do not leave it because "it is all true".
- **Prose-majority sections** — paragraph words exceeding the section's code, table and list words. Convert or cut. Exempt: a page with no task in it (concept, security, accessibility, troubleshooting), where prose is the right form.
- **Paragraphs past ~100 words** — count words between blank lines; a line-based check misses a soft-wrapped wall entirely.
- **Rationale on low-importance detail** — a why that does not prevent a mistake. Delete the sentence, keep the what.
- **A long tail written out in full** — an exhaustive option or driver table sitting inline. Collapse it.
- **Detail written above its tier** — an option given prose and an example while the code shows it is not on the critical path: not referenced by the package's own quickstart or examples, not part of the documented public API, and discoverable from `--help`, a typed signature, or a commented config file. Demote it a tier. Judge this from the repository, never from a guess about what users have asked — and never demote anything in the critical tier.

Deleting text is the deliverable here. A page that only ever grows is a page people stop reading.

For the docs-site shape, the audit also covers `docs/`:

- The same staleness scan over every docs page
- The index-sync check (all existing surfaces agree on the inventory)
- The link audit (README site links match generator routes; repo-relative pointers and asset references resolve; site-internal links per the generator's routing)

## See also

- `humanizer` skill for the prose-level AI tells (inflated significance, hedging, rule-of-three) this skill's budgets don't catch
- `release-notes` skill for GitHub release body writing
- `upgrading` skill for UPGRADING.md structure
- `pre-release` skill runs this skill's staleness + docs-site audits at every release
