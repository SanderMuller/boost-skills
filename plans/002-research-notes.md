# Plan 002 — Research notes (design de-risking before implementation)

Investigation done 2026-07-03 against commit `d850d7d` (plus edits from plans
001/003–006 applied to the working tree). Purpose: resolve the open design
questions in `plans/002-catalog-invariant-check.md` before writing code, so the
implementer builds the right thing once. **No code was written for 002 yet** —
this is the sharpened spec input.

## The four questions and what the investigation settled

### 1. Harness: plain-PHP, not Pest. **Decided.**

- `boost-skills` has **no test runner** — no `pestphp/pest`/`phpunit`, no
  `tests/`, no `Pest.php`/`phpunit.xml`, no `test` composer script (only
  `post-install-cmd`/`post-update-cmd`). It is a resources-only catalog.
- The sibling source-shipping family packages (`boost-core`,
  `package-boost-php`) *do* use **Pest 4** (`vendor/…/composer.json`), but they
  ship PHP source that needs unit testing. This package doesn't.
- The existing gate is a **plain-PHP script** (`.github/validate-skills.php`)
  run directly by CI. Adding Pest + config + a `tests/` tree just for one
  drift check is disproportionate and diverges from the established pattern.
- **→ Build the checker as plain PHP in the same style as
  `.github/validate-skills.php`.** (This also means the "keep `collision`/`pao`
  to justify a test suite" angle from backlog #11 is weak — plain-PHP needs
  neither; #11 leans toward *removing* them unless a Pest suite is separately
  wanted.)

### 2. Reuse an existing boost-core command? No — none fit. **Decided: standalone.**

`vendor/bin/boost` exposes `doctor`, `validate`, `slots`, `paths`, `tags`,
`sync`, `scan`, etc. Every consistency-checking command is **consumer-side**
(validates a *consuming project's* `boost.php`/emitted files), not
**catalog-author-side** (validating *this repo's* README tables against its own
`resources/`):

- `doctor` is **advisory-only and exits 0 even on drift**; its "Drift" section
  means "emitted agent files vs their sources", not README drift. Its checks
  are hard-wired, not pluggable.
- `validate --strict` gates a *consumer's* `withConventions([...])` against
  vendor schemas — not the author's tables.
- The only extension seam is **`FileEmitter`** (a *write* hook registered via
  `extra.boost.emitters`), which cannot register validation/diagnostics.
- **→ The drift-checker cannot be a boost-core command extension. It is a
  standalone script this repo owns.**

### 3. Overlap with `stolt/skill-validator`? None. **Confirmed complementary.**

`skill-validator` validates **one SKILL.md's frontmatter *format*** — allowed
top-level fields, `name` regex/length, `description` length, list/bool type
checks. It treats `metadata` as opaque, **never inspects `metadata.boost-tags`**,
and has **zero cross-file/catalog awareness** (never sees the README, the
sidecar, the schema, or sibling skills).
- **→ `metadata.boost-tags` is entirely unguarded today.** The new checker owns
  exactly the gap skill-validator leaves: catalog-level cross-file consistency.
  No dedup needed; keep running both.

### 4. Validate vs. generate the README tables? **Validate.** And the
conv-token→schema check is feasible + reusable. **Decided.**

- **Generation is not viable**: the README Skills/Guidelines "What it does"
  column is **editorial** (verified — it differs from the frontmatter
  `description`, e.g. `pull-requests`). You can't regenerate a table whose prose
  is hand-written. The mechanically-derivable parts are the **Tags column** and
  **row inventory**. → *Validate* those; leave the prose alone.
- **conv-token→schema is checkable** and worth adding. There are 24 distinct
  `boost:conv path="…"` values across skill bodies; every root segment
  (`jira`, `github`, `testing`, `pr`, `spec`, `codex`, `quality`, `branches`,
  `review`, `fixtures`, `translations`, `mcp`) maps to a `properties` key in
  `resources/boost/conventions-schema.json`. Nesting supports tiered strictness:
  groups like `jira`/`github`/`testing` have `additionalProperties: false` (so
  sub-keys like `jira.project_key` are fully validatable), while `mcp` is
  open-vocab (`additionalProperties: {type: string}` — validate root only).
- **Reuse path** (optional, for exact engine parity): load the repo's own
  `resources/boost/conventions-schema.json`, wrap it in
  `SanderMuller\BoostCore\Conventions\VendorSchemaSource`, compose via
  `ConventionsSchema::compose()`, then `SlotResolver::resolve($path, $mode, null)`
  and check `->isError()`. **Do NOT use `SchemaDiscovery`** — it walks the
  installed vendor tree and explicitly skips the repo-under-development's own
  schema, so it won't see this catalog's slots.
- **Simpler sufficient path** (recommended for v1): `json_decode` the schema,
  recursively collect `properties` keys (+ open `additionalProperties` roots),
  regex-extract `path="…"` from each SKILL.md, and diff. Sidesteps the
  runtime-resolution machinery, which is oriented at resolving against a
  *consumer config* rather than static slot existence. Note: boost-core's
  per-token extractors are `private`, so token *extraction* is a small local
  regex either way.

## Sharpened invariant set (tiered)

**Tier 1 — the core (already in plan 002; catches the three shipped drifts):**
1. Each skill dir's `SKILL.md` `name` == dir name.
2. README `## Skills` Tags cell token-set == that skill's `metadata.boost-tags` set (empty ⇔ `—`).
3. Skill inventory is bijective: every skill dir ↔ exactly one README Skills row (no missing, no phantom).
4. Guideline files ↔ README `## Guidelines` rows ↔ `.boost-tags.yaml` are mutually consistent (bijective inventory; tag cell == sidecar tags, untagged ⇔ `—`).

**Tier 2 — cheap, high-value additions the research surfaced (recommend
including in the first implementation):**
5. Every `metadata.boost-tags` token and every sidecar tag is a documented tag
   in the README `## Tags` table vocabulary (catches an undocumented/typo tag —
   this is the *other* direction from #2, guarding the vocabulary itself).
6. Every `boost:conv path="…"` root segment resolves to a `conventions-schema.json`
   property; for closed groups (`additionalProperties: false`), the sub-key must
   exist too; `mcp.*` validated at root only (open-vocab).
7. `metadata.schema-required` is present iff the skill body uses any `boost:conv`
   token (verified to hold today: all conv-using skills carry it, none else) —
   cheap invariant, prevents a conv-using skill shipping without its schema floor.

**Tier 3 — defer (note in maintenance, spec later if wanted):**
- README `### Slot groups (v1)` table ↔ schema `properties` (and its "Used by
  skills" column ↔ actual conv usage).
- Cross-skill reference resolution (the REF-01/02 findings): every ``the `X`
  skill`` mention resolves to a shipping skill under a compatible tag set.

## Net changes to plan 002

- **Harness**: confirmed plain-PHP (was "recommend plain-PHP" — now settled with
  evidence). Keep it a **separate** `.github/validate-catalog.php` invoked as a
  second CI `run:` step (clean failure attribution), sharing validate-skills.php's
  style. Folding into validate-skills.php is acceptable but muddies attribution.
- **Scope up**: promote invariants #5–#7 from "deferred" into the first
  implementation — they're cheap and each guards a real, currently-unguarded
  surface. The conv-token check (#6) is the biggest value-add and is feasible
  today.
- **Reuse note**: added the exact boost-core classes to (optionally) reuse for
  #6 and the `SchemaDiscovery` caveat, so the implementer doesn't rediscover it.
- **Effort**: still **M**, but better bounded — no test-runner standup, and the
  hardest sub-task (schema-slot validation) has a proven simple path.
- **Dependency**: unchanged — still depends on plan 001 landing first.

## Recommendation

Plan 002 is sound and now de-risked. Implement it as the plain-PHP
`.github/validate-catalog.php` with **Tier 1 + Tier 2** invariants, wired as a
second CI step, using the simple JSON-walk for the conv-token check (reserve the
`ConventionsSchema`/`SlotResolver` reuse for a later parity pass if exact engine
semantics ever matter). Tier 3 becomes a follow-up plan. Pairs with direction
D2 (the authoring checklist the check would enforce).
