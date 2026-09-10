---
name: simplify-shape
description: "Judge whether a change carries its values in the right type — a fixed set of strings that wants an enum, inline request validation that wants a form request, an array shape that wants a DTO, a repeated query chain that wants a query-builder method. Activates when: asking whether something should be an enum, a DTO or a form request, reshaping a value, or when the user mentions: primitive obsession, extract a form request, value object, array shape, magic strings, wrong type."
argument-hint: "[optional: commit range or files, if not already resolved]"
metadata:
  boost-tags: "php"
---

# Shape the Value

Most needless complexity is a value carried in the wrong type. This skill walks a change and asks what its values *are*.

**The behaviour after the pass is the behaviour before it.** This is not a place to fix a bug or add a feature. A defect found on the way is reported, not fixed here.

## When to Use This Skill

- A change is written and its values want a second look before review
- `evaluate` reaches its over-engineering row and the diff carries raw strings, arrays or repeated chains
- The user asks whether something should be an enum, a DTO, or a form request

Do NOT use for cutting code that is not needed — the `simplification-auditor` subagent owns that, and it runs first. Shaping code you are about to delete is wasted work, and a cut often removes the need for the type. Do NOT use it to reshape a file the change only sits next to; see the `single-issue-scope` guideline.

## Scope

When a caller has already resolved an evaluation scope, reuse it. Standalone, resolve it in this order and stop at the first that applies: the commit range or files given as an argument; the task's commits plus any local edits; the staged and uncommitted diff. Never the whole-branch diff.

**Only values this change added or touched are in scope.**

## The Ladder

| Signal in the diff | Shape it wants |
|---|---|
| A fixed set of string or int values, compared with `===` or an in-array check, or a set of related constants | Backed **enum**, with the behaviour that switches on it moved onto the enum |
| A controller that validates inline, or plucks and casts request input by hand | **Form request**, built the way the project builds them |
| An array shape passed across two or more boundaries, or a docblock array shape | **Readonly DTO** |
| Three or more arguments that always travel together | **DTO** or a value object |
| A primitive with invariants — a duration, a colour, a locale code validated in more than one place | **Value object**, or a model cast |
| The same query chain repeated in two or more places | **Custom query-builder method**, named per the project's convention |
| A getter that only reformats a column | Plain getter on the model, where that is the project's convention |

A signal is a question, not a verdict. Read the call sites before you answer it: two comparisons against the same two strings in one method are not a type, they are two comparisons.

## Restraint — a New Type Is a Decision

Do not add abstraction until something varies. That splits this skill's authority in two:

- **Apply it yourself** when the type replaces something this change wrote and stays inside the change: an enum for constants this change added, a form request for validation this change wrote inline, a query-builder method for a chain this change duplicated.
- **Raise it to the user** when the type is new to the domain, or when it pulls callers outside the change with it: a new DTO, a new value object, an enum replacing a column's stored values. State the signal, the proposed type, the callers it touches, and the cost. The user decides.

Never migrate existing data or change a column's stored values under this skill.

## Prove the Behaviour Held

After each reshape, run the tests that cover the touched code. A reshape on a path with no test is reported with that fact stated — "no test covers this path" — never claimed as verified.

## Report

```markdown
## Shape

### Applied
- **{type}** — `file:line`. {Signal → type}. Tests run: {names, result}.

### Proposed, not applied
- **{type}** — `file:line`. {Signal, proposed type, callers affected, why it is the user's call}.

### Held
- {A signal the restraint rule stopped, and why.}
```

Say "nothing to reshape" plainly when that is the answer. A pass that invents a type to look productive is the failure this report exists to expose.
