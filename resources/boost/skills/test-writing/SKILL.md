---
name: test-writing
description: "Test-writing conventions for clear, targeted tests. Activates when: writing a new test, creating a test file, adding test coverage, naming tests, or when user mentions: test, testing, test case, coverage, assertion, unit test, feature test."
---

# Test Writing Guidelines

Conventions for writing tests that are specific, descriptive, and well-structured. The principles are language-agnostic; the examples use PHP/Pest, but the same rules apply to any test framework.

## Test the Specific Scenario

Don't test general functionality - test the exact scenario that matters:

```php
// Good - tests the specific scenario
it('rejects checkout when the cart is empty')

// Bad - too generic
it('handles checkout')
```

## Name Tests Descriptively

Test names should describe the scenario and the expected outcome:

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

## When Tests Aren't Possible

For behaviour that can't be reproduced with an automated test:

1. **Document why** - explain why automated testing isn't feasible
2. **Provide manual steps** - detailed reproduction steps for QA
3. **Add defensive code** - consider adding validation or error handling
4. **Log for monitoring** - add logging to catch future occurrences
