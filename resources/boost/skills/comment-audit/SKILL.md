---
name: comment-audit
description: "Judge the code comments a change added or changed, and apply Remove / Replace / Trim. Activates when: auditing or trimming comments, asking whether comments are needed, or when user mentions: comment audit, audit comments, trim comments, too many comments, comment noise."
argument-hint: [optional: commit range or files, if not already resolved]
---

# Audit Code Comments

Default to no comment. This skill decides which of the comments a change introduced survive, and rewrites or deletes the rest.

## When to Use This Skill

- `evaluate` reaches its comment gate
- A review pipeline hands over its comment step
- The user asks whether comments are needed, or to trim them

Do NOT use for: comments outside the current change (pre-existing code is not yours to judge), or for writing new comments — the language guidelines own that.

### Report-only mode

When a review pipeline runs several judgement lenses over one tree and applies their findings in a single later step, this skill **reports and does not edit** — a cut applied here would be judged by the next lens as code somebody wrote. The pipeline's step instruction says which mode applies. Invoked anywhere else — standalone, or from `evaluate` — apply the verdicts yourself as described below.

## Scope

Use the evaluation scope already resolved for this change; do not re-derive or broaden it. Within it, find every comment **added or changed**, in **all** comment syntaxes of the changed languages — docblocks and `//` / `#` / `/* */`, and template comments (`{{-- --}}`, `<!-- -->`). Template comments count. Never judge a pre-existing comment outside that scope.

## The Bar

A comment earns its place **only when both** are true:

1. **Without it, a competent teammate reading the code (and any linked issue or PR) would draw the wrong conclusion or break it on edit** — not merely be curious. "Is there a real WHY?" is the wrong test; almost every line has one. A real-but-inferable why — the reader would understand it, just a little slower — is not enough to keep inline; that belongs in the tracker, not the source.
2. There is no better way to write the code that would make the comment unnecessary.

## The Ladder

**Judge each comment on its own — never batch-justify.** A collective verdict ("these all explain real WHYs") is how a comment that merely restates the code survives. For each added or changed comment, apply this in order and stop at the first that fits:

| Verdict | When | Action |
|---------|------|--------|
| **Remove** | Comment restates what the code already says, narrates the obvious, or is a leftover (commented-out code, a "TODO" with no tracking link, scaffolding chatter) | Delete it |
| **Replace with better code** | The need for the comment disappears if the code is rewritten — rename a variable/method/class, extract a well-named private method, or split a long function | Rewrite the code, drop the comment, re-run affected tests |
| **Trim / compact** | The WHY is genuinely needed but the comment is verbose, repeats itself, or buries the point | Reduce to the minimal sentence(s) that carry the constraint — and prefer linking the issue or PR over re-explaining the whole case inline (pointer, plus the one fact a reader must not miss) |
| **Keep as-is** | Already minimal, and without it a reader (with any linked issue) would get the code **wrong** — not just be curious | Leave it |

Prefer **Remove** and **Replace** over **Trim** — a comment that can be designed away is better than a shorter comment.

**Density is itself a signal.** After judging individually, look across the scope: if one function or method accrued more than a single surviving comment, treat that as a smell that the code wants splitting or renaming, not annotating — revisit those with a bias to Remove/Replace.

## Exempt — Do Not Touch

- Comments required by tooling or convention: static-analysis annotations, `@var` and type-hint docblocks the project's conventions mandate, IDE/linter directives, license headers.
- Comments outside the current diff.

## This Is the Last Comment Gate

Outside report-only mode, apply the Remove/Replace/Trim edits yourself — they are your own work, not a list for the user. If a rewrite needs a design decision, ask.

Re-run this over comments added by **any later step in the same run** — simplification, or applying review feedback — since those add comments of their own without auditing them. If you add or change a comment after this audit, the audit is not finished.

## Report

Name each comment you removed, replaced or trimmed, with the file and the verdict. State plainly when nothing needed changing; a change that added no comment has nothing to audit and should say so rather than inventing work.
