---
name: test-writing
description: "Test-writing conventions for clear, targeted tests. Activates when: writing a new test, creating a test file, adding test coverage, naming tests, or when user mentions: test, testing, test case, coverage, assertion, unit test, feature test."
metadata:
  schema-required: "^1"
---

# Test Writing Guidelines

Conventions for writing tests that are specific, descriptive, and well-structured. Treat every test as an **executable specification**: its name reads as a sentence stating the scenario and expected outcome, so the suite documents intended behaviour while it verifies it. The principles are language-agnostic; the examples use PHP/Pest, but the same rules apply to any test framework.

## Which framework to write for

Write tests in <!--boost:conv path="testing.backend_framework" mode="inline"-->the test runner your project uses — detect it from composer.json scripts or whether vendor/bin/pest vs vendor/bin/phpunit is present, else follow sibling test files<!--boost:conv:end-->. Never write a test in any framework on the project's forbidden list (<!--boost:conv path="testing.forbid" mode="inline"-->none — no restriction<!--boost:conv:end-->), or in any framework a listed **category alias** expands to; if asked to, redirect to the framework named above.

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

## When Tests Aren't Possible

For behaviour that can't be reproduced with an automated test:

1. **Document why** - explain why automated testing isn't feasible
2. **Provide manual steps** - detailed reproduction steps for QA
3. **Add defensive code** - consider adding validation or error handling
4. **Log for monitoring** - add logging to catch future occurrences
