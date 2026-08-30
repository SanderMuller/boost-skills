# Plan 012: A stale `codex-review` wrapper fails invisibly, and the skill sends the reader away from the fix

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git log --oneline b14698b..HEAD -- resources/boost/skills/codex-review/` and
> `git diff --stat -- resources/boost/skills/codex-review/`.
> This plan builds on `b14698b` ("Send the codex review prompt on stdin, not
> argv", released in 2.30.0). That fix is correct and this plan does not touch
> it. If the wrapper already prints its own version, or `SKILL.md` Step 2c
> already carries a row for a SIGKILL with no output, treat it as a STOP
> condition — the gap is closed and only the evidence below is still worth
> keeping.

## Status

- **Priority**: P2
- **Effort**: S (this repo only; no package dependency)
- **Risk**: LOW — adds a version string and two documentation rows; changes no
  invocation path
- **Depends on**: nothing. Complements `b14698b` / 2.30.0
- **Category**: DX / diagnostics
- **Reported by**: a consumer session, 2026-08-30, which lost roughly an hour
  to this
- **Planned at**: commit `3ac404f`, 2026-08-30

## Why this matters

2.30.0 fixed the real bug: a focused review prompt travels on stdin, because
the `codex` binary is killed by the OS at exec time when a single argument is
too large. Consumers who have not re-synced still carry the pre-fix wrapper,
and for them **every focused review fails** — that is the whole point of the
fix.

What they see when it does:

```json
{"ok": false, "timedOut": false, "exitCode": null, "signal": "SIGKILL",
 "resultBytes": 0, "stderrBytes": 0, "stderrPreview": "",
 "streamErrors": [], "terminalEventErrors": [], "error": null}
```

Nothing in that report names a cause, and nothing in it points at the remedy.
`SKILL.md` then makes it worse in two places:

- Step 2c routes `ok: false` without `timedOut` to "inspect `stderrPreview`,
  `terminalEventErrors`, and `error`" — all three are empty here — "any other
  failure, surface it and fall back to the in-house `code-review` skill".
- The rule under it reads: "**One attempt, then fall back — do not loop the
  wrapper.** It cannot hang, so a failure is a genuine failure (auth, capacity,
  a real Codex error), not a transient wedge that a re-run clears."

Both are right for the failures they were written for and wrong for this one.
The failure is genuine, but its remedy is one command — update the package and
re-sync — and the skill instead sends the reader to a different reviewer, so
the consumer never learns that their copy is old. The reporting session
concluded from the same evidence that `--json` was the trigger, invoked
`codex exec` by hand for six review rounds, and only found the real cause when
it opened this repository.

An emitted companion file has no version anywhere: not in the file, not in the
JSON report, not in the emitted `SKILL.md` frontmatter. A consumer cannot
answer "is my wrapper current?" without diffing against this repository.

## Evidence

Measured 2026-08-30 on macOS (Darwin 25.6.0), `codex-cli 0.146.1`, in a
consumer package carrying the pre-2.30.0 wrapper.

**The wrapper's own failures.** Two runs, one backgrounded and one in the
foreground, both `ok: false` with the report shown above. Zero-byte result,
zero-byte stderr, no events.

**The threshold, confirmed.** A single argv argument, otherwise identical
invocation (`codex exec --ephemeral --output-last-message … --sandbox read-only
--ignore-user-config "<prompt>"`), prompt padded to size:

| argv bytes | exit |
|---:|---|
| 900 | 0 |
| 1010 | 137 (SIGKILL) |
| 1050 | 137 |
| 1200 | 137 |
| 1500 | 137 |
| 2500 | 137 |
| 3200 | 137 |
| 5000 | 137 |
| 12000 | 137 |

**The remedy, confirmed.** The same 5000-byte prompt on stdin
(`codex exec … < prompt.md`) exits 0 and produces its answer. The 2.30.0 fix
works on this machine.

**The threshold is not always in force — this is the new datum.** Earlier in
the same session, same binary, same shell, six review rounds passed prompts of
2944–3177 bytes on argv and five of them completed normally. After the
failures began, replaying the 3177-byte prompt that had succeeded exits 137.
So the limit can be absent and then present within one session, which is why
the reporting session mis-diagnosed it as a `--json` problem: a short smoke
test passed while a real review died, and `--json` happened to be set on one of
the deaths.

The design consequence is small but worth stating in the code: **do not gate
the stdin path on prompt size.** A "send on stdin only when the prompt is
larger than N" optimisation would work for hours and then fail. The current
fix is unconditional for the focused path, and it should stay that way.

## Current state

### `resources/boost/skills/codex-review/scripts/run-codex-review.mjs`

The report is assembled with no self-identification — there is no version
constant in the file, and the JSON has no field for one.

### `resources/boost/skills/codex-review/SKILL.md`, Step 2c

Verbatim, the branch that this failure lands in:

> - **`ok: false` otherwise** — inspect `stderrPreview`,
>   `terminalEventErrors`, and `error`. An auth or capacity failure is handled
>   under [Cross-cutting concerns](#cross-cutting-concerns); any other failure —
>   surface it and fall back to the in-house `code-review` skill.

And the rule below it:

> **One attempt, then fall back — do not loop the wrapper.** It cannot hang, so
> a failure is a genuine failure (auth, capacity, a real Codex error), not a
> transient wedge that a re-run clears.

## The change

### Step 1 — the wrapper names itself

Add a `WRAPPER_VERSION` constant to `run-codex-review.mjs` and emit it in the
JSON report as `wrapperVersion`. Set it to the package version the emitted copy
came from. It exists to answer one question — "is this copy current?" — so the
value only has to be comparable against this repository's `CHANGELOG.md`.

Keep it a plain string. Do not read it from `composer.json` at runtime: the
emitted file lives in a consumer's skills directory, where this package's
metadata is not reachable.

### Step 2 — `SKILL.md` Step 2c gains the signature

Add a branch above the existing "otherwise" bullet:

> - **`ok: false` with `signal: "SIGKILL"`, `resultBytes: 0` and an empty
>   `stderrPreview`** — Codex was killed before it produced anything. On a
>   wrapper older than 2.30.0 this is certain and it will never succeed: that
>   version moved the review prompt from argv to stdin because the binary is
>   killed at exec time when a single argument is too large, so every focused
>   review died. Check `wrapperVersion` in the report, update the package and
>   re-sync, then run the review again. This is the one `ok: false` that a
>   re-run CAN clear, and the only one — do not fall back to `code-review`
>   before re-syncing.

### Step 3 — say it in the fallback advice too

Under [Cross-cutting concerns](#cross-cutting-concerns), add one line: a reader
who invokes `codex exec` by hand instead of through the wrapper must send the
prompt on **stdin**, never as an argument, for the same reason. A hand-rolled
`codex exec "<long prompt>"` reproduces the bug the wrapper exists to avoid.

## Verification

```bash
# 1. The version reaches the report.
node resources/boost/skills/codex-review/scripts/run-codex-review.mjs --help >/dev/null
node -e "const s=require('fs').readFileSync('resources/boost/skills/codex-review/scripts/run-codex-review.mjs','utf8');
         if (!s.includes('wrapperVersion')) { throw new Error('report field missing'); }"

# 2. The skill documents the signature and the stdin rule.
grep -c 'SIGKILL' resources/boost/skills/codex-review/SKILL.md   # expect >= 1
grep -c 'stdin'   resources/boost/skills/codex-review/SKILL.md   # expect >= 1

# 3. The catalog/README checks still pass.
composer test
```

Then run one real focused review through the wrapper on any repository and
confirm `wrapperVersion` appears in the JSON report and the review completes.

## STOP conditions

Stop and report — do not improvise — if any of these proves true:

1. **The wrapper already carries a version, or `boost sync` already records the
   emitted skill's version somewhere a consumer can read.** Then Step 1 is
   redundant; keep Steps 2 and 3 and say where the version already lives.
2. **`SKILL.md` already documents the SIGKILL signature.** The diagnostic gap
   is closed; keep only the evidence in this file.
3. **A size-gated argv path is proposed instead.** The evidence above shows the
   limit coming and going within one session. Do not make the stdin path
   conditional on prompt size.
4. **`composer test` fails for a reason this plan did not introduce.** Report
   it rather than working around it — this plan touches no catalog contract.

## Notes for the executor

Any repository that still carries the pre-2.30.0 emitted copy at
`.claude/skills/codex-review/scripts/run-codex-review.mjs` reproduces the
failure on demand, if a live reproduction is wanted before the change.
Re-syncing such a repository is the consumer's own step and is not part of this
plan.
