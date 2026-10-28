---
name: autoresearch
description: "Autonomous performance optimization loop. Iteratively reduces query count and execution time by modifying code, benchmarking against measured noise, and keeping/reverting changes — then distills the kept changes down to the ones worth their complexity. Activates when: optimizing performance, reducing overhead, improving execution time, benchmarking, or when user mentions: autoresearch, optimize, performance, benchmark."
argument-hint: "[description of what to optimize]"
metadata:
  boost-tags: "php"
---

# Autoresearch — Autonomous Performance Optimization

Inspired by [Karpathy's autoresearch](https://github.com/karpathy/autoresearch). Applies constraint-driven autonomous iteration to reduce execution time and overhead for any measurable code path.

**Core idea:** Modify one thing, measure it against the code before it, keep it if the gain beats the noise, revert if not, repeat. Then distill: remove every kept change whose gain does not pay for its complexity.

**Two gates, on purpose.** The loop keeps liberally: a small gain above noise stays in as `tentative`, because a small step can enable a bigger one. The distill phase judges strictly, and every change must still pay for itself on the final tree. Do not tighten the loop gate to do the distill phase's job.

## Subcommands

| Subcommand | Purpose |
|------------|---------|
| `/autoresearch` | Run the autonomous optimization loop |
| `/autoresearch:plan` | Interactive wizard: analyze bottlenecks, set up benchmark, noise floor, and research doc |
| `/autoresearch:distill` | Prune the kept changes to the ones worth keeping, then verify the result |

## When to Activate

- User invokes `/autoresearch` or mentions autoresearch
- User wants to reduce execution time for a specific operation
- User says "optimize", "slow", "benchmark", "performance"
- Any task requiring iterative performance improvement with measurable outcomes

## Directory Structure

All autoresearch artifacts live in `autoresearch/` (gitignored):

```
autoresearch/
├── {slug}-research.md          # Research document (bottlenecks, scope, thresholds, budget)
├── {slug}-bench.php            # Benchmark script — one sample per process
├── {slug}-compare.sh           # Alternating base-vs-candidate runner
├── {slug}-progress.md          # Iteration log — updated after EVERY attempt
├── {slug}-ideas.md             # Ideas backlog — promising ideas not tried yet
└── patches/                    # Saved diffs of EVERY attempt, kept or not
    ├── 001-keep-description.patch
    ├── 002-discard-description.patch
    └── ...
```

Use kebab-case slugs derived from the target (e.g., `wildcard-expansion`, `ruleset-compilation`).

---

## /autoresearch:plan — Setup Wizard

### Step 1: Identify the Target

Ask the user what to optimize, or accept it as an argument. The target can be:

- **A method/class** — trace the execution flow
- **An existing benchmark** — use `benchmark.php` as a starting point
- **Any code path** — identify the entry point and trace the execution flow

### Step 2: Create the Working Branch

The loop runs `git reset --hard` and checks out other commits, so it needs a clean tree on a branch of its own:

```bash
git status --porcelain                  # must print nothing — stop and ask the user if it does
git check-ignore -q autoresearch/ || echo "autoresearch/" >> "$(git rev-parse --git-path info/exclude)"
git switch -c autoresearch/{slug}
git rev-parse HEAD                      # the base commit
```

The exclude file ignores the directory locally, so the tree stays clean without a `.gitignore` commit on the branch. Write the base commit into the research doc in Step 7. Distill measures against it.

### Step 3: Benchmark Script

Create a benchmark script at `autoresearch/{slug}-bench.php`. One run of the script produces **one sample**. The runner in Step 4 launches it many times, so each sample comes from its own process. Repeats inside one process share opcache, memoization, and GC state, so they are not independent samples.

The script:

1. **Bootstraps the test environment** — the same way the project's own test suite does
2. **Creates realistic test data** — cover the "fully loaded" scenario
3. **Reads the scenario from `AUTORESEARCH_SCENARIO`** (`main` by default, `holdout` for the second scenario — see below)
4. **Runs a warmup iteration** to prime caches
5. **Runs 5 iterations** and reports their median as the sample, measured via `hrtime(true)`
6. **Exits non-zero if the target fails** — a broken target is a crash, not a fast run
7. **Outputs METRIC lines to stdout** (machine-readable)
8. **Outputs diagnostics to stderr** (human-readable breakdown)

Template for METRIC output:
```
METRIC execution_median_ms={N.NN}
METRIC execution_mean_ms={N.NN}
```

**Holdout scenario.** Define a second workload under `AUTORESEARCH_SCENARIO=holdout`, for example other input sizes or another data shape. The loop never runs it. Distill runs it once at the end to catch changes that only fit the main scenario.

> **Laravel projects → jump to the [Laravel deep-dive variations](#laravel-projects--deep-dive-variations) section NOW before drafting your benchmark.** The transactional template (Eloquent + factories + `DB::beginTransaction`/`rollBack` + `query_count` metric) is structurally different from the generic shape above. Skipping the deep-dive and drafting a generic benchmark for a Laravel target will leave you optimizing the wrong metric.

### Step 4: Compare Runner

Create `autoresearch/{slug}-compare.sh`. It checks out the base and the candidate in turn, runs one benchmark process per sample, alternates which side runs first, and returns the tree to the branch it started on:

```bash
#!/usr/bin/env bash
# Usage: autoresearch/{slug}-compare.sh <base-ref> <cand-ref> [pairs]
set -euo pipefail
BASE=$(git rev-parse "$1"); CAND=$(git rev-parse "$2"); PAIRS=${3:-10}
BENCH=autoresearch/{slug}-bench.php
ORIG=$(git symbolic-ref --short HEAD)
[ -z "$(git status --porcelain)" ] || { echo "compare: commit, stash, or ignore every change first" >&2; exit 1; }
OUT=$(mktemp -d)
# The tree was clean at start, so --force only discards what a benchmark run wrote.
trap 'git checkout --quiet --force "$ORIG"; rm -rf "$OUT"' EXIT

sample() { # $1 = side, $2 = sha
  git checkout --quiet --detach "$2"
  php "$BENCH" > "$OUT/$1.last" 2>> "$OUT/err.log" || { tail -20 "$OUT/err.log" >&2; exit 1; }
  [ -z "$(git status --porcelain)" ] || { echo "compare: the benchmark changed or created files" >&2; exit 1; }
  sed -n 's/^METRIC execution_median_ms=//p' "$OUT/$1.last" >> "$OUT/$1"
}

for i in $(seq 1 "$PAIRS"); do
  if (( i % 2 )); then sample base "$BASE"; sample cand "$CAND"
  else sample cand "$CAND"; sample base "$BASE"; fi
done

sed 's/^METRIC /METRIC base_/' "$OUT/base.last"
sed 's/^METRIC /METRIC cand_/' "$OUT/cand.last"
php -r '
$read = function (string $file, int $pairs): array {
    $v = file($file, FILE_IGNORE_NEW_LINES) ?: [];
    foreach ($v as $x) { if (! is_numeric($x) || $x <= 0) { fwrite(STDERR, "invalid sample: $x\n"); exit(1); } }
    if (count($v) !== $pairs) { fwrite(STDERR, "expected $pairs samples in $file, got " . count($v) . "\n"); exit(1); }
    return array_map("floatval", $v);
};
$b = $read($argv[1], (int) $argv[3]);
$c = $read($argv[2], (int) $argv[3]);
$med = function (array $a): float { sort($a); $n = count($a); return $n % 2 ? $a[intdiv($n, 2)] : ($a[$n / 2 - 1] + $a[$n / 2]) / 2; };
$d = array_map(fn ($x, $y) => $x - $y, $b, $c);
$m = $med($d);
$mad = $med(array_map(fn ($x) => abs($x - $m), $d));
$se = max(1.858 * $mad / sqrt(count($d)), 0.01); // standard error of the median difference
printf("METRIC base_median_ms=%.2f\nMETRIC cand_median_ms=%.2f\nMETRIC delta_ms=%.2f\nMETRIC delta_pct=%.2f\nMETRIC diff_mad_ms=%.2f\nMETRIC conf=%.2f\n",
    $med($b), $med($c), $m, 100 * $m / $med($b), $mad, $m / $se);
' "$OUT/base" "$OUT/cand" "$PAIRS"
```

`base_median_ms` and `cand_median_ms` are the medians over all samples. The `Median (ms)` progress column takes `cand_median_ms`. `delta_ms` is the median of the paired differences `base − candidate`: positive means the candidate is faster. `conf` is `delta_ms` divided by its standard error, so it grows with the number of pairs: a re-run with more pairs can confirm a real small gain. The script resolves both refs before its first checkout, so `HEAD~1` is safe to pass. Choose `pairs` so one compare takes about two minutes or less, and never fewer than 5. The script fails when the tree has any change or untracked file, when a benchmark run changes or creates a file outside ignored paths, or when a process does not print exactly one positive timing.

The runner needs a clean tree: commit the candidate before running it.

### Step 5: Calibrate the Noise Floor

Run the runner with the same commit on both sides (an A/A run):

```bash
bash autoresearch/{slug}-compare.sh HEAD HEAD
```

Record `diff_mad_ms` (the noise of one sample pair) and the A/A `conf` in the research doc.

Fix the benchmark before the loop starts when either of these holds. More in-process iterations, a larger input, or a quieter machine usually help.

- The A/A `|conf|` is 2 or more. Identical code should not differ, so the run order biases the result.
- `diff_mad_ms` is more than 5% of the median. Real gains of a few percent will drown.

`conf` is a practical heuristic, not a significance test. Across many adaptive trials, some changes will pass by luck, and the distill phase exists to catch them.

### Step 6: Profile the Time Split

Before analyzing bottlenecks, **profile where execution time is actually spent**. Instrument the code path into phases (validation, setup, core work, serialization, etc.) and measure each phase's share of total time — use whatever profiling helper or simple `hrtime(true)` checkpoints the project provides.

This prevents wasting iterations optimizing a phase that's only a small fraction of total time. Knowing the time split tells you which phase to target first.

### Step 7: Analyze Bottlenecks

Run the benchmark and analyze both the diagnostics AND the time profile. Document bottlenecks in `autoresearch/{slug}-research.md`:

```markdown
# Autoresearch: {Description} Performance Optimization

## Objective

{What is being optimized and why it matters.}

## Scope

Files that may be modified:

- `path/to/File.php` — {why}

## Branch

`autoresearch/{slug}`, base commit `{sha}`.

## Measurement

- Pairs per compare: {N}
- Noise per pair (`diff_mad_ms`): {N.NN}ms (A/A conf: {N.NN})
- Holdout scenario: {what it runs and how it differs from main}

## Decision Thresholds

- `min_gain_pct`: 2 — a simple change needs this much to be `keep`
- `complex_min_gain_pct`: 5 — a complex change needs this much to be `keep`
- A change is complex when it adds more than 15 net non-test lines, or raises any cost flag (see Phase 6)

## Budget

- `max_iterations`: 30
- Goal (optional): {a target that ends the loop early, for example a median under 150ms}

## Baseline Measurements

| Scenario | Execution Time |
|----------|---------------|
| {scenario} | ~{N}ms |

## Time Profile

{Which phase takes the most time — validation, setup, core work, serialization, etc.}

## Known Bottlenecks

1. **{Description}** — {explanation}

## Constraints

- Existing tests must pass
- PHPStan must pass
- Public API must remain unchanged
- No new dependencies

## Strategies Attempted

(Updated as experiments are conducted — what each direction taught, including dead ends)

## Results

(Updated with final measurements)
```

### Step 8: Record Baseline

Create the progress file at `autoresearch/{slug}-progress.md`, and an empty `autoresearch/{slug}-ideas.md`:

```markdown
# Autoresearch Progress: {slug}

**Baseline:** {N}ms · **Noise per pair:** {N.NN}ms

| # | Commit | Median (ms) | Δ% | Conf | Cost | Status | Description | Learned |
|---|--------|-------------|----|------|------|--------|-------------|---------|
| 0 | {sha} | {N} | — | — | — | baseline | initial state | — |
```

### Step 9: Confirm and Launch

Present the research document, time profile, noise measurement, and baseline to the user. Ask:

1. Are the scope constraints correct?
2. Are there any files that should NOT be modified?
3. Are the decision thresholds and the iteration budget right?
4. Should the loop start now?

---

## /autoresearch — The Optimization Loop

### Prerequisites

Verify research doc, benchmark script, compare runner, noise measurement, and baseline exist, and that the current branch is `autoresearch/{slug}` with a clean tree. If anything is missing, run `/autoresearch:plan` first.

### The Loop

```
LOOP (until a stop condition holds):
  1. REVIEW  — Read research doc, progress file, ideas file, git history
  2. IDEATE  — Pick the next bottleneck to address
  3. MODIFY  — Make ONE focused change to in-scope files
  4. COMMIT  — Git commit before verification (enables clean revert)
  5. VERIFY  — Run checks, then the compare runner against the previous commit
  6. DECIDE  — keep / tentative / discard / checks_failed / crash
  7. LOG     — Update progress file IMMEDIATELY (not in bulk)
  8. REPEAT
```

### Phase 1: Review

Before each iteration:
1. Read the research document for bottleneck context
2. Read the progress file — check what worked/failed and what each attempt taught
3. Read the ideas file
4. Check recent git history: `git log --oneline -10`

Do NOT re-run the benchmark in the review phase — only read existing data. The benchmark runs in Phase 5.

After a context compaction, these four reads are enough to resume, because the files hold everything the loop has learned. If an interrupted compare left HEAD detached, run `git checkout autoresearch/{slug}` first.

### Phase 2: Ideate

Pick the next optimization. Priority order:
1. **Fix crashes** from previous iteration
2. **Exploit successes** — if last change helped, try variants in the same direction
3. **Address highest-impact bottleneck** — use the time profile to target the biggest phase first
4. **Try the ideas backlog** — prune stale or already-tried entries first
5. **Combine near-misses** — apply two saved discard patches together (`git apply autoresearch/patches/{NNN}-*.patch`)
6. **Simplify** — remove code while maintaining metric (simpler = better)

**Rules:**
- Don't repeat a change that was already discarded
- Don't make multiple unrelated changes at once (can't attribute improvement)
- Target the phase where the most time is spent — check the time profile, don't assume
- A promising idea you won't try now goes into the ideas file as a bullet, so it survives a context reset

### Phase 3: Modify

Make ONE focused change. Write a one-sentence description BEFORE modifying code.

### Phase 4: Commit

```bash
git add <changed-files>
git commit -m "autoresearch: <one-sentence description>"
```

Commit BEFORE verification so rollback is clean — if the change is discarded, `git reset --hard HEAD~1` reverts exactly the one commit just made, losing no other work. This is the stated exception to *A Commit Is a Claim Too* in the `verification-before-completion` guideline: here the commit is the rollback mechanism, not a claim that the experiment worked.

### Phase 5: Verify

Run the checks first. They are cheaper than the compare, and a failing change needs no measurement. Record each exit code; never mask it with `|| true`:

```bash
vendor/bin/pest --filter={related_test}; echo "tests_exit=$?"
vendor/bin/phpstan analyse --no-progress <changed-files>; echo "phpstan_exit=$?"
```

Skip the PHPStan line when the project does not have PHPStan, and treat `phpstan_exit` as 0. Use the project's own test runner when it is not Pest.

If both pass, measure the candidate against the commit before it:

```bash
bash autoresearch/{slug}-compare.sh HEAD~1 HEAD; echo "compare_exit=$?"
```

Before any amend or reset, check that `git branch --show-current` prints `autoresearch/{slug}`. If it does not, run `git checkout autoresearch/{slug}` first.

### Phase 6: Decide

Handle failed checks and crashes first. Neither has a usable metric, and every later branch needs one.

```
IF tests_exit != 0 OR phpstan_exit != 0:
    STATUS = "checks_failed"     (the compare did not run)
ELIF compare_exit != 0 OR the METRIC lines are missing:
    Attempt a fix (max 3 tries): amend the commit, then restart from Phase 5
    IF still failing after 3 tries: STATUS = "crash"
ELSE:
    conf = the compare's conf
    IF 1 <= conf < 2:
        re-run the compare with twice the pairs, once
        the new run replaces the first one completely: exit code, conf, delta_pct
        IF the new run fails: treat it as the crash branch above
    IF conf >= 2:
        STATUS = "keep"       if delta_pct >= required_gain(cost)
        STATUS = "tentative"  otherwise
    ELIF conf > -1 AND the change removes net lines AND raises no cost flag:
        STATUS = "keep"       (simplification: equal speed, less code)
    ELSE:
        STATUS = "discard"

Save the patch for EVERY status: git diff HEAD~1 HEAD > autoresearch/patches/{NNN}-{status}-{description}.patch
IF STATUS in (crash, checks_failed, discard): git reset --hard HEAD~1
```

**Cost** comes from counts. Take the line counts from `git diff --numstat HEAD~1 HEAD` (non-test files) and raise a flag for each of these the change adds:

- A cache, memoization, or static or global state
- A special-case branch for one input shape
- Duplicated logic, or a second code path that does what an existing one does

`required_gain(cost)` is `min_gain_pct` for a simple change and `complex_min_gain_pct` for a complex one, as the research doc defines it. Record the cost as `+{added}/-{removed}` plus the flag names.

The cost bar follows Karpathy's: a 0.001 gain from deleting code is a clear keep; a 0.001 gain from 20 hacky lines is probably not.

> **Laravel projects tracking `query_count` → use the [two-metric decision logic in the Laravel deep-dive](#two-metric-decision-logic), NOT the single-metric rule above.** Applying single-metric logic to a two-metric benchmark will discard query-count wins as "no improvement" because execution time barely moved.

### Phase 7: Log — Update Progress File IMMEDIATELY

Append a row after EVERY iteration:

```markdown
| {N} | {hash or —} | {ms} | {Δ%} | {conf} | {+A/-R flags} | {status} | {description} | {learned} |
```

**Learned** records what the attempt taught, not what it did — "the cost is in hydration, not the query" rather than "eager-loaded the relation". Write it most carefully for discards and crashes: their code is gone, and this cell is all that survives. When an attempt changes the picture of a bottleneck, also update "Strategies Attempted" in the research doc.

### Phase 8: Repeat

Print a status line every 5 iterations:

```
=== Iteration 10: 210ms (was 265ms), 4 keeps / 2 tentative / 4 discards ===
```

**Stop conditions** — stop the loop when any of these holds, then run `/autoresearch:distill`:

- The iteration count reaches `max_iterations`
- The goal in the research doc is met
- The "When Stuck" procedure ran once and the 5 iterations after it brought no keep or tentative

### When Stuck (5 consecutive iterations without a keep or tentative)

1. Re-read ALL in-scope files from scratch
2. Re-read the research document's bottleneck list
3. **Re-run the time profile** — the bottleneck may have shifted after earlier optimizations
4. Run a fresh benchmark with full diagnostics
5. Look for NEW bottlenecks not in the original list
6. Try combining 2-3 previously successful changes differently
7. Try the OPPOSITE approach (e.g., if eager-loading didn't help, try deferred loading)

---

## /autoresearch:distill — Keep Only What Earns Its Place

The loop judged each change against the commit before it. Distill judges each change against the final tree, where the other changes are already present. A change that helped early can be redundant later, and a lucky pass can look real.

### Step 1: Measure the Total Gain

```bash
bash autoresearch/{slug}-compare.sh {base-commit} HEAD {2 × pairs}
```

Record base → final in the research doc. If the total gain is within noise (`conf < 2`) and, for a Laravel benchmark, `cand_query_count` is not lower than `base_query_count`, the loop found no measured gain. Report that, and recommend dropping every change except the simplifications.

### Step 2: Rank the Removal Candidates

List the `keep` and `tentative` commits from the progress file. Order them for removal:

1. `tentative` before `keep`
2. Within each group, highest cost per point of gain first

Simplification commits (net lines removed, no flag) are not candidates.

### Step 3: Remove One at a Time

For each candidate, in order, note the current commit as `{pre-sha}` (`git rev-parse HEAD`), then revert the candidate:

```bash
git revert --no-edit <sha>; echo "revert_exit=$?"
```

If `revert_exit` is not 0, or `HEAD` is still `{pre-sha}`, the revert failed. Run `git revert --abort` if a revert is in progress, then `git reset --hard {pre-sha}`. Mark the change "entangled" and go to the next candidate. Otherwise, check and measure:

```bash
vendor/bin/pest --filter={related_test}; echo "tests_exit=$?"
bash autoresearch/{slug}-compare.sh HEAD~1 HEAD {2 × pairs}; echo "compare_exit=$?"
```

Here the base is the tree WITH the change and the candidate is the tree WITHOUT it. A positive `delta_ms` means the tree is faster without the change.

```
loss_pct = -delta_pct        (what removing the change costs)
conf     = -(the compare's conf)

IF tests fail:                  git reset --hard {pre-sha}; keep the change
ELIF compare_exit != 0:         git reset --hard {pre-sha}; keep the change, mark "unmeasured"
ELIF conf < 2:                  removal is free — keep the revert, drop the change
ELIF loss_pct < required_gain(cost): the gain no longer pays — keep the revert, drop the change
ELSE:                           git reset --hard {pre-sha}; keep the change
```

Each measurement runs on the tree as it stands, after the earlier removals. A change that only helped together with a removed one shows that here. Do not decide from a table of one-at-a-time results made in advance.

Log each result in the progress file as a `distill` row: the change, the loss, and `dropped` or `kept`.

### Step 4: Simplify the Survivors

Read the full diff `git diff {base-commit} HEAD` as one change. Look for:

- Two kept changes that solve the same problem in two ways
- A helper or a cache that a later change made unnecessary
- Dead branches and leftover instrumentation

Make each simplification one commit. Measure it like a loop iteration. Keep it when `conf > -1`, because equal speed with less code is a win.

### Step 5: Measure the Result and Check the Holdout

Measure the distilled tree on both scenarios:

```bash
bash autoresearch/{slug}-compare.sh {base-commit} HEAD {2 × pairs}
AUTORESEARCH_SCENARIO=holdout bash autoresearch/{slug}-compare.sh {base-commit} HEAD {2 × pairs}
```

The first run gives the final main-scenario result. The holdout must not be slower than the base: a `conf` of -2 or lower fails the check. A holdout gain much smaller than the main gain is a warning: find the change that tunes for the main scenario and test its removal as in Step 3. Report the holdout result either way.

### Step 6: Final Verification

Use the `backend-quality` skill's completion tier (Pint, PHPStan, and the full test suite) when the project has it synced. Otherwise run the project's own commands directly. A failure here goes back to Step 3: find the change that causes it.

### Step 7: Present

1. Update the research document's "Results" section: base → final, main and holdout, with confidence
2. List the surviving changes with gain and cost each, and the dropped changes with the reason
3. Offer a clean branch: `autoresearch/{slug}-final` from the base commit, with the surviving changes cherry-picked in order and the reverted pairs left out. Check that `git diff autoresearch/{slug} autoresearch/{slug}-final` prints nothing. If a cherry-pick conflicts, offer one squashed commit instead.
4. List the remaining entries in the ideas file as possible follow-ups

Stop there. The user decides what to merge or push.

---

## Laravel projects — deep-dive variations

### Activate this subsection?

Decide BEFORE reading further:

| Project shape | Read the deep-dive? |
|---|---|
| Laravel route, job, listener, console command that exercises Eloquent or the application kernel | **Yes** — the deep-dive is load-bearing; generic flow above won't surface the dominant bottleneck class (query count). |
| Laravel project, but target is pure CPU/string work that doesn't touch Eloquent or the kernel | **No** — generic flow is sufficient; query-count tracking would be noise. |
| Pure-PHP package (non-Laravel) | **No** — skip the entire section; generic flow covers your case. |
| PHP application using raw PDO / Doctrine / different ORM | **No** — generic flow + your ORM's profiling helper covers it; Eloquent-specific bottlenecks don't apply. |

If `Yes`: read the deep-dive end-to-end before drafting the benchmark; it changes the benchmark structure, the metrics tracked, and the decision logic. If `No`: skip to `## Critical Rules` below.

### What the deep-dive adds (when activated)

Layered on top of the generic flow above:

1. A second metric — `query_count` (often the dominant signal when the database is involved).
2. A transactional benchmark template that uses the application kernel + Eloquent + factories.
3. Two bottleneck taxonomies — query-count and execution-time — covering the common Eloquent patterns.
4. A two-metric decision logic that supersedes the generic single-metric keep/discard rule.

### Two metrics (query_count + execution_median_ms)

Database-heavy code paths benefit from tracking BOTH metrics. Query count is often the bigger lever than wall-clock time — a route doing 200 queries in 150ms is healthier as 50 queries in 180ms, even though execution time went up.

Add `query_count` and `query_total_time_ms` to the METRIC lines:

```
METRIC query_count={N}
METRIC execution_median_ms={N.NN}
METRIC execution_mean_ms={N.NN}
METRIC query_total_time_ms={N.NN}
```

The compare runner prints these as `base_query_count` and `cand_query_count`. Query count is deterministic: if it differs between two runs of the same commit, the benchmark has a bug — fix it before the loop starts.

The `query_total_time_ms` vs `execution_median_ms` ratio tells you whether the bottleneck is the database or PHP processing. If queries are only 5% of total time, optimizing query count won't move the needle — go after PHP-side bottlenecks instead.

### Benchmark template (Laravel)

```php
// autoresearch/{slug}-bench.php
require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->loadEnvironmentFrom('.env.testing');
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$scenario = getenv('AUTORESEARCH_SCENARIO') ?: 'main';

DB::beginTransaction();

try {
    // Build fully loaded test scenario via factories — vary the data shape per $scenario
    $user = User::factory()->create();
    // ... seed the relations the target depends on ...

    auth()->login($user);

    // Warmup
    invokeTarget($kernel, $user, $scenario);
    cache()->flush();
    Once::flush();
    DB::flushQueryLog();

    $samples = [];
    for ($i = 0; $i < 5; $i++) {
        DB::enableQueryLog();
        $start = hrtime(true);

        invokeTarget($kernel, $user, $scenario);

        $samples[] = [
            'execution_ms'   => (hrtime(true) - $start) / 1e6,
            'query_count'    => count(DB::getQueryLog()),
            'query_total_ms' => array_sum(array_column(DB::getQueryLog(), 'time')),
        ];

        DB::disableQueryLog();
        cache()->flush();
        Once::flush();
        DB::flushQueryLog();
    }

    // Output METRIC lines (stdout)
    $exec = array_column($samples, 'execution_ms');
    sort($exec);
    fwrite(STDOUT, sprintf("METRIC query_count=%d\n",            $samples[0]['query_count']));
    fwrite(STDOUT, sprintf("METRIC execution_median_ms=%.2f\n",  $exec[2]));
    fwrite(STDOUT, sprintf("METRIC execution_mean_ms=%.2f\n",    array_sum($exec) / count($exec)));
    fwrite(STDOUT, sprintf("METRIC query_total_time_ms=%.2f\n",  array_sum(array_column($samples, 'query_total_ms')) / count($samples)));
} finally {
    DB::rollBack();
}

function invokeTarget($kernel, $user, string $scenario): mixed
{
    // For a route:
    $request  = Illuminate\Http\Request::create('/your/route', 'GET');
    $response = $kernel->handle($request);
    abort_if($response->getStatusCode() >= 400, 500, 'Target returned error');
    return $response;

    // For a job:
    // return (new YourJob(...))->handle();
}
```

**Critical benchmark rules:**

- Call `DB::enableQueryLog()` before each iteration and `DB::disableQueryLog()` after. `getQueryLog()` returns nothing without enabling.
- Wrap everything in `DB::beginTransaction()` / `DB::rollBack()` to leave the database unchanged.
- Flush `cache()`, `Once::flush()`, and `DB::flushQueryLog()` between iterations to prevent stale memoization.
- Authenticate the user if the route requires it (`auth()->login($user)`).
- Assert success on every iteration with `abort_if()` or an exception, never `exit()`: `exit()` skips the `finally` rollback. The uncaught exception exits non-zero, which the compare runner treats as a crash.
- Use factories, never raw SQL inserts. Factories exercise the same model lifecycle production code does.

### Profiling phase splits (optional helper)

Knowing the time split (validation / DB / serialization / etc.) prevents wasted iterations optimizing a phase that's only 10% of total time. The `sandermuller/stopwatch` helper provides checkpoint instrumentation:

```php
$stopwatch = stopwatch();

// Phase 1: validation
$stopwatch->checkpoint('Validation');

// Phase 2: database inserts
$stopwatch->checkpoint('DB inserts', ['queries' => count(DB::getQueryLog())]);

// Phase 3: post-processing
$stopwatch->checkpoint('Post-processing');

// toArray() finalizes the stopwatch with an "Ended StopWatch" checkpoint
fprintf(STDERR, "Phase profile:\n");
foreach ($stopwatch->toArray()['checkpoints'] as $cp) {
    if ($cp['label'] === 'Ended StopWatch') continue;
    fprintf(STDERR, "  [%dms] %s\n", $cp['timeSinceLastCheckpointMs'], $cp['label']);
}
fprintf(STDERR, "Total: %s\n", $stopwatch->totalRunDurationReadable());
```

If `sandermuller/stopwatch` isn't installed, fall back to manual `hrtime(true)` checkpoints — the principle (phase-attributed time) is what matters, not the helper.

### Bottleneck taxonomies

Group Laravel-specific bottlenecks into two tables:

#### Query-count bottlenecks (reduce DB load)

| Type | Description | Example |
|------|-------------|---------|
| **Eager loading** | Load relations upfront instead of lazy-loading | `$model->loadMissing(['relation', 'relation.nested'])` |
| **Relation reuse** | Derive data from already-loaded relations | `$collection->firstWhere('id', $id)` |
| **Bulk inserts** | Replace `createMany()` with `Model::insert()` | `Answer::insert($rows)` |
| **Audit suppression** | Disable auditing during bulk operations | `Audit::$auditingGloballyDisabled = true` (assumes `owen-it/laravel-auditing` or similar; adapt to your audit library) |
| **Touch suppression** | Skip parent `updated_at` touches during bulk ops | `Model::withoutTouching(fn () => ...)` |
| **Deferred execution** | Move work to when it's actually needed | Move INSERT to first-use trigger |
| **Duplicate elimination** | Remove redundant queries / Gate checks | Cache the result of a Gate call within a request |

#### Execution-time bottlenecks (reduce wall-clock time)

| Type | Description | Example |
|------|-------------|---------|
| **Validation overhead** | Complex wildcard rules × many items | Restructure to validate once, not per-item |
| **Double processing** | Calling `fails()` then `validated()` separately | Call `validated()` once (throws on failure) |
| **Object creation** | DTOs / Data objects (e.g. `spatie/laravel-data`) created per-item in tight loops | Pre-build attribute arrays; instantiate once |
| **Event overhead** | Model observers firing during bulk imports | `Model::withoutEvents(fn () => ...)` |
| **Transaction batching** | Each save auto-commits separately | `DB::transaction(fn () => ...)` wraps a batch |
| **Serialization** | JSON encoding/decoding in tight loops | Pre-serialize outside the loop |

### Two-metric decision logic

When the benchmark tracks `query_count` alongside `execution_median_ms`, the measured part of Phase 6 uses both. The checks and crash branches stay as they are, and come first. The re-run for `1 <= conf < 2` also stays.

```
queries_saved = base_query_count - cand_query_count
query_gain_pct = 100 * queries_saved / max(base_query_count, 1)
conf = the compare's conf

IF queries_saved < 0:                          STATUS = "discard"
ELIF conf <= -2 AND delta_pct < -5 AND query_gain_pct < -delta_pct:
                                               STATUS = "discard"   (time regressed > 5%, and the query gain is smaller)
ELIF queries_saved > 0 OR conf >= 2:
    gain = max(query_gain_pct, delta_pct if conf >= 2 else 0)
    STATUS = "keep"       if gain >= required_gain(cost)
    STATUS = "tentative"  otherwise
ELSE: apply the simplification and discard branches of Phase 6
```

Query count needs no noise floor: it is deterministic. A change that drops 40 of 200 queries and adds 2% execution time is a keep. So is 200 queries in 150ms becoming 50 in 180ms: a 75% query gain against a 20% time loss. A change that drops 1 of 200 queries (0.5%) is tentative, however clean — distill decides whether it stays. A change that adds a query is a discard.

In distill Step 3, the compare's base is the tree with the change, so a removal that adds queries back shows as `cand_query_count > base_query_count`. Replace the `conf < 2` and `loss_pct` branches of Step 3 with:

```
queries_added  = cand_query_count - base_query_count
query_loss_pct = 100 * queries_added / max(base_query_count, 1)
time_loss_pct  = loss_pct if conf >= 2 else 0
loss           = max(query_loss_pct, time_loss_pct)

IF loss <= 0:                          removal is free — keep the revert, drop the change
ELIF loss < required_gain(cost):       the gain no longer pays — keep the revert, drop the change
ELSE:                                  git reset --hard {pre-sha}; keep the change
```

### Constraints (Laravel-specific)

Layered on top of the generic constraints — in addition to "tests must pass" / "respect scope" / etc., Laravel projects MUST:

- **Never run `migrate:fresh`** or any destructive database command — the benchmark uses a transactional rollback, not a schema reset.
- **Use factories** in the benchmark script, never raw SQL inserts. Factories exercise the same model lifecycle production code does.
- **Roll back transactions** at the end of every benchmark — the database must be byte-stable across runs.
- **Respect `Once::flush()`** between iterations — `Illuminate\Support\Once` memoizes within a request; without flushing, iteration N+1 sees stale data.
- **Don't modify test files** — optimize production code, not the assertions verifying it.
- **Preserve API contracts** — resource output shape (JSON keys, response codes) must not change. Optimization that breaks consumers is not optimization.
- **Never weaken security** — authorization logic, policies, Gate checks, request validation rules stay as written. Speed gains are not worth opening up an authorization gap.

---

## Critical Rules

1. **ONE change per iteration** — atomic changes so you know what helped
2. **Mechanical verification only** — measured gain, noise floor, and line counts, not "looks better"
3. **Automatic rollback** — failed changes revert instantly, no debates
4. **Checks must pass** — an optimization that breaks tests or PHPStan is not an optimization
5. **Respect scope** — only modify files listed in the research document
6. **Git is memory** — work on `autoresearch/{slug}`, commit before verify, save every patch, read history for context
7. **Don't ask "should I continue?"** — keep iterating until a stop condition holds
8. **Log immediately** — update the progress file after EVERY iteration, not in bulk, with what the attempt taught
9. **Profile before optimizing** — know where time is spent before choosing what to optimize
10. **Distill before done** — no loop result goes to the user before every kept change has been re-judged on the final tree
