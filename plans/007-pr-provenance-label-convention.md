# Plan 007: `pr.labels` — a configurable mandatory-PR-label policy for `pull-requests`

> **Executor instructions**: Follow step by step; run every verification
> command and confirm the expected result before moving on. If a STOP condition
> occurs, stop and report — do not improvise. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat e7dde00..HEAD -- resources/boost/conventions-schema.json resources/boost/skills/pull-requests/SKILL.md resources/boost/skills/final-verification-review/SKILL.md README.md`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts below against the live files before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1 (a consumer is blocked on it today — see "Why this matters")
- **Effort**: M
- **Risk**: LOW (purely additive, optional slot; absent ⇒ no behavior change)
- **Depends on**: none
- **Category**: feature / conventions vocabulary
- **Planned at**: commit `e7dde00`, 2026-08-05
- **Requested by**: the `mijntp` consumer (blinqx-vh/mijntp), see "Consumer contract"

## Why this matters

A consumer (`blinqx-vh/mijntp`) has a department mandate: **every PR carries
exactly one label recording who wrote the first working version of the main
change** — three fixed Dutch label names, aggregated across every R&D team, so a
renamed or translated label silently drops that repo out of the aggregation.

There is no slot for that today. `pr` accepts exactly `title_format`,
`template_path`, `gates`, `risk`, and is `additionalProperties: false`, so the
consumer cannot even forward-declare the policy — it is a hard schema error, not
a silent no-op. Their only available lever was the host guideline layer
(`.ai/guidelines/pr-workflow.md`), which boost-core compiles into `CLAUDE.md`
and `AGENTS.md`. That layer is **loaded in every session**, so a rule that only
matters at PR-creation time costs them tokens on every unrelated task: 690
tokens initially, 271 after they trimmed it to a pointer plus an on-demand doc.

The mandate is not specific to that consumer. "Apply exactly one label from a
fixed vocabulary, decided by a question only the author can answer" is the shape
of any AI-provenance, compliance, or change-class labelling requirement. Making
it a convention slot puts it **inside the skill** — rendered only when
`pull-requests` activates — and turns an instruction into part of the flow.

The label names themselves are **consumer data, not package data**. Do not
hardcode Dutch strings, AI-provenance semantics, or a three-option vocabulary
anywhere in this package. The slot carries the mechanism; the consumer's
`boost.php` carries the names.

## Current state

### `resources/boost/conventions-schema.json` — the `pr` object

```
properties.pr
  type: object
  additionalProperties: false
  description: "Pull-request creation conventions. Used by the pull-requests skill."
  properties: title_format | template_path | gates | risk
```

`properties.schema-version` is `{"const": 1}` — "v1 of the boost-skills
conventions vocabulary".

`pr.risk` is the closest existing analogue and the pattern to mirror. Note its
shape decisions, all of which apply here:

- `"render": "yaml"` on the object, and again on its nested `tiers` array.
- `additionalProperties: false` plus an explicit `required` list.
- A description that states the **absent** behaviour first: *"ABSENT ⇒ the skill
  uses its generic Low/Medium/High risk question (no behavior change)."*
- A `matrix_doc` string slot for the subjective prose, kept out of the data:
  *"the tier→routing TABLE is data; this doc holds only prose. Validated for
  file-existence by 'boost doctor --check-conventions'."*

### `resources/boost/skills/pull-requests/SKILL.md` (380 lines)

Anchor points, all verified at `e7dde00`:

| Line | What is there |
|---|---|
| 8 | `metadata.schema-required: "^1"` — already present, must stay |
| 31–53 | `### Preflight Checklist`, items 1–7 |
| 73 | Numbered step 6 — resolve risk + ask for direction, "batching whatever questions remain into one `AskUserQuestion` call" |
| 74–80 | Numbered step 7 — the `gh pr create --draft --base <resolved-base> --title … --body-file …` block |
| 237–244 | `### Batching with the risk-level question` — enumerates the possible questions and their order |
| 246–268 | `## Risk Assessment Before PR Creation`, with the token at line 250: `<!--boost:conv path="pr.risk" mode="yaml"-->No project risk tiers configured.<!--boost:conv:end-->` |

### Validators (`.github/`, both run in `validate-skills.yml`)

`validate-catalog.php` enforces, among others:

- **Invariant F** — every `boost:conv path="…"` resolves to a slot in
  `conventions-schema.json`. Failure message: `skill '<dir>': boost:conv
  path="<path>" does not resolve to a conventions-schema.json slot`. **The schema
  key and the token must therefore land in the same commit.**
- **Invariant G** — `metadata.schema-required` present iff the body uses a
  `boost:conv` token. `pull-requests` already satisfies this; adding a second
  token does not change it.

`validate-skills.php` validates skill frontmatter and companion-script syntax (32/32 skills + 1/1 guideline tag manifest at planning time).

Note: `plans/README.md` still quotes `29/29` from the 2026-07-03 audit — that figure is stale, the catalog has grown to 32 skills. Trust a fresh run, not the older plans.

### `README.md`

- Line 183 — "Policy slots" explanation, using `pr.gates` as its example.
- Line 194 — the conventions table row: `` | `pr` | PR conventions — title
  format, template path, pre-PR gates, risk-tier routing (`pr.risk`) |
  `pull-requests`, `final-verification-review` | ``

### Other consumers of `pr.*`

`resources/boost/skills/final-verification-review/SKILL.md` renders
`pr.gates`. It is the only other skill reading a `pr.*` slot. See Step 5.

## Design

### Schema — `properties.pr.properties.labels`

Additive, optional, `render: yaml`. Absent ⇒ no label step at all, so every
existing consumer is unaffected.

```json
"labels": {
  "type": "object",
  "render": "yaml",
  "additionalProperties": false,
  "required": ["options"],
  "description": "Optional mandatory-PR-label policy for the pull-requests skill. ABSENT ⇒ the skill has no label step (no behavior change). Use for a label vocabulary the project must apply to every PR — AI/authorship provenance, change class, compliance tagging — where the choice depends on knowledge only the author has and cannot be derived from the diff. Orthogonal to pr.risk: a risk tier's own 'label' field is routing metadata, this slot is an author-declared policy; a project may declare either, both, or neither.",
  "properties": {
    "require_exactly_one": {
      "type": "boolean",
      "default": true,
      "description": "Exactly one option must be applied. false ⇒ at most one (the label is encouraged, not mandatory)."
    },
    "exempt_bot_authors": {
      "type": "boolean",
      "default": false,
      "description": "Skip the policy for PRs authored by a bot (Dependabot, github-actions, autofix bots). Set true when the policy's question cannot be answered for machine-authored PRs."
    },
    "rule": {
      "type": "string",
      "description": "The single question that decides which option applies, in the project's own words (e.g. 'Who wrote the first working version of the main change?'). Rendered verbatim to the agent and to the author when asked."
    },
    "rule_doc": {
      "type": "string",
      "description": "Optional path to a project-owned doc holding the full policy — rationale, edge cases, exemptions. The option TABLE is data (see options); this doc holds only prose. Validated for file-existence by 'boost doctor --check-conventions'."
    },
    "options": {
      "type": "array",
      "render": "yaml",
      "description": "The label vocabulary. Variable length — no mandated count or names.",
      "items": {
        "type": "object",
        "required": ["name"],
        "additionalProperties": false,
        "properties": {
          "name": {
            "type": "string",
            "description": "The label name exactly as it exists in the tracker. Applied verbatim — never translated, re-cased, abbreviated or re-worded, because these names are typically aggregated outside the repo."
          },
          "when": {
            "type": "string",
            "description": "One-line criterion for choosing this option."
          },
          "on_doubt": {
            "type": "boolean",
            "default": false,
            "description": "This option is the fallback when the AUTHOR is uncertain. At most one option may set it."
          }
        }
      }
    }
  }
}
```

Two constraints JSON Schema cannot express — enforce them in the skill body, not
the schema:

1. **At most one `on_doubt`.** If more than one option sets it, the skill treats
   the config as invalid and asks the user rather than picking.
2. **`require_exactly_one` with an empty `options`** is meaningless. `required:
   ["options"]` plus a non-empty check in the skill text covers it.

### Skill body — `pull-requests/SKILL.md`

A new section, placed **after** `## Risk Assessment Before PR Creation` and
before `## PR Title`, holding the token and the rules that interpret it. Name it
for the mechanism, not for one consumer's use case — e.g. `## PR Labels`.

Content requirements (the substance, not the wording — write it in the file's
existing voice):

- The token, with an absent-fallback that reads as a no-op:
  `<!--boost:conv path="pr.labels" mode="yaml"-->No project PR-label policy configured.<!--boost:conv:end-->`
- **Names are applied verbatim.** Never translate, re-case, abbreviate, or
  invent a name outside `options` — the names are usually aggregated outside the
  repo, where a deviating name does not fail loudly, it just stops counting.
- **How the agent determines it, in order of evidence:**
  1. The agent did the work in this session → it knows who wrote the first
     working version; label accordingly, no question.
  2. The branch predates the session → AI co-author trailers in
     `git log <base>..HEAD` are an *input*, not an answer (a trailer proves AI
     was involved, not that AI wrote the first working version).
  3. Anything less than certain → **ask the author**, offering the `options`
     verbatim, batched into the step-6 `AskUserQuestion` render.
- **`on_doubt` is the author's fallback, not the agent's.** The agent must not
  silently pick it to avoid asking.
- **`exempt_bot_authors`** → skip the whole step for bot-authored PRs.
- **`rule_doc`** → read it when a case is not obvious.
- Note that the label is enforcement-free on the package side: a project wanting
  a hard gate adds its own CI check.

Three existing places need a pointer to it:

- **Step 7** (line 74–80) — the `gh pr create` block gains `--label "<resolved>"`
  when a policy is configured.
- **Step 6** (line 73) and **`### Batching with the risk-level question`**
  (237–244) — the label question becomes a third possible question in the batch,
  rendered **only** when evidence did not settle it. Update the "Order when both
  are present" sentence to cover three questions.
- **Preflight Checklist** (31–53) — one new item: when a policy is configured,
  the label is resolved before creation. Keep it to one item; do not restate the
  rules there.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Schema parses | `php -r 'json_decode(file_get_contents("resources/boost/conventions-schema.json"), true, 512, JSON_THROW_ON_ERROR); echo "ok\n";'` | `ok` |
| Frontmatter gate | `php .github/validate-skills.php` | exit 0, `32/32 skills valid` + `1/1 guideline tag manifests valid` |
| Catalog invariants (incl. F + G) | `php .github/validate-catalog.php` | exit 0, passes |
| Composer metadata | `composer validate` | `valid` |
| Token ↔ schema pairing | `grep -c 'boost:conv path="pr.labels"' resources/boost/skills/pull-requests/SKILL.md` | `1` |

## Scope

**In scope**: `resources/boost/conventions-schema.json` (the new `pr.labels`
slot), `resources/boost/skills/pull-requests/SKILL.md` (the new section + the
three pointers), `README.md` (the `pr` row and, if it reads naturally, the
policy-slots paragraph), `CHANGELOG.md`, `internal/release-notes-2.24.0.md`.

**Out of scope**: bumping `schema-version` (this is additive to v1 — see STOP
conditions), touching `pr.risk` or `pr.gates`, any consumer repo, publishing the
tag, and building enforcement (a CI check belongs to the consumer).

## Git workflow

- Branch: `feature/007-pr-labels-convention`.
- Commit the schema + skill + README together — invariant F fails if the token
  lands without the slot, so a split commit leaves CI red mid-series.
- CHANGELOG and release notes may be a second commit.
- Do **not** push, open a PR, or tag unless instructed. The operator releases.

## Steps

### Step 1: Add the `pr.labels` slot to the schema

Insert `labels` into `properties.pr.properties` per **Design → Schema** above,
after `risk` (key order is cosmetic; keep the file's existing style and
indentation).

**Verify**: the schema-parses command above prints `ok`, and

```bash
php -r '$d=json_decode(file_get_contents("resources/boost/conventions-schema.json"),true); echo implode(",", array_keys($d["properties"]["pr"]["properties"])), "\n";'
```

→ includes `labels`. `additionalProperties` on `pr` is still `false`.

### Step 2: Add the `## PR Labels` section to `pull-requests/SKILL.md`

Per **Design → Skill body**. The token must be exactly
`path="pr.labels"` — invariant F matches on that string.

**Verify**: `php .github/validate-catalog.php` → exit 0. This is the real test
of Step 1 + Step 2 together: it fails with the "does not resolve to a
conventions-schema.json slot" message if the path is misspelled or the schema
key is missing.

### Step 3: Wire the three pointers

Step 7's `gh pr create` block, step 6 + the batching section, and one preflight
item — see **Design → Skill body**.

**Verify**: `php .github/validate-skills.php` → exit 0, `32/32 skills valid` + `1/1 guideline tag manifests valid`.
Then read the section back and confirm an agent with no other context could
execute it: which label to apply, when to ask instead of guess, and what to do
when no policy is configured.

### Step 4: Update `README.md`

The line-194 row becomes something like: *PR conventions — title format,
template path, pre-PR gates, risk-tier routing (`pr.risk`), mandatory PR labels
(`pr.labels`)*. Check whether the "Policy slots" paragraph (line 183) wants
`pr.labels` as a second example; add it only if it reads naturally.

**Verify**: `php .github/validate-catalog.php` → exit 0 (it is the README-drift
gate).

### Step 5: Decide on `final-verification-review`

That skill renders `pr.gates` and reports READY / NOT READY by dry-running the
`pull-requests` preflight. A configured label policy with no resolvable label is
exactly a NOT-READY condition.

**Recommended**: add one line to its preflight dry-run — when `pr.labels` is
configured, a resolvable label is part of READY. That needs a second
`boost:conv path="pr.labels"` token in that file (invariant G is already
satisfied there, since it renders `pr.gates`).

**Verify**: both validators exit 0. If you judge it out of scope, say so
explicitly in the plan's status row rather than silently skipping it — the
consumer's closeout flow will otherwise pass a PR that is missing its mandated
label.

### Step 6: CHANGELOG + release notes

Minor bump: **2.24.0**. Follow the existing format in `CHANGELOG.md` — a
`## 2.24.0 - <date>` heading, the `<!-- verified-sha: <full-sha> -->` comment,
a lead paragraph, then `### Added`. Add `internal/release-notes-2.24.0.md`
matching its siblings.

The entry must state: additive and optional, absent ⇒ no behavior change, no
`schema-version` bump, and that label names are consumer configuration.

**Verify**: `composer validate` → `valid`. Confirm the `verified-sha` matches
the commit the notes describe.

## Test plan

There is no PHP test suite in this package; the two validators are the gate.
Beyond them, three checks worth doing by hand:

1. **Absent-policy no-op.** Render the skill for a config with no `pr.labels`
   and confirm the section reads as an explicit no-op rather than an
   instruction to invent a label.
2. **Negative test on invariant F.** Temporarily misspell the token path
   (`pr.label`), run `php .github/validate-catalog.php`, confirm it fails with
   the slot-resolution message, then restore. This proves the gate actually
   covers the new token.
3. **Consumer render.** In a scratch checkout of a consumer, drop the config
   from **Consumer contract** below into `boost.php`, run `vendor/bin/boost
   sync`, and read the rendered `.claude/skills/pull-requests/SKILL.md` — the
   three names must appear verbatim, correctly cased.

## Done criteria

- [ ] `pr.labels` exists in `conventions-schema.json`, optional, `render: yaml`, `additionalProperties: false`.
- [ ] `pull-requests/SKILL.md` has the `## PR Labels` section with the `pr.labels` token, plus the step-7, step-6/batching and preflight pointers.
- [ ] `php .github/validate-skills.php` → exit 0, `32/32 skills valid` + `1/1 guideline tag manifests valid`.
- [ ] `php .github/validate-catalog.php` → exit 0.
- [ ] `composer validate` → `valid`.
- [ ] Invariant-F negative test done and restored.
- [ ] `README.md` row 194 mentions `pr.labels`.
- [ ] Step 5 decided — either implemented, or explicitly declined in the status row with a reason.
- [ ] `CHANGELOG.md` + `internal/release-notes-2.24.0.md` written; `schema-version` still `1`.
- [ ] No Dutch label name, no AI-provenance wording, and no fixed option count anywhere in the package.
- [ ] `plans/README.md` row for 007 updated.

## STOP conditions

- **The drift check shows any of the four files changed since `e7dde00`** and the
  "Current state" excerpts no longer match — re-read the live files and report
  before proceeding.
- **Either validator already fails on a clean checkout**, before your changes.
  Report it; do not fix unrelated drift under this plan.
- **The design starts requiring the package to know the consumer's label
  semantics** (Dutch names, "AI wrote it", exactly three options). That means the
  slot is under-designed — stop and report rather than hardcoding.
- **The change turns out not to be additive** — e.g. an existing consumer config
  would become invalid, or the vocabulary needs `schema-version: 2`. That is a
  breaking change requiring an `UPGRADING.md` entry and a major bump; stop and
  get a decision.
- **`pr.risk`'s per-tier `label` field looks like it should be reused** for this.
  It should not: that field is risk-routing metadata applied by tier score, this
  slot is an author-declared policy. Conflating them makes a project unable to
  have both. Report if you think otherwise instead of merging the two.

## Consumer contract (`blinqx-vh/mijntp`, out of scope here)

Recorded so the executor knows what the slot has to support, and so the consumer
work is unambiguous once 2.24.0 ships. The consumer's tooling is already live
via the guideline layer (PR #5575 in that repo), so nothing there is urgent —
this migration only moves it off the always-loaded layer.

Their config will be:

```php
'pr' => [
    'labels' => [
        'require_exactly_one' => true,
        'exempt_bot_authors' => true,
        'rule' => 'Who wrote the first working version of the main change?',
        'rule_doc' => '.ai/docs/ai-provenance-label.md',
        'options' => [
            ['name' => 'Volledig met AI gemaakt', 'when' => 'AI wrote the first working version of the main change'],
            ['name' => 'Gedeeltelijk met AI gemaakt', 'when' => 'Partly AI, partly the author', 'on_doubt' => true],
            ['name' => 'Volledig handmatig gemaakt', 'when' => 'The author wrote it from the first to the last line'],
        ],
    ],
],
```

After 2.24.0 lands, on their side: `composer require sandermuller/boost-skills:^2.24`,
add the config above, delete the `## Every PR carries exactly one AI-provenance
label` section from `.ai/guidelines/pr-workflow.md`, keep
`.ai/docs/ai-provenance-label.md` (now reached via `rule_doc`), re-sync, and
**fix `tests/Architecture/AiProvenanceLabelTest.php`** — two of its cases assert
the names appear in `.ai/guidelines/pr-workflow.md` and `CLAUDE.md`, which is
exactly what this migration removes. Those assertions must move to the
`boost.php` config plus the synced `.claude/skills/pull-requests/SKILL.md`.
Their `.github/workflows/ai-provenance-label.yml` CI check is unaffected — it
reads labels off the PR event and knows nothing about boost.

## Maintenance notes

- If a second consumer needs a *different* decision mechanism (e.g. a label
  derived from changed paths rather than from authorship), do **not** widen
  `rule` into a DSL. Add a sibling `type`-discriminated policy slot the way
  `pr.gates` did it.
- `exempt_bot_authors` deliberately says nothing about *which* bots. Bot
  detection belongs to the agent's tracker query (`author.is_bot` on GitHub),
  not to a name list in config that would rot.
