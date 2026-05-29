---
name: autoresearch
description: "Autonomous performance optimization loop. Iteratively reduces query count and execution time by modifying code, benchmarking, and keeping/reverting changes. Activates when: optimizing performance, reducing overhead, improving execution time, benchmarking, or when user mentions: autoresearch, optimize, performance, benchmark."
argument-hint: "[description of what to optimize]"
metadata:
  boost-tags: "php"
---

# Autoresearch — Autonomous Performance Optimization

Inspired by [Karpathy's autoresearch](https://github.com/karpathy/autoresearch). Applies constraint-driven autonomous iteration to reduce execution time and overhead for any measurable code path.

**Core idea:** Modify one thing, benchmark, keep if improved, revert if not, repeat.

## Subcommands

| Subcommand | Purpose |
|------------|---------|
| `/autoresearch` | Run the autonomous optimization loop |
| `/autoresearch:plan` | Interactive wizard: analyze bottlenecks and set up benchmark + research doc |

## When to Activate

- User invokes `/autoresearch` or mentions autoresearch
- User wants to reduce execution time for a specific operation
- User says "optimize", "slow", "benchmark", "performance"
- Any task requiring iterative performance improvement with measurable outcomes

## Directory Structure

All autoresearch artifacts live in `autoresearch/` (gitignored):

```
autoresearch/
├── {slug}-research.md          # Research document (bottlenecks, scope, constraints)
├── {slug}-bench.php            # Benchmark script (measures metrics)
├── {slug}-progress.md          # Iteration log — updated after EVERY attempt
└── patches/                    # Saved diffs of successful optimizations
    ├── 001-description.patch
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

### Step 2: Baseline Measurement

Create a benchmark script at `autoresearch/{slug}-bench.php` that:

1. **Bootstraps the test environment** — the same way the project's own test suite does
2. **Creates realistic test data** — cover the "fully loaded" scenario
3. **Runs a warmup iteration** to prime caches
4. **Benchmarks 5 iterations**, measuring:
   - `execution_median_ms` — median execution time via `hrtime(true)`
5. **Outputs METRIC lines to stdout** (machine-readable)
6. **Outputs diagnostics to stderr** (human-readable breakdown)

Template for METRIC output:
```
METRIC execution_median_ms={N.NN}
METRIC execution_mean_ms={N.NN}
```

> **Laravel projects → jump to the [Laravel deep-dive variations](#laravel-projects--deep-dive-variations) section NOW before drafting your benchmark.** The transactional template (Eloquent + factories + `DB::beginTransaction`/`rollBack` + `query_count` metric) is structurally different from the generic shape above. Skipping the deep-dive and drafting a generic benchmark for a Laravel target will leave you optimizing the wrong metric.

### Step 3: Profile the Time Split

Before analyzing bottlenecks, **profile where execution time is actually spent**. Instrument the code path into phases (validation, setup, core work, serialization, etc.) and measure each phase's share of total time — use whatever profiling helper or simple `hrtime(true)` checkpoints the project provides.

This prevents wasting iterations optimizing a phase that's only a small fraction of total time. Knowing the time split tells you which phase to target first.

### Step 4: Analyze Bottlenecks

Run the benchmark and analyze both the diagnostics AND the time profile. Document bottlenecks in `autoresearch/{slug}-research.md`:

```markdown
# Autoresearch: {Description} Performance Optimization

## Objective

{What is being optimized and why it matters.}

## Scope

Files that may be modified:

- `path/to/File.php` — {why}

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
- Public API must remain unchanged
- No new dependencies

## Strategies Attempted

(Updated as experiments are conducted)

## Results

(Updated with final measurements)
```

### Step 5: Record Baseline

Run the benchmark and create the progress file at `autoresearch/{slug}-progress.md`:

```markdown
# Autoresearch Progress: {slug}

**Baseline:** {N}ms

| # | Commit | Time (ms) | Status | Description |
|---|--------|-----------|--------|-------------|
| 0 | — | {N} | baseline | initial state |
```

### Step 6: Confirm and Launch

Present the research document, time profile, and baseline to the user. Ask:

1. Are the scope constraints correct?
2. Are there any files that should NOT be modified?
3. Should I start the optimization loop now?

---

## /autoresearch — The Optimization Loop

### Prerequisites

Verify research doc, benchmark script, and baseline exist. If missing, run `/autoresearch:plan` first.

### The Loop

```
LOOP (until interrupted or goal achieved):
  1. REVIEW  — Read research doc, progress file, git history
  2. IDEATE  — Pick the next bottleneck to address
  3. MODIFY  — Make ONE focused change to in-scope files
  4. COMMIT  — Git commit before verification (enables clean revert)
  5. VERIFY  — Run benchmark, capture METRIC lines + run tests
  6. DECIDE  — Keep if improved, revert if same/worse
  7. LOG     — Update progress file IMMEDIATELY (not in bulk)
  8. REPEAT
```

### Phase 1: Review

Before each iteration:
1. Read the research document for bottleneck context
2. Read the progress file — check what worked/failed
3. Check recent git history: `git log --oneline -10`

Do NOT re-run the benchmark in the review phase — only read existing data. The benchmark runs in Phase 5.

### Phase 2: Ideate

Pick the next optimization. Priority order:
1. **Fix crashes** from previous iteration
2. **Exploit successes** — if last change helped, try variants in the same direction
3. **Address highest-impact bottleneck** — use the time profile to target the biggest phase first
4. **Combine near-misses** — two changes that individually didn't help might work together
5. **Simplify** — remove code while maintaining metric (simpler = better)

**Rules:**
- Don't repeat a change that was already discarded
- Don't make multiple unrelated changes at once (can't attribute improvement)
- Target the phase where the most time is spent — check the time profile, don't assume

### Phase 3: Modify

Make ONE focused change. Write a one-sentence description BEFORE modifying code.

### Phase 4: Commit

```bash
git add <changed-files>
git commit -m "autoresearch: <one-sentence description>"
```

Commit BEFORE verification so rollback is clean — if the change is discarded, `git reset --hard HEAD~1` reverts exactly the one commit just made, losing no other work.

### Phase 5: Verify

Run the benchmark and related tests:

```bash
php autoresearch/{slug}-bench.php 2>/dev/null || true
vendor/bin/pest --filter={related_test} || true
```

### Phase 6: Decide

A change is **kept** if it improves the metric without breaking tests:

```
improved  = execution_ms < prev_ms * 0.98   (>2% faster)
regressed = execution_ms > prev_ms * 1.05   (>5% slower)

IF improved AND NOT regressed AND tests pass:
    STATUS = "keep"
    Save patch: git diff HEAD~1 HEAD > autoresearch/patches/{NNN}-{description}.patch

ELIF NOT improved OR regressed OR tests fail:
    STATUS = "discard"
    git reset --hard HEAD~1

ELIF benchmark crashed:
    Attempt fix (max 3 tries)
    IF fixable: re-commit, re-verify
    ELSE: STATUS = "crash", git reset --hard HEAD~1
```

**Simplicity override:** If the improvement is marginal but the change adds significant complexity, consider discarding. If metrics are unchanged but the code is simpler, consider keeping.

> **Laravel projects tracking `query_count` → use the [two-metric decision logic in the Laravel deep-dive](#two-metric-decision-logic), NOT the single-metric rule above.** Applying single-metric logic to a two-metric benchmark will discard query-count wins as "no improvement" because execution time barely moved. The deep-dive's rule (`improved = queries < prev OR execution_ms < prev * 0.98`) is the correct keep/discard contract when both metrics are tracked.

### Phase 7: Log — Update Progress File IMMEDIATELY

Append a row after EVERY iteration:

```markdown
| {N} | {hash or —} | {ms} | {keep/discard/crash} | {description} |
```

### Phase 8: Repeat

Print a status line every 5 iterations:

```
=== Iteration 10: 210ms (was 265ms), 6 keeps / 4 discards ===
```

### When Stuck (>5 consecutive discards)

1. Re-read ALL in-scope files from scratch
2. Re-read the research document's bottleneck list
3. **Re-run the time profile** — the bottleneck may have shifted after earlier optimizations
4. Run a fresh benchmark with full diagnostics
5. Look for NEW bottlenecks not in the original list
6. Try combining 2-3 previously successful changes differently
7. Try the OPPOSITE approach (e.g., if eager-loading didn't help, try deferred loading)

### Completion

1. Print final summary
2. Update the research document's "Results" section
3. Run Pint on all modified files
4. Run the full test suite to confirm nothing is broken
5. Present the optimizations to the user for review

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

The `query_total_time_ms` vs `execution_median_ms` ratio tells you whether the bottleneck is the database or PHP processing. If queries are only 5% of total time, optimizing query count won't move the needle — go after PHP-side bottlenecks instead.

### Benchmark template (Laravel)

```php
// autoresearch/{slug}-bench.php
require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->loadEnvironmentFrom('.env.testing');
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

DB::beginTransaction();

try {
    // Build fully loaded test scenario via factories
    $user = User::factory()->create();
    // ... seed the relations the target depends on ...

    auth()->login($user);

    // Warmup
    invokeTarget($kernel, $user);
    cache()->flush();
    Once::flush();
    DB::flushQueryLog();

    $samples = [];
    for ($i = 0; $i < 5; $i++) {
        DB::enableQueryLog();
        $start = hrtime(true);

        invokeTarget($kernel, $user);

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

function invokeTarget($kernel, $user): mixed
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
- Assert success on every iteration — abort if the response/result is broken; you can't benchmark a broken target.
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

When the benchmark tracks `query_count` alongside `execution_median_ms`, the keep/discard rule uses both:

```
improved  = (queries < prev_queries) OR (execution_ms < prev_ms * 0.98)
regressed = (queries > prev_queries * 1.05) OR (execution_ms > prev_ms * 1.05)

IF improved AND NOT regressed AND tests pass: STATUS = "keep"
ELIF NOT improved OR regressed OR tests fail: STATUS = "discard"
```

A change that drops 4 queries but adds 1% execution time is a keep. A change that drops 30ms but adds 3 queries is a keep. A change that does both is excellent. A change that regresses either >5% is a discard.

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
2. **Mechanical verification only** — benchmark numbers, not "looks better"
3. **Automatic rollback** — failed changes revert instantly, no debates
4. **Tests must pass** — an optimization that breaks tests is not an optimization
5. **Respect scope** — only modify files listed in the research document
6. **Git is memory** — commit before verify, revert on failure, read history for context
7. **Don't ask "should I continue?"** — keep iterating until stuck or done
8. **Log immediately** — update the progress file after EVERY iteration, not in bulk
9. **Profile before optimizing** — know where time is spent before choosing what to optimize
