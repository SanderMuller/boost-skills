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
