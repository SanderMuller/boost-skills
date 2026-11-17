---
name: test-writing
description: "Test-writing conventions for clear, targeted tests. Activates when: writing a new test, creating a test file, adding test coverage, naming tests, or when user mentions: test, testing, test case, coverage, assertion, unit test, feature test."
metadata:
  schema-required: "^1"
---

# Test Writing Guidelines

Conventions for writing tests that are specific, descriptive, and well-structured. Treat every test as an **executable specification**: its name reads as a sentence stating the scenario and expected outcome, so the suite documents intended behaviour while it verifies it. The principles are language-agnostic; the examples use PHP/Pest, but the same rules apply to any test framework.

## Which framework to write for

Match the framework to the code under test:

- **Backend / PHP code** → <!--boost:conv path="testing.backend_framework" mode="inline"-->the test runner your project uses — detect it from composer.json scripts or whether vendor/bin/pest vs vendor/bin/phpunit is present, else follow sibling test files<!--boost:conv:end-->.
- **Frontend / JS / TS code** → the project's JavaScript test runner. Detect it from `package.json` — a `test` / `test:js` script, or a `vitest` / `jest` / `mocha` dev-dependency plus its config — else follow sibling test files. Put specs where the existing ones live (e.g. a `tests/Js/` directory, or an `__tests__/` folder next to the source).

A change to frontend logic needs a JS test the same way a change to backend logic needs a backend test — don't leave JS/TS behaviour uncovered just because the default examples below are PHP. Never write a test in any framework on the project's forbidden list (<!--boost:conv path="testing.forbid" mode="inline"-->none — no restriction<!--boost:conv:end-->), or in any framework a listed **category alias** expands to; if asked to, redirect to the appropriate framework above.

Category alias expansions (a forbidden alias forbids every framework in its set):

| Alias | Expands to |
|---|---|
| `js-test-frameworks` | `vitest`, `jest`, `mocha`, `cypress`, `playwright` |
| `browser-test-frameworks` | `cypress`, `playwright` |
| `php-browser-tests` | `dusk`, `panther` |

So `forbid: ['js-test-frameworks']` refuses a Cypress test even though `cypress` isn't listed by name — it's a member of the alias set. (This expansion is the schema's canonical alias map; adding an alias is a minor schema bump, removing/redefining one is major.)

## Test the Specific Scenario

Don't test general functionality - test the exact scenario that matters:

```php
// Good - tests the specific scenario
it('rejects checkout when the cart is empty')

// Bad - too generic
it('handles checkout')
```

## Name Tests Descriptively

**Gate: read the name aloud.** Does it state the scenario and the expected outcome as one executable-specification sentence? If not, rename before you write the assertions. Test names should describe the scenario and the expected outcome:

```php
// Good
it('blocks login after five failed attempts')
it('retries the webhook on a temporary failure')
it('rounds the invoice total to two decimal places')

// Bad
it('login works')
it('webhook')
it('invoice')
```

## Test Structure

Follow the Arrange-Act-Assert pattern:

```php
it('grants access to a paid account', function () {
    // Arrange: Set up the scenario
    $account = Account::factory()->create(['plan' => 'pro']);

    // Act: Perform the action
    $response = $this->actingAs($account->owner)
        ->get(route('reports.index'));

    // Assert: Verify the outcome
    $response->assertOk();
    $response->assertSee('Monthly report');
});
```

Test **one behavior per test**. The example above asserts twice (`assertOk` and `assertSee`) — that is fine, because both assertions verify the *same* behaviour (a paid account can reach the report). What to avoid is **assertion roulette**: piling assertions about *unrelated* behaviours into one test, so a failure doesn't reveal which behaviour broke. Split those into separate tests. ("One behaviour per test" is the rule — not the common misreading "one *assertion* per test".)

## Prove That a Green Test Reaches the Change

A green test proves that the test passed, not that it ran the line you changed. A test that never reaches the changed branch stays green through every later edit, even an edit that deletes the change. These mechanisms skip a branch without a sign:

- **Memoisation or caching** — `once()`, a singleton, a cached config or query result. The first call fills the cache, and every later assertion reads the cached value.
- **An early return or a short-circuit above the change** — a guard or a `return` on the path the fixture happens to take.
- **A fixture that misses the precondition** — the factory state, the flag, or the role the branch needs is not set, so the code takes the other branch.
- **A base test case that several subclasses share** — the fixture keeps the same state for every subclass, so each subclass runs the same path. Check that each subclass sets the state that selects its own path.

When the test was written after the code, or the change sits behind one of these mechanisms, run the inversion. Undo the change in the source files only, keep the test, and run it. It must fail with the behaviour its name describes. A failure because a file is empty or missing does not count. Then bring the change back and run the test again.

- **All of the change is uncommitted:** run `git stash push --include-untracked -- <changed source paths>`, run the test, then `git stash pop`. Name the source paths: a bare `git stash` also takes the new test.
- **Any part of the change is committed:** first copy every changed source file aside. Find the revision before the change with `rev=$(git merge-base HEAD origin/<base>)`, and list the changed files with `git diff --name-status "$rev" -- <source paths>`. Restore each modified or deleted file, and the old path of each renamed file, with `git restore --source="$rev" -- <path>`. Remove each added file and the new path of each renamed file. Run the test, then put every copy back and remove the restored old paths.

A test written red-first, as the `bug-fixing` skill requires, already has this proof: the red run is the proof.

## An Assertion That Cannot Fail Is Not Coverage

A test that passes for a reason its name does not state is worse than no test. It reports coverage the suite does not have, and its assertions can go wrong without anyone seeing it.

### Expect the exception at the call that throws

With `expectException()`, the test ends at the throw, so no line after the throwing call runs. A post-condition placed there can be wrong for years and still pass. Pest's `->throws()` has the same effect. Put the expectation directly above the call under test, so the arrange block cannot satisfy it:

```php
// ❌ Armed for the whole test: when findOrFail() throws, the test passes without applyCoupon()
$this->expectException(ModelNotFoundException::class);
$order = Order::findOrFail($orderId);
$order->applyCoupon('UNKNOWN');

// ✅ Armed for one call only
$order = Order::findOrFail($orderId);
$this->expectException(ModelNotFoundException::class);
$order->applyCoupon('UNKNOWN');
```

When the test also has post-conditions, catch the exception instead, so they run. In Laravel, `assertThrows()` does this:

```php
$this->assertThrows(fn () => $order->cancel(), OrderAlreadyShippedException::class);

expect($order->refresh()->status)->toBe(OrderStatus::Shipped);
```

Assert the value that the act tried to change. Do not compare the value before and after the act: when the fixture already holds the value that the act writes, that comparison passes even if the act ran.

### Not throwing is not an assertion

`expectNotToPerformAssertions()`, a bare `assertNotNull()` on a return type that cannot be null, and Vitest's `expect(() => run()).not.toThrow()` prove only that nothing threw. That also holds when the code did nothing. Assert the outcome that the absence of a crash should produce: the row that is unchanged, the record that survived, the fallback value, the error that was logged. Keep `not.toThrow()` only where not crashing is the contract, and assert the graceful outcome on the next line.

Vitest's `toBeDefined()` has the same problem: it excludes only `undefined`, so it passes for `null`. Use `toBe()` for a primitive or the same object, and `toEqual()` or `toStrictEqual()` for an object compared by value.

### JSON absence and null checks in Laravel

`assertJsonMissing(['coupon'])` searches for the list value `"coupon"`, not for the key, so it passes when the key is present. `assertJsonPath('coupon', null)` passes when the key is absent, because a missing path reads as `null`.

```php
// ✅ The key is absent
$response->assertJsonMissingPath('coupon');

// ✅ The key is present and holds null
$response->assertJsonStructure(['coupon'])->assertJsonPath('coupon', null);

// ❌ A value search: it cannot fail on the key
$response->assertJsonMissing(['coupon']);
```

### A test that skips or never runs

- **Do not skip a test when a file the repository owns is missing.** A skip on `! file_exists(...)` turns a moved file into a silent pass. Assert the file, or the output that needs it. Skip only for a real environment gap, such as a missing PHP extension or an external service.
- **Every PHPUnit test method needs `#[Test]` or a `test` prefix.** PHPUnit 11 and older also accept a `@test` docblock. A method without one of these never runs, so it never fails.

## Tests That Do Not Last

A test earns its cost by guarding behaviour that real users or real data reach.

- **Do not test dev-only tooling.** Examples are a local demo seeder, a fixture writer, a dev-login helper, and a command that runs only locally. The developer who runs such a tool checks it, and sees a break at once. Keep one test of a tool that writes or deletes data: the test that it refuses to run outside the local environment. For a bug in such a tool, the `bug-fixing` red test still applies, but it can stay a scratch run that you do not commit.
- **In an application with one production database, a test of a migration is temporary.** Once production has run the migration, a backfill or data conversion it tests has already happened to all real data. Propose to delete the test then, in a change scoped to that cleanup, or leave it to the next migration squash. The base branch or a release tag does not prove that production ran a migration, because a deploy can lag behind both. When no deploy record settles it, ask, or keep the test. Keep the test of a migration that a package ships, or that runs again for each new install or tenant.
- **A test of a one-off is temporary too.** A backfill command, a repair job, or a one-off admin action can have a test while it waits to run. Propose to delete the test together with the one-off once production has run it. A scheduled command, or an action people run again and again, is not a one-off.

## How Many Tests

Test volume is maintenance cost. Cover each behaviour the task asks for and the failure modes that matter, then stop.

- **Size the suite like the sibling test files.** Read them for shape and length first. Roughly one focused test per stated behaviour is the target. A sibling file is the reference, never an argument to add cases it happens to have or to skip cases this change needs.
- **Do not keep a scratch check as an extra test.** A one-off script, a REPL snippet, or a quick assertion written to convince yourself mid-task is a verification step, and it goes once it has served its purpose. Where that check is the coverage a rule requires — the regression test for a bug fix, the test for changed logic — rewrite it as a proper named test instead of committing it as it stands.
- **One dataset row per branch the code takes, not one per value.** A row over a value the code never branches on repeats the test: every locale when only "signed in or not" branches, every status pair when only the target status branches. Keep the real boundaries: empty, null, zero, maximum. Keep exhaustiveness guards, such as one row per enum case, and the range rows that a bug fix adds (`bug-fixing`).
- **One test per shared save path, not one per field.** When several fields go through the same save, one test that sets them all and asserts each value covers the same rules.
- **Do not copy a presence check into every sibling file.** When one page renders all the components, one test asserts them all.
- **In Laravel, a test that needs no application extends `PHPUnit\Framework\TestCase`.** It skips the framework boot. Keep the application test case for anything that uses a model, a cast, a facade, a macro, or a helper such as `config()` or `__()`. On the plain base, a facade or a helper throws. A macro or other static state exists only when an earlier test in the same process registered it, so that test passes or fails with the test order.
- **A whole new test layer is the user's decision.** A required test — a regression test for a bug fix, a test for changed backend or frontend logic — is written whatever the surrounding suite looks like, in the closest runner that can reach the behaviour. Only when no configured runner can reach it at all, propose the new layer, say the behaviour is unverified until the user decides, and follow *When Tests Aren't Possible* below in the meantime.

For a verdict on tests that already exist — which prove nothing, and what has no test at all — use the `test-value` skill.

## When Tests Aren't Possible

For behaviour that can't be reproduced with an automated test:

1. **Document why** - explain why automated testing isn't feasible
2. **Provide manual steps** - detailed reproduction steps for QA
3. **Propose defensive code** - where validation or error handling would contain the failure, propose it to the user; do not add it unasked
4. **Propose logging** - propose logging that catches the next occurrence, for the user to approve
