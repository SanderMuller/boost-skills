# Plan 013: The pre-outward gate ships as a skill, not a guideline

> **Who this is for**: a `boost-skills` peer for §5–§7, and a `boost-core` peer for §6.
> Read §1–§4 first either way; the decision in §5 only holds while §4 is true.
>
> **Provenance**: not an audit finding. Handed off from a consumer session after a
> merge-ready pull request to a third-party open-source project was closed as
> AI-generated. Written by the session that caused it. The verbatim account —
> project, pull request, and the maintainers' own words — is in `internal/`, per
> the anonymization rule in `CLAUDE.md`.
>
> **Drift check (run first)**:
> `git log --oneline -- resources/boost/skills/humanizer/SKILL.md` and
> `grep -rn "guideline" vendor/sandermuller/boost-core/src/Sync/UserScopeManifestWriter.php`.
> If user scope has gained guideline support since, §5 is void — go to §6.
>
> **Since this plan was written**: `humanizer` now states its own scope — it covers
> prose a person reads and never agent-to-agent traffic. §7's skill inherits that
> boundary rather than re-deciding what "outward" means.

## Status

- **Priority**: P1 — the failure it prevents already cost a closed PR and a public
  complaint that the thread read like talking to a chatbot
- **Blocked on**: the user-scope layout bug in §4. Until it is fixed or worked
  around, a skill published this way never loads, so part 1 delivers nothing.
- **Effort**: S for the skill, M if boost-core takes §6
- **Risk**: LOW — additive skill, no existing behaviour changes
- **Depends on**: nothing in this repo. §6 is a boost-core question, not a blocker
- **Planned at**: boost-skills `2.39.1`, boost-core `1.8.1`

## 1. The ask, in two parts

1. **boost-skills**: add a skill that gates every outward action — post, comment,
   reply, PR, issue, commit message, release — on running `humanizer` and on
   matching the answer to the size of the question.
2. **boost-core**: decide whether user-scope sync should publish guidelines as
   well as skills. Today it does not, which is the whole reason part 1 is a skill.

The consumer wants these rules on two machines, updating as they are improved.
That constraint is what forces the shape.

## 2. What happened

**Day one, morning.** A maintainer of a third-party open-source project said, in a
chat channel, that the consumer's AI-written comments used language that was hard
to follow. They suggested adding "Respond in ASD-STE100 Simplified Technical
English" to the prompt. The consumer session did that: it copied `voice.md` into the
project's `.ai/guidelines/`, added a `## Voice` section to `CLAUDE.local.md`, and
wrote a sentence-length checker. Mean sentence length dropped and stayed down.
Every draft after that passed the checker.

**Day one, evening.** On a pull request to a second third-party project — a
two-line production fix with a red/green test, **already approved** by a second
maintainer — the maintainer asked three short questions over four hours. Each got
a structured report back: bold section headings, a markdown table, a fenced code
block, a measured-evidence framing, and in one case a closing aside about what the
evidence had taught. One of those questions was a yes/no.

That evening the maintainer asked for a human to reply, and said the thread read
like talking to a chatbot.

The consumer replied by hand the next morning. Hours later the pull request was
closed with the project's boilerplate for a contribution that appears to be
primarily AI-generated, without careful human review.

## 3. Why the first fix did not prevent the second

The first round of feedback was read as a **vocabulary** problem, so the fix was a
vocabulary rule. The closure was a **register and volume** problem: a one-line
question answered with a formatted mini-report, three times in two hours.

`humanizer` covers inflated significance, promotional language, em-dash overuse,
rule-of-three, AI vocabulary, false agency, jargon, throat-clearing, hedging and
sycophancy. It says nothing about answering at the size of the question, and
nothing about tables and headings inside someone else's thread. Both drafts would
have passed it.

There was also no hook. `pull-requests/SKILL.md` already points at `humanizer`
for PR *descriptions* (line 436, "run it through that lens before submitting"),
and `readme/SKILL.md` points at it for prose tells. Those two are the whole set:
`grep -rn humanizer resources/` finds no other pointer, and
`pr-review-feedback` has none. Nothing covers an ad-hoc comment on a thread.
That is exactly where the damage happened.

The code was never the issue. Two files, a handful of production lines, a test that
proved the mechanism in both directions, and a maintainer's approval. Once the
AI-generated label lands, the diff stops being read on merit.

## 4. What user-scope sync actually publishes

Verified on 2026-09-10 against boost-skills `2.39.1` and boost-core `1.8.1`,
installed with `composer global require sandermuller/boost-skills`.

`~/.composer/vendor/bin/boost sync --scope=user --all` reported:

```
[sandermuller/boost-core  → /Users/…] wrote=40,  unchanged=5,  deleted=0
[sandermuller/boost-skills → /Users/…] wrote=352, unchanged=44, deleted=0
[sandermuller/repo-init   → /Users/…] wrote=0,   unchanged=9,  deleted=0
```

Findings:

- **Skills only.** 36 skill directories landed under
  `~/.claude/skills/sandermuller__boost-skills/<skill>/SKILL.md`, and the same
  under `~/.agents/skills/`. boost-skills ships 10 guidelines in
  `resources/boost/guidelines/` — including `voice.md` — and **none** reached user
  scope. `find ~/.claude ~/.agents -maxdepth 2 -iname '*guideline*'` is empty.
  `UserScopeManifestWriter` refers only to skills.
- **Wholesale.** Per `guide/automating-sync#user-scope-sync`, user scope has no
  `boost.php`, so tag filters and the vendor allowlist do not apply. Requiring the
  catalogue globally publishes all 36 skills. Removed packages are reaped on the
  next `--all`.
- **Not automatic.** `composer global update` refreshes the vendor tree only. The
  synced copies change when `boost sync --scope=user --all` runs again. The docs
  describe `BoostAutoSync::syncUserScopeOnce()` for a tool self-syncing from its
  own bin script; the global `boost` bin does not call it — `grep -n syncUserScope
  ~/.composer/vendor/bin/boost` is empty.

**The layout is one level too deep for Claude Code, so none of it loads.** Claude
Code discovers a user skill at `~/.claude/skills/<name>/SKILL.md`. Sync writes
`~/.claude/skills/<vendor>__<package>/<skill>/SKILL.md`. After a successful sync
and a plugin/skill reload, not one of the 36 published skills appeared in the
session's skill list.

`sandermuller__repo-init` is the exception, and it works by accident: that package
ships a single skill whose name equals the package name, so boost collapses the
pair into `sandermuller__repo-init/SKILL.md` — flat, and therefore found. Any
package shipping two or more skills, or one skill named differently from its
package, publishes nothing usable.

**This is the most consequential finding in this document.** Skills reach the user
filesystem but not the agent, so "skills work at user scope, guidelines do not" is
only half right: today neither is delivered. A boost-core peer should treat this
as a bug ahead of §6. Two shapes to consider: write the skill directory flat as
`<vendor>__<package>__<skill>/SKILL.md`, or keep the vendor grouping and add a
flat symlink per skill. The consumer is currently working around it with a
hand-made symlink from `~/.claude/skills/humanizer` into the Composer vendor tree,
which also removes the need to re-run sync after `composer global update`.

One correction worth recording, because it was nearly published as a finding: the
already-present `~/.claude/skills/sandermuller__repo-init/SKILL.md` looked stale
against the installed `repo-init 1.13.0`. It is not. Sync **renders** a skill, so
its output never byte-equals the source. The entire difference was two bytes —
boost quoted the `description:` frontmatter value. Comparing rendered output to
raw source is not a drift test.

## 5. The decision: a skill, with a thin always-on pointer

A guideline cannot reach a machine outside a project that Composer-requires this
catalogue and allowlists it. Skills can, via §4. So the substance goes in a skill.

A skill only fires when invoked or matched, and these rules must hold always. So
the consumer keeps two or three lines in `~/.claude/CLAUDE.md` — always-on, hand-
maintained, per machine, rarely changing — that say *before any outward action,
run the pre-outward skill*. The detail lives in the skill and updates with the
package. The pointer is the only thing that has to be copied to a second machine
by hand.

State this trade-off in the skill body. A reader who expects boost to manage
`CLAUDE.md` should learn from the skill that it does not.

## 6. For a boost-core peer: should user scope publish guidelines?

Guidelines are the natural home for "how to behave", and they are project-scope
only. That is defensible — guidelines render into `CLAUDE.md`/`AGENTS.md` and a
user-scope render has no `boost.php` to drive slots or tags. But it means no
always-on, auto-updating rule can be delivered to a machine at all, which is
precisely what this consumer asked for.

Three options, for the peer to choose:

1. **Leave it.** Guidelines stay project-scope; consumers keep a hand-maintained
   pointer in `~/.claude/CLAUDE.md`. §5 assumes this.
2. **Publish guidelines wholesale at user scope**, the same way skills go. Needs a
   destination decision: agents read guidelines through `CLAUDE.md`/`AGENTS.md`,
   and boost must not clobber a file the user owns. `file-ownership.md` already
   covers the coexistence rule for `laravel/boost`; the same question applies here.
3. **A managed block in the user's `CLAUDE.md`**, delimited by markers, written by
   `sync --scope=user`. Strongest fit for the ask, largest blast radius: it writes
   to a file no boost command currently touches.

Whoever decides, record it — a consumer hitting this again should find the answer
rather than re-derive it.

## 7. Spec for the new skill

**Name**: `outward-check` is free. `before-posting` and `posting` also free. Pick one.

**Frontmatter**, matching `bug-fixing/SKILL.md`:

```yaml
---
name: outward-check
description: "Gate every outward action on humanizing the text and matching its size to the question. Activates when: about to post, comment, reply, open a pull request or issue, push a commit message, or publish anything another person reads."
metadata:
  boost-requires: "humanizer"
  schema-required: "^1"
---
```

Untagged, like `humanizer`, so it is eligible everywhere.

**Body must cover, and each line has a real incident behind it:**

1. Run `humanizer` over the text. Non-negotiable.
2. Answer at the size of the question. A one-line question takes a one-line
   answer. This is the rule whose absence closed the PR.
3. No tables, bold headings or evidence blocks in someone else's thread unless
   they asked for detail. They read as machine output whatever the content is
   worth.
4. Re-read the thread as the last step before posting, in case it moved.
5. Before opening a PR, verify the claims and assumptions in both the change and
   its description: re-read the diff against the base rather than from memory,
   run the project's own gate and quote the real output, confirm a regression
   test fails without the fix, trace every number to a command run in this
   session, read full shas from the repo or API instead of completing them from
   an abbreviation, and attribute red CI to the base only after checking another
   recent PR.
6. Say what you could not verify. Silence implies coverage you do not have.

Point 5 overlaps `pull-requests`. Decide whether to restate it or defer with
`boost-requires`. Restating is safer — the failure mode is an ad-hoc comment where
`pull-requests` was never invoked.

## 8. Verification

- `php .github/validate-skills.php` and `php .github/validate-catalog.php` pass.
- The README inventory table gains a row. CI checks the table against the shipped
  catalogue (plans 001 and 002), so a missing row fails the build.
- `vendor/bin/boost sync --scope=user --all`, then confirm
  `~/.claude/skills/sandermuller__boost-skills/<name>/SKILL.md` exists and that
  `~/.agents/skills/` got it too.
- On the second machine: `composer global require sandermuller/boost-skills`, the
  same sync, same two paths present.
- Behavioural check, the one that matters: give a session a one-line question on a
  PR thread and confirm the answer comes back one line long.

## 9. STOP conditions

- User scope has gained guideline support since §4 was verified. §5's premise is
  gone; take §6 option 2 or 3 instead.
- `humanizer` has grown to cover volume, formatting or answer sizing. Do not
  duplicate it — extend `humanizer` and reduce this skill to the PR-verification
  half.
- A skill already covers this. `outward-check`, `before-posting` and `posting` were
  all free at `2.39.1`; re-check `ls resources/boost/skills`.
