# Plan 010: strip the `verified-sha` pin before it reaches the changelog

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git log --oneline 70f201c..HEAD --
> .github/workflows/update-changelog.yml`. If that workflow already has a step
> between checkout and `Update Changelog`, read it before adding another.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — one workflow step, and it only deletes lines matching a very
  specific comment
- **Depends on**: none
- **Category**: hygiene
- **Planned at**: commit `b09cb2b`, 2026-08-26

## Why this matters

Set expectations first: **nobody has ever seen this.** The pin is an HTML
comment, so GitHub renders it as nothing in both the release body and the
changelog. There is no reader-facing defect and no urgency.

What it costs is smaller and real: every release adds a line of build-process
noise to a public product artifact, the changelog diff carries it, and anyone
grepping the file for a SHA finds one that means nothing to them. It is the kind
of thing that is cheap now and slightly embarrassing later.

The pin exists so the pre-tag gate can fail closed when HEAD drifts between
drafting notes and cutting the tag. It is for the person cutting the tag. It has
no business in the changelog.

## Current state

`.github/workflows/update-changelog.yml` passes the release body straight
through:

```yaml
      - name: Update Changelog
        uses: stefanzweifel/changelog-updater-action@v1
        with:
          latest-version: ${{ github.event.release.tag_name }}
          release-notes: ${{ github.event.release.body }}
```

Measured on 2026-08-26:

| Artifact | Carrying the pin | Oldest |
|---|---|---|
| Release bodies | **53 of 66** | `1.7.0-rc2` |
| `CHANGELOG.md` pin lines | **51** | `1.7.0` |

A bare `grep -c verified-sha CHANGELOG.md` reports 52, not 51: one hit is prose
in a released entry, not a pin. Section 2 covers it.

The two artifacts do not agree either — `1.9.0`'s body is clean while its
changelog entry is not, so at least one body was edited after the fact. Do not
assume fixing one fixes the other, and do not assume a count from one applies to
the other.

## The sibling repo already solved this, and the order it learned matters

`sandermuller/boost-pipeline` hit exactly this and fixed it twice:

- `cc62ea3` — "Remove the verified-sha marker the release workflow copied in".
  A manual scrub of the existing entries.
- `2ab075b` — "Strip the verified-sha pin in CI, not by hand". The workflow fix,
  which came **after** the scrub, because the scrub came back at the next
  release.

So: **workflow first, history second.** Scrubbing without the workflow change is
work that undoes itself, and that is not a prediction — it is what happened
there.

## Proposed changes

### 1. Port the strip step (the fix)

Insert between `Checkout code` and `Update Changelog`, then point
`release-notes` at it. This is `boost-pipeline`'s step verbatim apart from the
heredoc marker name:

```yaml
      # The release notes carry a `verified-sha` pin on line 1 so the pre-tag gate
      # can fail closed on drift. It is for the person cutting the tag, not for
      # the changelog, and it reached CHANGELOG.md at every release that had one —
      # including the release where the handoff said to strip it by hand, which is
      # why this strips it here instead of asking anyone to remember.
      - name: Strip the verified-sha pin from the release body
        id: notes
        env:
          RELEASE_BODY: ${{ github.event.release.body }}
        run: |
          {
            echo 'body<<SKILLS_NOTES_EOF'
            printf '%s\n' "$RELEASE_BODY" | sed '/^[[:space:]]*<!--[[:space:]]*verified-sha:.*-->[[:space:]]*$/d'
            echo 'SKILLS_NOTES_EOF'
          } >> "$GITHUB_OUTPUT"
```

```yaml
          release-notes: ${{ steps.notes.outputs.body }}
```

The body reaches the step through `env:` rather than being interpolated into the
script. A release body is attacker-influenced text in the general case, and
interpolating it directly into `run:` is a shell-injection seam. Keep the `env:`
indirection even if the diff looks longer for it.

### 2. Scrub `CHANGELOG.md` (optional, and only after step 1)

One `sed` over the file, one commit, 51 lines gone:

```bash
sed -i '' '/^[[:space:]]*<!--[[:space:]]*verified-sha:.*-->[[:space:]]*$/d' CHANGELOG.md
```

Cheap and self-contained. Worth doing in the same pass as step 1 — but never
before it.

**One hit survives that scrub, and it should.** `CHANGELOG.md` line 1503 is prose
in a released entry describing the pre-release handoff: "…the branch containing
the verified-sha commit in the notes file". It is documentation, not a pin, and
the anchored pattern spares it correctly. Count pins, not occurrences of the
string — see Done criteria.

### 3. The 53 release bodies — recommended: leave them

53 writes to published artifacts, to remove something no reader can see. The
changelog is the file people read and diff; the bodies are rendered pages where
the comment is already invisible. Editing them buys nothing and each write is an
outward-facing action on a public release.

Leave them, and let step 1 mean no new one is ever added.

## Out of scope, but worth a decision one day

Step 1 stops the pin reaching the **changelog**. It does not stop it reaching the
**release body**, because the body is whatever `gh release create --notes-file`
uploaded, pin included.

The fix for that lives one level up, in this repo's own `pre-release` skill:
strip the pin from a copy of the notes file at release-create time, so it never
leaves the author's machine. That is strictly better — it fixes bodies and
changelogs, in every repo that uses the skill.

It is out of scope here because the blast radius is different in kind. The pin is
what the pre-tag gate greps for, so anything touching that path has to keep the
gate reading the **file** while the **upload** loses the pin, and it changes a
skill every consumer runs. Plan it separately, with its own STOP conditions.

## Steps

- [ ] Add the strip step and repoint `release-notes`, per section 1.
- [ ] Verify the regex against a real body before trusting it (see Test plan).
- [ ] Scrub `CHANGELOG.md` per section 2, in the same commit or a follow-up —
      never before step 1 lands.
- [ ] Leave the release bodies alone; record that as a decision here rather than
      a task nobody did.
- [ ] Update this plan's row in `plans/README.md`.
- [ ] Tests — none; this is CI config. CHANGELOG is CI-managed in this repo, so
      do not hand-write an entry for it.

## Test plan

CI config has no unit test, and the workflow only runs on a real release. Verify
the regex offline before merging, against a body that actually has the pin:

```bash
gh release view 2.31.0 --json body -q .body \
  | sed '/^[[:space:]]*<!--[[:space:]]*verified-sha:.*-->[[:space:]]*$/d' \
  | head -5
```

Expect the `## Changed` heading first and no pin. Then confirm it is surgical:

```bash
gh release view 2.31.0 --json body -q .body | wc -l
gh release view 2.31.0 --json body -q .body \
  | sed '/^[[:space:]]*<!--[[:space:]]*verified-sha:.*-->[[:space:]]*$/d' | wc -l
```

Expect a difference of exactly 1. Verified against `2.31.0` on 2026-08-26: 15
lines before, 14 after. A larger difference means the pattern is eating something
else — stop.

The real proof is the next release: its `CHANGELOG.md` entry has no pin, and
nothing else about the entry changed.

## Done criteria

- The next release adds a changelog entry with no `verified-sha` line.
- No pin line remains, and none returns across a release:

  ```bash
  grep -cE '^[[:space:]]*<!--[[:space:]]*verified-sha:.*-->[[:space:]]*$' CHANGELOG.md
  ```

  Expect `0`. A bare `grep -c verified-sha` will **not** reach 0 — one released
  entry discusses the pin in prose, and that line stays.
- The workflow reads the body through `env:`, not through interpolation.
- The release-body decision is recorded, not silently skipped.

## STOP conditions

Stop and report if any of these proves false:

1. **The pattern removes exactly one line from a real body.** If it removes more,
   or none, the pin's shape is not what this plan assumes — re-read a raw body
   before changing the regex.
2. **The pre-tag gate still reads the pin from the notes file.** This plan
   touches only what CI does with the *body*. If anything here changes what the
   gate greps, the gate can no longer fail closed on drift, and that is a real
   safety mechanism being traded for a cosmetic one. Stop.
3. **`changelog-updater-action` accepts a multi-line step output.** It reads the
   body today as a multi-line expression, so it should. If the entry comes out
   truncated or escaped, revert to passing the body directly and report — a
   correct changelog with a stray comment beats a mangled one.
