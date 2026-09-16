---
name: php-generics
description: "PHP docblock generics and shape conventions for static analysis: name a repeated array shape with @phpstan-type, import it across files, bind a generic base class with @extends / @implements / @use, and type a class-name parameter as class-string. Activates when: writing or tightening a docblock, a fixed-shape array return, a class-name parameter, a subclass of a generic base, a repeated array{...} shape, a Pest dataset closure, or when the user mentions: generics, @template, @extends, @use, @implements, @phpstan-type, @phpstan-import-type, class-string, array shape, type coverage."
metadata:
  boost-tags: "php"
---

# PHP Docblock Generics and Shapes

A signature says what a value is. A docblock says what is *inside* it — which class a collection holds, which keys an array carries, which base a class name extends. Static analysis only checks what one of the two states, so the conventions below are what make a strict level reach inside a value.

Framework-specific bindings live with their own skill. Where the project ships `eloquent-models`, that skill carries the model, factory, query-builder and collection bindings. For the two annotations that fix a PHPStan error about a return type, see *Fixing PHPStan Errors* in the `backend-quality` skill.

## When to use this skill

- Writing or reviewing a docblock that describes an array shape, a collection, or a class name
- A subclass of a generic base class, or a trait with a type parameter
- A repeated `array{...}` shape appearing in more than one docblock
- Raising type coverage, or a PHPStan error about `mixed` inside an array

## Name a Repeated Array Shape

Name an inline `array{...}` shape that repeats across three or more docblocks. Declare it once on the class docblock with `@phpstan-type`, then use the name.

```php
/**
 * @phpstan-type OrderLine array{sku: string, quantity: int, total: float}
 */
final class OrderSummary
{
    /** @return list<OrderLine> */
    public function lines(): array { /* ... */ }

    /** @param list<OrderLine> $lines */
    public function withLines(array $lines): self { /* ... */ }
}
```

When a second class needs the same shape, import it rather than copying the braces:

```php
/**
 * @phpstan-import-type OrderLine from OrderSummary
 */
final class OrderExport
{
    /** @param list<OrderLine> $lines */
    public function render(array $lines): string { /* ... */ }
}
```

The win is one edit instead of many: a copied shape has to be corrected by hand in every docblock that holds it, and the copy someone misses is the one that keeps passing. Name the shape where it is produced, and import it where it is consumed.

Do not name a shape used once. A single `array{...}` in place reads better than a name the reader has to look up.

## Prefer a Shape Over an Open Array

`array<string, mixed>` tells a caller nothing. Write the keys.

```php
// ❌ WRONG
/** @return array<string, mixed> */
public function summary(): array { /* ... */ }

// ✅ CORRECT
/** @return array{id: int, name: string, total: int} */
public function summary(): array { /* ... */ }
```

Two limits:

- **Past roughly eight keys, write an object instead.** A readonly DTO carries the same information under a name, and callers get autocompletion from it.
- **Do not narrow what is genuinely open.** Where a value arrives from a config file, a decoded payload, or a parent's `array<string, mixed>`, `mixed` in the shape is the honest type. A narrowed annotation that the data can violate is worse than the open one, because analysis stops checking the cast.

## Bind Every Generic Base

A class that extends or implements a generic type must bind its parameters, or every caller sees the unbound base.

- `@extends Base<TKey, TValue>` on a class extending a generic class
- `@implements Contract<TValue>` on a class implementing a generic interface
- `@use SomeTrait<TValue>` on a trait use with a type parameter

A template declared on a subclass does not bind its base. `@template` and `@template-covariant` introduce a parameter *this* class is generic over, which a class with no generic parent may legitimately do. What they never do is satisfy the base: a subclass that declares a template and omits `@extends` leaves the parent unbound, and the analyser falls back to the widest type.

```php
// ❌ WRONG — a template of its own, but the base is never bound
/**
 * @template-covariant TValue
 */
final class CommentCollection extends Collection {}

// ✅ CORRECT — the base is bound to a concrete type
/**
 * @extends Collection<array-key, Comment>
 */
final class CommentCollection extends Collection {}
```

Default a key parameter to `array-key` unless the collection is genuinely integer-keyed. When a base is itself templated, bind the parameter in the subclass; when a base is already bound to a concrete type, the subclass inherits it and needs no redeclaration.

Once `@extends` carries the type, delete what it replaces — a `@property Item[] $items` line, or a `@method self add(Item $item)` override that only restates the base.

## Type a Class Name as `class-string`

A parameter that holds a class name and gets instantiated, resolved from a container, or looked up in a table is a `class-string<T>`, never a bare `string`. The bound is what the value must extend or implement.

```php
/**
 * @param class-string<PaymentMethod> $method
 */
public function resolve(string $method): PaymentMethod
{
    return new $method();
}
```

A dispatch table follows: `array<string, class-string<PaymentMethod>>` rather than `array<string, string>`. Analysis then rejects a class that does not satisfy the bound at the call site, instead of at run time.

## Dataset Closures Are Documentation

A test runner that builds cases from a closure usually cannot infer the shape, so the test method's parameters fall back to `mixed`. Annotate the closure inline:

```php
dataset('elevated_roles',
    /** @return array<string, array{Role}> */
    fn (): array => [
        'admin' => [Role::Admin],
        'auditor' => [Role::Auditor],
    ]
);
```

A `@return` docblock on an arrow function or a closure is not enforced the way one on a named function is: a violated shape raises `return.type` on a function and nothing on either closure form, and the call site infers the literal value rather than the declared type. Treat the annotation as documentation and an IDE hint, not as a check that can fail. (Observed on PHPStan 2.2 at level 9; `@return never` is a documented special case.)

## Checklist

- [ ] A shape repeated in three or more docblocks is a `@phpstan-type`, imported with `@phpstan-import-type` where a second file needs it
- [ ] Fixed-shape arrays use `array{...}`, or a DTO past roughly eight keys
- [ ] Nothing is narrowed that the data can actually violate
- [ ] Every generic base is bound with `@extends` / `@implements` / `@use`
- [ ] A subclass of a generic base binds it with `@extends`, whether or not the subclass declares templates of its own
- [ ] Docblock lines the binding replaced are deleted
- [ ] A class-name parameter that gets instantiated is `class-string<T>`
