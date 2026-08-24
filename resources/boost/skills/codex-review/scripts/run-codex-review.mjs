#!/usr/bin/env node
// run-codex-review.mjs — the codex-review skill's bounded Codex wrapper.
// Source of truth. boost-core (>= 1.3) emits this beside the rendered SKILL.md
// into each agent's skill dir (e.g. `.claude/skills/codex-review/scripts/`);
// edit it HERE, not the emitted copy, and re-sync.
//
// Bounded, broker-free Codex review. Runs `codex exec review` (native CLI, no
// plugin broker) under a hard timeout, captures per-run result/event/stderr
// files in a fresh temp dir, and prints a JSON report. Structurally cannot hang:
// the timeout kills the process tree (exit 124) and results are only ever read
// from this run's own files, never a stale prior job.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { finished } from 'node:stream/promises';

const DEFAULT_TIMEOUT_MS = 900_000;
const KILL_GRACE_MS = 5_000;
const PREFLIGHT_TIMEOUT_MS = 10_000;
const VALUE_OPTIONS = new Set(['--base', '--commit', '--model', '--prompt', '--prompt-file', '--timeout-ms']);

function usage() {
    return [
        'Usage:',
        '  node run-codex-review.mjs [--base <branch>|--uncommitted|--commit <sha>] [--prompt <text>|--prompt-file <file>] [--model <model>] [--timeout-ms <ms>] [--use-user-config]',
        '',
        'Runs Codex non-interactively, captures JSONL/stderr/result files, and fails on timeout without reading stale output.',
        'With no target flag, infers one: a feature branch that differs from the repo default branch -> that branch diff; otherwise the uncommitted working tree.',
        'Timeout resolves as --timeout-ms > $CODEX_REVIEW_TIMEOUT_MS > 15min default (floor 1000ms).',
    ].join('\n');
}

function parseArgs(argv) {
    const options = {
        base: null,
        commit: null,
        model: null,
        prompt: null,
        promptFile: null,
        timeoutMs: envInteger('CODEX_REVIEW_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
        uncommitted: false,
        useUserConfig: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--uncommitted') {
            options.uncommitted = true;
            continue;
        }

        if (arg === '--use-user-config') {
            options.useUserConfig = true;
            continue;
        }

        if (VALUE_OPTIONS.has(arg)) {
            const value = argv[index + 1];
            if (value === undefined) {
                throw new Error(`Missing value for ${arg}.`);
            }

            if (arg === '--base') {
                options.base = value;
            } else if (arg === '--commit') {
                options.commit = value;
            } else if (arg === '--model') {
                options.model = value;
            } else if (arg === '--prompt') {
                options.prompt = value;
            } else if (arg === '--prompt-file') {
                options.promptFile = value;
            } else if (arg === '--timeout-ms') {
                const timeoutMs = Number(value);
                if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
                    throw new Error('--timeout-ms must be at least 1000.');
                }
                options.timeoutMs = Math.floor(timeoutMs);
            }

            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    if (options.help) {
        return options;
    }

    const targetCount = [options.base, options.commit, options.uncommitted].filter(Boolean).length;
    if (targetCount > 1) {
        throw new Error('Choose only one target: --base, --commit, or --uncommitted.');
    }

    if (options.prompt && options.promptFile) {
        throw new Error('Choose either --prompt or --prompt-file.');
    }

    if (targetCount === 0) {
        resolveDefaultTarget(options);
    }

    return options;
}

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        ...options,
    });
}

function ensureCommand(command, args, failureMessage) {
    const result = run(command, args, { timeout: PREFLIGHT_TIMEOUT_MS });
    if (result.error?.code === 'ENOENT') {
        throw new Error(failureMessage);
    }
    if (result.error?.code === 'ETIMEDOUT') {
        throw new Error(`${failureMessage}\nPreflight command timed out after ${PREFLIGHT_TIMEOUT_MS}ms: ${command} ${args.join(' ')}`);
    }
    if (result.status !== 0) {
        const stderr = (result.stderr ?? '').trim();
        throw new Error(stderr ? `${failureMessage}\n${stderr}` : failureMessage);
    }
    return result;
}

function envInteger(name, fallback) {
    const value = process.env[name];
    if (value === undefined) {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1_000) {
        return fallback;
    }

    return Math.floor(parsed);
}

function git(args) {
    return run('git', args, { timeout: PREFLIGHT_TIMEOUT_MS });
}

// Repo default branch from origin's HEAD symref (e.g. "origin/main" -> "main").
// Returns null when it can't be determined — the caller then reviews the
// working tree rather than guessing a base. No hardcoded branch names.
function detectDefaultBase() {
    const ref = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    if (ref.status !== 0) {
        return null;
    }
    const name = ref.stdout.trim().replace(/^origin\//, '');

    return name === '' ? null : name;
}

function currentBranch() {
    const branch = git(['branch', '--show-current']);

    return branch.status === 0 ? branch.stdout.trim() : '';
}

function hasBranchDiff(base) {
    // `git diff --quiet` exits 1 when there are differences, 0 when identical.
    return git(['diff', '--quiet', `${base}...HEAD`]).status === 1;
}

// No target flag given: infer one instead of erroring. On a feature branch that
// differs from the repo's default branch, review that branch diff; otherwise
// (on the default branch, detached, or default-branch undetectable) review the
// uncommitted working tree. The documented flow still passes a target
// explicitly — this only makes a flagless invocation graceful.
function resolveDefaultTarget(options) {
    const base = detectDefaultBase();
    const current = currentBranch();
    if (base !== null && current !== '' && current !== base && hasBranchDiff(base)) {
        options.base = base;

        return;
    }

    options.uncommitted = true;
}

function resolvePrompt(options) {
    if (options.promptFile) {
        return fs.readFileSync(path.resolve(options.promptFile), 'utf8').trim();
    }

    return options.prompt?.trim() ?? '';
}

function targetDescription(options) {
    if (options.base) {
        return `the branch diff against ${options.base}`;
    }
    if (options.commit) {
        return `commit ${options.commit}`;
    }
    return 'staged, unstaged, and untracked changes';
}

function buildFocusedReviewPrompt(options, focus) {
    const targetCommand = options.base
        ? `git diff ${options.base}...HEAD`
        : options.commit
            ? `git show --stat --patch ${options.commit}`
            : 'git status --short --untracked-files=all plus git diff --cached, git diff, and untracked file contents';

    return [
        'Run a senior code review. Do not edit files.',
        `Review ${targetDescription(options)} in this repository.`,
        `Use this target, not the whole repository: ${targetCommand}.`,
        '',
        'Inspect the repository and git diff yourself. Prioritize correctness bugs, regressions, security issues, performance problems, missing tests, and violations of local project conventions.',
        'Lead with actionable findings. Include file and line references where possible. Keep style-only feedback out unless it hides a real defect.',
        '',
        `Focus requested by caller: ${focus}`,
    ].join('\n');
}

function buildCodexArgs(options, resultFile) {
    const prompt = resolvePrompt(options);

    // `codex exec review` refuses a positional [PROMPT] alongside a target flag
    // (`--uncommitted`/`--base`/`--commit`) — they are mutually exclusive. So a
    // focused run uses generic `codex exec` and conveys the target inside the
    // prompt text; only the unfocused run can use the `review` subcommand.
    if (prompt !== '') {
        const args = ['exec', '--json', '--ephemeral', '--output-last-message', resultFile, '--sandbox', 'read-only'];
        if (!options.useUserConfig) {
            args.push('--ignore-user-config');
        }
        if (options.model) {
            args.push('--model', options.model);
        }
        // The prompt travels on stdin, never argv. The codex binary is SIGKILLed by
        // the OS at exec time when any single argument exceeds ~1010 bytes — before
        // it runs a line of its own code, so there is no error to read: zero stdout,
        // zero stderr, signal SIGKILL. A focused review prompt is always larger than
        // that, so every real review died while a short smoke-test prompt passed.
        return { args, stdin: buildFocusedReviewPrompt(options, prompt) };
    }

    const args = ['exec', 'review', '--json', '--ephemeral', '--output-last-message', resultFile];
    if (!options.useUserConfig) {
        args.push('--ignore-user-config');
    }
    if (options.base) {
        args.push('--base', options.base);
    } else if (options.commit) {
        args.push('--commit', options.commit);
    } else {
        args.push('--uncommitted');
    }
    if (options.model) {
        args.push('--model', options.model);
    }

    return { args, stdin: null };
}

function latestFinalMessage(eventsFile) {
    if (!fs.existsSync(eventsFile)) {
        return '';
    }

    const lines = fs.readFileSync(eventsFile, 'utf8').split(/\r?\n/);
    let finalMessage = '';

    for (const line of lines) {
        if (line.trim() === '') {
            continue;
        }
        try {
            const event = JSON.parse(line);
            if (
                event.type === 'item.completed'
                && event.item?.type === 'agent_message'
                && typeof event.item.text === 'string'
            ) {
                finalMessage = event.item.text;
            }
        } catch {
            continue;
        }
    }

    return finalMessage;
}

function isTerminalErrorEvent(event) {
    const type = typeof event.type === 'string' ? event.type : '';

    return type === 'turn.failed'
        || type === 'error'
        || type.endsWith('.failed')
        || type.endsWith('_failed')
        || event.error !== undefined;
}

function describeTerminalErrorEvent(event) {
    const type = typeof event.type === 'string' && event.type !== '' ? event.type : 'unknown event';
    const details = [
        event.error?.message,
        event.error,
        event.failure?.message,
        event.failure,
        event.message,
    ].find((value) => value !== undefined && value !== null && value !== '');

    if (details === undefined) {
        return type;
    }

    return `${type}: ${typeof details === 'string' ? details : JSON.stringify(details)}`;
}

function terminalErrors(eventsFile) {
    if (!fs.existsSync(eventsFile)) {
        return [];
    }

    const errors = [];
    const lines = fs.readFileSync(eventsFile, 'utf8').split(/\r?\n/);

    for (const line of lines) {
        if (line.trim() === '') {
            continue;
        }
        try {
            const event = JSON.parse(line);
            if (isTerminalErrorEvent(event)) {
                errors.push(describeTerminalErrorEvent(event));
            }
        } catch {
            continue;
        }
    }

    return errors;
}

function preview(text, limit) {
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, limit)}\n[truncated; read file for full output]`;
}

async function streamFinished(stream, label) {
    try {
        await finished(stream, { cleanup: true });

        return null;
    } catch (error) {
        return `${label}: ${error instanceof Error ? error.message : String(error)}`;
    }
}

function signalChildTree(child, signal) {
    if (typeof child.pid === 'number') {
        try {
            process.kill(-child.pid, signal);

            return;
        } catch {
            child.kill(signal);

            return;
        }
    }

    child.kill(signal);
}

async function runCodexReview(options) {
    ensureCommand('codex', ['exec', 'review', '--help'], 'Codex CLI with `exec review` is required. Install or update with `npm install -g @openai/codex`.');
    ensureCommand('git', ['rev-parse', '--show-toplevel'], 'Run from inside a Git repository.');

    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-'));
    const resultFile = path.join(runDir, 'result.md');
    const eventsFile = path.join(runDir, 'events.jsonl');
    const stderrFile = path.join(runDir, 'stderr.log');
    const { args, stdin: stdinPrompt } = buildCodexArgs(options, resultFile);

    const eventsStream = fs.createWriteStream(eventsFile, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrFile, { flags: 'a' });
    const streamsFinished = Promise.all([
        streamFinished(eventsStream, 'events stream'),
        streamFinished(stderrStream, 'stderr stream'),
    ]);

    const child = spawn('codex', args, {
        cwd: process.cwd(),
        detached: true,
        env: process.env,
        stdio: [stdinPrompt === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    if (stdinPrompt !== null) {
        // A codex that fails fast (bad auth, untrusted directory) exits before it
        // reads the prompt, and the unhandled EPIPE would take the wrapper down with
        // it — losing the report that says what went wrong.
        child.stdin.on('error', () => {});
        child.stdin.end(stdinPrompt);
    }

    child.stdout.pipe(eventsStream);
    child.stderr.pipe(stderrStream);

    let timedOut = false;
    let forceKillTimer = null;
    const timeout = setTimeout(() => {
        timedOut = true;
        signalChildTree(child, 'SIGTERM');
        forceKillTimer = setTimeout(() => signalChildTree(child, 'SIGKILL'), KILL_GRACE_MS);
    }, options.timeoutMs);

    const exit = await new Promise((resolve) => {
        child.on('error', (error) => resolve({ code: 1, signal: null, error }));
        child.on('exit', (code, signal) => resolve({ code, signal, error: null }));
    });

    clearTimeout(timeout);
    if (forceKillTimer) {
        clearTimeout(forceKillTimer);
    }

    const streamErrors = (await streamsFinished).filter(Boolean);

    if (!fs.existsSync(resultFile)) {
        const finalMessage = latestFinalMessage(eventsFile);
        if (finalMessage !== '') {
            fs.writeFileSync(resultFile, `${finalMessage.trim()}\n`, 'utf8');
        }
    }

    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8').trim() : '';
    const result = fs.existsSync(resultFile) ? fs.readFileSync(resultFile, 'utf8').trim() : '';
    const terminalEventErrors = terminalErrors(eventsFile);

    const report = {
        ok: !timedOut && exit.code === 0 && result !== '' && streamErrors.length === 0 && terminalEventErrors.length === 0,
        timedOut,
        exitCode: exit.code,
        signal: exit.signal,
        runDir,
        resultFile,
        eventsFile,
        stderrFile,
        command: ['codex', ...args],
        resultPreview: preview(result, 500),
        stderrPreview: preview(stderr, 1000),
        resultBytes: Buffer.byteLength(result, 'utf8'),
        stderrBytes: Buffer.byteLength(stderr, 'utf8'),
        error: exit.error ? String(exit.error.message ?? exit.error) : null,
        streamErrors,
        terminalEventErrors,
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (!report.ok) {
        process.exitCode = timedOut ? 124 : (exit.code && exit.code !== 0 ? exit.code : 1);
    }
}

function outputFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({
        ok: false,
        timedOut: false,
        exitCode: 1,
        signal: null,
        runDir: null,
        resultFile: null,
        eventsFile: null,
        stderrFile: null,
        command: null,
        resultPreview: '',
        stderrPreview: message,
        resultBytes: 0,
        stderrBytes: Buffer.byteLength(message, 'utf8'),
        error: message,
        streamErrors: [],
        terminalEventErrors: [],
    }, null, 2)}\n`);
    process.exitCode = 1;
}

try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
    } else {
        await runCodexReview(options);
    }
} catch (error) {
    outputFailure(error);
}
