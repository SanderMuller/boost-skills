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

1. **Bootstraps the test environment** using Orchestra Testbench
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
