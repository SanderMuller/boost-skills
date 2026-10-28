# Intermittent Failures

Read this when the red test, or the reported bug, fails only some of the time: a flaky test, a failure only in CI, a failure that depends on test order, or a failure that depends on timing.

## The rule

Do not treat the flake as fixed when it stops showing. Rerunning until the test passes, raising a timeout, adding a `sleep()` or a retry, or skipping the test hides the failure or makes it rarer, and the cause stays. Use them only as a temporary step that the user agrees to, and report them as `DONE_WITH_CONCERNS`.

## Goal: raise the failure rate

A bug that fails one run in fifty gives no clear red or green signal. Before Phase 4, make it fail often enough that one run tells you something. Then the normal workflow applies.

Run the command that reproduced the failure in a loop with the project's runner, and count the failures. For an order-dependent failure, loop the file or the suite, not the single test:

```bash
fails=0; other=0
for i in $(seq 1 50); do
  vendor/bin/pest --filter='returns zero for a cart with no items' > /dev/null
  case $? in 0) ;; 1) fails=$((fails+1)) ;; *) other=$((other+1)) ;; esac
done
echo "$fails/50 failed, $other/50 errored"
```

Run the command once with its output before the loop. Confirm that it runs the test you mean, and not zero tests: a filter that matches nothing can exit 0, and the loop then reports a false `0/50`. The loop counts only exit 1, a failed assertion, as the bug. When the symptom is an exception, first catch that exception in the test and turn it into a failed assertion, as the bisect step in Phase 3 of the skill describes. Any other error run (exit 2) is a different problem, so investigate it before you trust the rate.

Record the rate. After the fix, run the same loop again. The fix is verified only when the loop shows zero failures at a run count where the old rate predicts several.

## Find which kind it is

| Signal | Likely kind | Where to look |
|---|---|---|
| Passes alone, fails in the full suite | Order dependence | State a previous test leaves behind |
| Fails at certain times, dates, or near midnight | Time dependence | `now()`, time zones, date boundaries |
| Fails under load or in parallel runs | Race | Shared state, missing locks, async jobs |
| Fails only in CI or on one machine | Environment | Runtime version, extensions, env vars, locale, file system |
| Fails with some generated data | Data dependence | Random factory values, unique constraints, sort order |

## Order dependence

1. Run the test alone, then its file, then the full suite. Note where it starts to fail.
2. Run the suite in random order, and pass a seed so that a failing order can run again: `vendor/bin/phpunit --order-by=random --random-order-seed=<n>`. Use a different `<n>` per run, and note each seed that fails. Pest accepts the same two options.
3. Look for state one test leaves for the next: static properties, singletons, a cache, a global config change, a database row that the reset does not remove, a frozen clock that was not released.
4. Find the polluting test by halving the set of tests that run before the failing one, until one test remains.

## Time dependence

- Freeze the clock in the test with the framework's helper, for example `Carbon::setTestNow()` or `$this->travelTo()`. Then set the clock to the failing moment on purpose: the last second of a day, a month end, a daylight-saving change.
- Check which time zone each side uses. The application, the database, and the test can differ.

## Races

- Make the timing window wider on purpose, for example a short `usleep()` between the read and the write, to raise the failure rate. Tag it with the Phase 4 debug marker, so the cleanup search finds it. Keep it in place for both the before and the after loop, so the two rates are comparable. Remove it after the fix is verified, then run the loop once more.
- Look for check-then-act code with no lock or transaction, and for jobs that run in a different order than the code assumes.
- Fix the race with a lock, a transaction, an atomic update, or a unique constraint. A wait for a condition is acceptable in a test; a fixed sleep is not.

## Environment

List the differences between the passing and the failing environment: runtime version, extensions, environment variables, locale, time zone, database engine and version, file system case sensitivity. Change one difference at a time until the local run fails the same way.

## When the rate stays too low

If the failure rate stays too low to give a clear signal, stop. Report what you tried and the rate you reached. Ask the user for one of: access to the environment that fails, a log or trace from a failing run, or permission to add logging that catches the next failure. Report the result as `BLOCKED`, or as `DONE_WITH_CONCERNS` when a fix is in place but not proven.
