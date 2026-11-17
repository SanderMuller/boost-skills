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
| An array shape passed across two or more boundaries, key reads with `?? null` or `data_get()` because some producers leave a key out, or a positional tuple (`[$order, $total]`, `$pair[0]`) read away from the line that built it | **Readonly DTO** — see [Array or Object](#array-or-object) |
| Three or more arguments that always travel together | **DTO** or a value object |
| A primitive with invariants — a duration, a colour, a locale code validated in more than one place | **Value object**, or a model cast |
| The same query chain repeated in two or more places | **Custom query-builder method**, named per the project's convention |
| A getter that only reformats a column | Plain getter on the model, where that is the project's convention |

A signal is a question, not a verdict. Read the call sites before you answer it: two comparisons against the same two strings in one method are not a type, they are two comparisons.

## Array or Object

A docblock array shape is a claim that nothing checks at runtime. A wrong key, a key that one code path leaves out, or an `int` that arrives as a string all pass, and static analysis builds on the claim as if it were true. A `final readonly` class states the shape once, and PHP checks its types each time the object is built.

**Keep the array when the array is the contract**, and convert at that boundary:

- A JSON or API response, view data, a vendor request or response, a JSON column, or config.
- The payload of a queued job that already exists (see below).

**Also keep the array** for a list of one type (`list<string>`, `list<Order>`), or for a shape that one method builds and reads. When a shape stays an array and repeats in docblocks, name it with `@phpstan-type`, as the `php-generics` skill describes.

**Build the DTO this way:**

- **Parse at the boundary.** Turn the vendor payload, the request input or the config value into the object once, where it enters the code. Everything after that gets the object.
- **One named constructor per source**, such as `fromRequest()` or `fromApi()`. Move the validation that already exists into it. New validation, and a typed property that rejects or casts a value the code accepted before, change the behaviour: report them, or raise them to the user.
- **`toArray()` where the array is the contract.** It must give the exact keys that the consumer reads. Compare the old and the new array for each producer. A key that was absent and is now `null`, or the reverse, changes the output for a consumer that tells the two apart.
- **Behaviour on the object.** A check that several callers repeat on the shape becomes a method of the object.

**Do not change the type of an existing job's property while old payloads can be on the queue.** A job that is on the queue at deploy time holds the old serialized payload. When its property changes from `array` to an object type, the worker fails on that job with a `TypeError` as it unserializes it. A rollback fails the same way in reverse. Keep the property an array, dispatch with `$object->toArray()`, and build the object again in the job's handler. The named constructor must accept the keys that old payloads carry.

Cached and session values carry the same risk. An old entry comes back as an array, and the new code fails when it uses it. A cache with `serializable_classes` set, or a session with JSON serialization, does not give an object back at all.

## Restraint — a New Type Is a Decision

Do not add abstraction until something varies. That splits this skill's authority in two:

- **Apply it yourself** when the type replaces something this change wrote and stays inside the change: an enum for constants this change added, a form request for validation this change wrote inline, a query-builder method for a chain this change duplicated, a readonly DTO for an array shape this change introduced that no code outside the change reads.
- **Raise it to the user** when the type names a concept new to the domain, or when it pulls callers outside the change with it: a DTO that code outside the change must use, a new value object, an enum replacing a column's stored values. State the signal, the proposed type, the callers it touches, and the cost. The user decides.

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
