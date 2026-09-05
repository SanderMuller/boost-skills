---
name: simplify-code
description: "Two ordered passes over a change — cut code that is not needed while behaviour stays identical, then shape what remains into the right type. Activates when: simplifying code, reducing complexity, asking whether something should be an enum or a DTO, or when user mentions: simplify, same functionality less code, over-engineering, primitive obsession, extract a form request."
argument-hint: [optional: commit range or files, if not already resolved]
---

# Simplify Code

Two passes, in this order: **Cut**, then **Shape**. Cut first — shaping code you are about to delete is wasted work, and a shorter version often removes the need for the type.

The bar for both passes is the same: **the behaviour after the pass is the behaviour before it.** This skill is not a place to fix bugs or add features. A defect found on the way is reported, not fixed here.

## When to Use This Skill

- A change is written and you want the smallest honest version of it before review
- `evaluate` reaches its over-engineering row
- A review pipeline hands over its simplify step
- The user asks whether code can be shorter, or whether something should be an enum, a DTO, or a form request

Do not use it to review a whole file or a legacy area — no unrelated refactor inside a feature or bug-fix change (see the `single-issue-scope` guideline).

### Report-only mode

When a review pipeline runs several judgement lenses over one tree and applies their findings in a single later step, this skill **reports and does not edit** — a cut applied here would be judged by the later lenses as code somebody wrote. The pipeline's step instruction says which mode applies. Standalone, it applies its own cuts as described below.

## Scope

Resolve the scope exactly as `evaluate` does, and reuse that resolution: the commit range given for this run, else the explicit files intersected with this task's changes, else the task's commits plus local edits, else the staged and uncommitted diff. Never the whole-branch diff.

**Only lines this change added or touched are in scope.** Code the change merely sits next to is out of scope, however tempting.

## Pass 1 — Cut

Walk the diff and look for code that can go while the behaviour holds:

| Candidate | What to do |
|---|---|
| Hand-rolled logic a native feature already covers | Replace with the language's standard library, a framework feature (collections, casts, query builder, validation, events), or an installed dependency |
| Abstraction with one implementation, a wrapper called once, a parameter nothing varies | Inline it |
| Duplicated block | Extract once, or delete the copy |
| Dead branch, unreachable guard, a null check on a non-nullable type | Delete |
| Unrequested functionality, setting or flag | Report as a scope decision — the user decides; this pass does not delete a feature |
| A loop a first-class array or collection method says in one line | Replace |

### Brevity has a floor

Shorter is a win only when nothing required is lost. This is minimal surface, not code golf. **Never** cut:

- Input validation at a trust boundary
- Error handling, or anything that prevents data loss
- Security, authorization or access-control logic — flag it instead of touching it
- Accessibility markup or behaviour
- Functionality the requirement asked for
- A test that covers non-trivial logic

### Prove the behaviour held

After each cut, run the tests that cover the touched code. A cut on a path with no test is reported with that fact stated — "no test covers this path" — never claimed as verified.

## Pass 2 — Shape

Now ask what the remaining code *is*. Most needless complexity is a value carried in the wrong type. Walk this ladder over the change:

| Signal in the diff | Shape it wants |
|---|---|
| A fixed set of string or int values, compared with `===` or an in-array check, or a set of related constants | **Enum** (backed), with the behaviour that switches on it moved onto the enum |
| A controller that validates inline, or plucks and casts request input by hand | **Form request**, built the way the project builds them |
| An array shape passed across two or more boundaries, or a docblock array shape | **Readonly DTO** |
| Three or more arguments that always travel together | **DTO** or a value object |
| A primitive with invariants — a duration, a colour, a locale code validated in several places | **Value object**, or a model cast |
| The same query chain repeated in two or more places | **Custom query-builder method**, named per the project's convention |
| A getter that only reformats a column | Plain getter method on the model, if that is the project's convention |

### Restraint — a new type is a decision, not a cleanup

Do not add abstraction until something varies. The two halves of this pass therefore carry different authority:

- **Apply it yourself** when the shape replaces something this change wrote, and the type stays inside the change: an enum for constants this change added, a form request for validation this change wrote inline, a query-builder method for a chain this change duplicated.
- **Raise it to the user** when the type is new to the domain, or when it pulls callers outside the change with it: a new DTO, a new value object, an enum that replaces a column's existing stored values. State the signal, the proposed type, the callers it touches, and the cost. The user decides.

Never migrate existing data or change a column's stored values under this skill.

## Report

```markdown
## Simplify

### Cut
- **{what}** — `file:line`. {What it was, what replaced it}. Tests run: {names, result}.

### Shaped
- **{what}** — `file:line`. {Signal → type applied}. Tests run: {names, result}.

### Proposed, not applied
- **{type}** — `file:line`. {Signal, proposed shape, callers affected, why it is the user's call}.

### Held
- {Anything the floor or the restraint rule protected, and why.}
```

Say "nothing to cut, nothing to reshape" plainly when that is the answer. A pass that invents a change to look productive is the failure mode this report format exists to expose.
