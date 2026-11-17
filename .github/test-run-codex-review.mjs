#!/usr/bin/env node
// Self-test for the codex-review wrapper. A fake `codex` on PATH stands in for
// the CLI, so the test needs no network and no Codex account.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../resources/boost/skills/codex-review/scripts/run-codex-review.mjs', import.meta.url));

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        ...options,
    });
}

function gitIn(repo, args) {
    const result = run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: repo });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);

    return result;
}

function commitOn(repo, file, content) {
    fs.writeFileSync(path.join(repo, file), content, 'utf8');
    gitIn(repo, ['add', file]);
    gitIn(repo, ['commit', '--quiet', '-m', file]);
}

function createRepo({ branch = null, dirty = true } = {}) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-test-repo-'));
    gitIn(repo, ['init', '--quiet', '--initial-branch=main']);
    commitOn(repo, 'README.md', 'Initial\n');

    if (branch !== null) {
        gitIn(repo, ['checkout', '--quiet', '-b', branch]);
    }

    if (dirty) {
        fs.writeFileSync(path.join(repo, 'README.md'), 'Changed\n', 'utf8');
    }

    return repo;
}

function createFakeCodex(mode) {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-test-bin-'));
    const codexPath = path.join(binDir, 'codex');

    fs.writeFileSync(codexPath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const mode = ${JSON.stringify(mode)};
if (args.join(' ') === 'exec review --help') {
  console.log('fake help');
  process.exit(0);
}
if (mode === 'sleep') {
  setTimeout(() => {}, 60_000);
  return;
}
const outIndex = args.indexOf('--output-last-message');
const write = (text) => { if (outIndex !== -1) fs.writeFileSync(args[outIndex + 1], text + '\\n'); };
if (mode === 'fail') {
  write('partial review result');
  console.error('fatal: something broke');
  process.exit(42);
}
if (mode === 'turn-failed') {
  write('Review was interrupted.');
  console.log(JSON.stringify({ type: 'turn.failed', error: { message: 'usage limit' } }));
  process.exit(0);
}
if (mode === 'empty') {
  process.exit(0);
}
write('fake review result');
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'fake review result' } }));
`, 'utf8');
    fs.chmodSync(codexPath, 0o755);

    return binDir;
}

function runWrapper(repo, mode, args) {
    return run(process.execPath, [SCRIPT, ...args], {
        cwd: repo,
        env: { ...process.env, PATH: `${createFakeCodex(mode)}${path.delimiter}${process.env.PATH}` },
    });
}

function report(result) {
    return JSON.parse(result.stdout);
}

function baseArgument(parsed) {
    return parsed.command[parsed.command.indexOf('--base') + 1];
}

// Success: no failure, and `failure` is the first field of the report.
const success = runWrapper(createRepo(), 'success', ['--uncommitted']);
assert.equal(success.status, 0, success.stderr || success.stdout);
assert.equal(report(success).ok, true);
assert.equal(report(success).failure, null);
assert.equal(Object.keys(report(success))[0], 'failure');

// Each failure names its cause.
const timeout = runWrapper(createRepo(), 'sleep', ['--uncommitted', '--timeout-ms', '1000']);
assert.equal(timeout.status, 124);
assert.equal(report(timeout).failure, 'codex timed out after 1000ms');

const nonZeroExit = runWrapper(createRepo(), 'fail', ['--uncommitted']);
assert.equal(nonZeroExit.status, 42);
assert.equal(report(nonZeroExit).failure, 'codex exited with code 42: fatal: something broke');

const terminalFailure = runWrapper(createRepo(), 'turn-failed', ['--uncommitted']);
assert.equal(terminalFailure.status, 1);
assert.equal(report(terminalFailure).ok, false);
assert.equal(report(terminalFailure).failure, 'turn.failed: usage limit');

const empty = runWrapper(createRepo(), 'empty', ['--uncommitted']);
assert.equal(empty.status, 1);
assert.equal(report(empty).failure, 'codex wrote no review');

// A preflight error keeps its detail in stderrPreview; `failure` is its first line.
const outsideRepo = runWrapper(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-test-norepo-')), 'success', ['--uncommitted']);
assert.equal(report(outsideRepo).failure, 'Run from inside a Git repository.');

const missingValue = runWrapper(createRepo(), 'success', ['--base']);
assert.equal(missingValue.status, 1);
assert.match(report(missingValue).failure, /Missing value for --base/);

const optionLikeBase = runWrapper(createRepo(), 'success', ['--base', '--upload-pack=x']);
assert.equal(optionLikeBase.status, 1);
assert.match(report(optionLikeBase).failure, /--base takes a branch name/);

// A repository without a remote keeps the base as given.
const branchRepo = createRepo({ branch: 'feature/review', dirty: false });
commitOn(branchRepo, 'BRANCH.md', 'Committed branch change\n');
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', 'main']))), 'main');

// origin/main moves ahead of the local main, as after a merge on GitHub. The
// push comes after the repository's own fetch, so only the wrapper's fetch can
// bring the merge in, and the feature branch then takes it, as a sync does.
const origin = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-test-origin-'));
assert.equal(run('git', ['clone', '--quiet', '--bare', branchRepo, origin]).status, 0);
gitIn(branchRepo, ['remote', 'add', 'origin', origin]);
gitIn(branchRepo, ['fetch', '--quiet', 'origin']);
gitIn(branchRepo, ['remote', 'set-head', 'origin', 'main']);
const pusher = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-test-pusher-'));
assert.equal(run('git', ['clone', '--quiet', '--branch', 'main', origin, pusher]).status, 0);
commitOn(pusher, 'MERGED.md', 'Merged on origin\n');
gitIn(pusher, ['push', '--quiet', 'origin', 'main']);
const mergedSha = run('git', ['rev-parse', 'HEAD'], { cwd: pusher }).stdout.trim();
gitIn(branchRepo, ['fetch', '--quiet', origin, 'main']);
gitIn(branchRepo, ['merge', '--quiet', '--no-edit', 'FETCH_HEAD']);
const trackingRef = () => run('git', ['rev-parse', 'origin/main'], { cwd: branchRepo }).stdout.trim();
assert.notEqual(trackingRef(), mergedSha);

// The stale local main must not be used, explicit or inferred.
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', 'main']))), 'origin/main');
assert.equal(trackingRef(), mergedSha);
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', []))), 'origin/main');
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', 'origin/main']))), 'origin/main');

// A local main that diverged from origin, with a commit origin never got, does
// not hide the merge the branch already holds.
gitIn(branchRepo, ['checkout', '--quiet', 'main']);
commitOn(branchRepo, 'STRAY.md', 'A commit origin never got\n');
gitIn(branchRepo, ['checkout', '--quiet', 'feature/review']);
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', 'main']))), 'origin/main');

// A branch stacked on a parent with unpushed work keeps the local parent.
gitIn(branchRepo, ['checkout', '--quiet', '-b', 'parent']);
gitIn(branchRepo, ['push', '--quiet', 'origin', 'parent']);
commitOn(branchRepo, 'PARENT.md', 'Unpushed parent work\n');
gitIn(branchRepo, ['checkout', '--quiet', '-b', 'feature/stacked']);
commitOn(branchRepo, 'STACKED.md', 'Stacked change\n');
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', 'parent']))), 'parent');

// A SHA is not a branch: it stays as given.
const sha = run('git', ['rev-parse', 'main'], { cwd: branchRepo }).stdout.trim();
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', sha]))), sha);

// A revision is not a branch, so it is never rewritten to origin/<revision>.
assert.equal(baseArgument(report(runWrapper(branchRepo, 'success', ['--base', 'HEAD~1']))), 'HEAD~1');

// A branch with only uncommitted work falls back to the working tree.
const dirtyOnly = runWrapper(createRepo({ branch: 'feature/dirty-only', dirty: true }), 'success', []);
assert.equal(dirtyOnly.status, 0, dirtyOnly.stderr || dirtyOnly.stdout);
assert.ok(report(dirtyOnly).command.includes('--uncommitted'));

process.stdout.write('run-codex-review self-test: clean\n');
