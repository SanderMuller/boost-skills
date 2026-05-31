---
name: bug-fixing
description: "Test-driven bug fixing workflow. Activates when: fixing bugs, debugging issues, resolving defects, investigating errors, or when user mentions: bug, fix, broken, not working, error, issue, defect, regression."
argument-hint: [bug description or issue reference]
metadata:
  schema-required: "^1"
---

# Test-Driven Bug Fixing

A disciplined approach to fixing bugs: **reproduce first, fix second**. Write a failing test that captures the bug, then fix the code to make it pass.

## Test framework

This project's test runner is <!--boost:conv path="testing.backend_framework" mode="inline" fallback="auto-detected from the project layout — composer.json scripts, or vendor/bin/pest vs vendor/bin/phpunit presence; ask the user if ambiguous"-->. Write and run tests with that runner.

If the user asks for a test in a framework on the forbidden list (<!--boost:conv path="testing.forbid" mode="inline" fallback="none — no restriction"-->) — or in a framework a listed category alias expands to — refuse and redirect to the runner named above. Alias expansions: `js-test-frameworks` = vitest/jest/mocha/cypress/playwright; `browser-test-frameworks` = cypress/playwright; `php-browser-tests` = dusk/panther. (So a forbidden `js-test-frameworks` refuses a Cypress test even though `cypress` isn't named.)

## Core Principle

**Never start by trying to fix the bug.** Instead:

1. Understand the bug
2. Write a test that reproduces it (fails)
3. Fix the bug
4. Verify the test passes
5. Document what was wrong

## When to Use This Skill

Use this skill when:
- Fixing reported bugs or defects
- Investigating unexpected behavior
- Resolving regression issues
- Debugging error reports

## Workflow

### Phase 1: Understand the Bug

Before writing any code:

1. **Gather information**
   - Read any linked issues or error reports
   - Ask clarifying questions if reproduction steps are unclear

2. **Identify the scope**
   - Which files/classes are likely involved?
   - Can this be reproduced with a test?

3. **Confirm understanding**
   - Summarize the bug in one sentence
   - State the expected vs actual behavior
   - Get user confirmation before proceeding

### Phase 2: Write the Failing Test

**This is the critical step.** Write a test that:

1. **Reproduces the exact scenario** that triggers the bug
2. **Fails with the current code** (proving the bug exists)
3. **Will pass when the bug is fixed**

```php
it('handles edge case with empty array input', function () {
    // Arrange: Set up the scenario that triggers the bug
    $cart = new Cart(items: []);

    // Act: Perform the action that fails
    $total = $cart->total();

    // Assert: What SHOULD happen (currently fails)
    expect($total)->toBe(0);
});
```

### Phase 3: Verify Test Fails

Run the test to confirm it fails. Use the project's configured runner (named at the top of this skill):

```bash
# pest
vendor/bin/pest --filter=handles_edge_case_with_empty_array_input

# phpunit
vendor/bin/phpunit --filter handles_edge_case_with_empty_array_input
```

**If the test passes**: The bug may not be what we thought. Revisit Phase 1.

**If the test fails**: Proceed to fixing.

### Phase 4: Fix the Bug

Use a subagent to investigate and fix:

```
Task: Fix the bug causing [test name] to fail.

Context:
- Test file: tests/RelevantTest.php
- Test method: handles_edge_case_with_empty_array_input
- Current error: [paste error message]

The test reproduces the bug. Find and fix the root cause.
Do NOT modify the test - only fix the production code.
Run the test after each change to verify progress.
```

### Phase 5: Verify the Fix

Run quality checks based on which files were changed:

- Use the `backend-quality` skill (Tier 1 only: Pint + related tests). PHPStan and the full test suite run at completion — see the `backend-quality` skill for details.

### Phase 6: Document the Fix

When creating/updating a PR, include a **technical** description:

```markdown
### What was the bug?

Description of the root cause with file and line references.

### How was it fixed?

Description of the fix and why it works.

### Test coverage

Added `test_name` to verify the fix and prevent regression.
```

## Test Conventions

For test conventions — testing the specific scenario, naming tests descriptively, structure, and what to do when tests aren't possible — see the `test-writing` skill.
