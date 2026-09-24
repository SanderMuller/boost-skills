#!/usr/bin/env node

// Run with: node .github/test-dangling-symbols.mjs
// No test framework — real git repositories in temp dirs.
//
// The script's one unacceptable failure is answering "no dangling references" because it
// could not run, and every guard in it is invisible until a case exercises it. Three of
// these cases caught real bugs in the batched rewrite.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(
    new URL('../resources/boost/skills/resolve-conflicts/scripts/dangling-symbols.sh', import.meta.url),
);

function git(cwd, ...args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);

    return result.stdout.trim();
}

function sweep(cwd, args) {
    return spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

// The fixtures merge two sides that touch different files, so a non-zero exit means the
// fixture itself broke — assert it, or every later assertion is judging the wrong tree.
function mergeCleanly(cwd, branch) {
    const result = spawnSync('git', ['merge', '--no-commit', branch], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `fixture merge of ${branch} failed: ${result.stdout}${result.stderr}`);
}

function write(cwd, file, content) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), content);
}

// A merged repo where the incoming side renamed a declaration and our side added a
// caller of the old name: the case git merges cleanly and this script exists to catch.
function createMergedRepo({ ourCaller = 'formatAmount();\n' } = {}) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    write(cwd, 'src/helper.js', 'function formatAmount() {}\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/helper.js', 'function formatMoney() {}\n');
    git(cwd, 'commit', '-qam', 'rename');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/receipt.js', ourCaller);
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'new caller');

    mergeCleanly(cwd, 'theirs');

    return cwd;
}

function testDetectsStaleReferenceToRenamedDeclaration() {
    const cwd = createMergedRepo();
    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);

    assert.equal(result.status, 1, 'a dangling reference must exit 1');
    assert.match(result.stdout, /DANGLING {2}formatAmount/);
    assert.match(result.stdout, /src\/receipt\.js/);
    // The declaration's own file must NOT be listed: after the merge `src/helper.js`
    // holds the renamed symbol, so seeing it here means the rename never applied or the
    // sweep is matching declarations instead of stale references.
    assert.doesNotMatch(result.stdout, /src\/helper\.js/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

function testCleanWhenTheCallerWasUpdatedToo() {
    const cwd = createMergedRepo({ ourCaller: 'formatMoney();\n' });
    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);

    assert.equal(result.status, 0, `expected a clean sweep, got: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /No dangling references/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// The reverse direction: OUR side removed a declaration THEIR side still calls. A
// one-directional sweep passes this case, which is why both directions are swept.
function testDetectsReferenceIntoADeclarationOurSideRemoved() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    write(cwd, 'src/helper.js', 'function legacyHelper() {}\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/report.js', 'legacyHelper();\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'new caller on their side');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/helper.js', '\n');
    git(cwd, 'commit', '-qam', 'drop the helper');

    mergeCleanly(cwd, 'theirs');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 1, 'the ours-removed direction must be swept too');
    assert.match(result.stdout, /DANGLING {2}legacyHelper/);
    assert.match(result.stdout, /src\/report\.js/, 'the stale caller on their side is the hit');

    fs.rmSync(cwd, { recursive: true, force: true });
}

// Whole-word matching: `formatAmountInCents` is a different symbol, not a stale
// reference to `formatAmount`. Reporting it would train readers to ignore the output.
function testDoesNotMatchASymbolEmbeddedInALongerName() {
    const cwd = createMergedRepo({ ourCaller: 'formatAmountInCents();\n' });
    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);

    assert.equal(result.status, 0, `a substring match must not count, got: ${result.stdout}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// The default keyword set claims TS coverage, so a removed `type` alias still
// referenced by the other side has to be caught like any other declaration.
function testDetectsAStaleTypeScriptTypeAlias() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    write(cwd, 'src/types.ts', 'export type MoneyAmount = number;\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/types.ts', 'export type Money = number;\n');
    git(cwd, 'commit', '-qam', 'rename the alias');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/cart.ts', 'let total: MoneyAmount;\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'new consumer of the old alias');

    mergeCleanly(cwd, 'theirs');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 1, 'a removed type alias is a declaration too');
    assert.match(result.stdout, /DANGLING {2}MoneyAmount/);
    assert.match(result.stdout, /src\/cart\.ts/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// A name that something else still declares is not dangling. Renamed locals are the
// common case: `for (const request of …)` reads as a removed `const request`, and
// reporting every file containing that word would drown the real hits.
function testIgnoresANameStillDeclaredElsewhere() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    write(cwd, 'src/a.js', 'const payload = 1;\n');
    write(cwd, 'src/b.js', 'const payload = 2;\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/a.js', 'const body = 1;\n');
    git(cwd, 'commit', '-qam', 'rename one of them');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/c.js', 'use(payload);\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'reference the name');

    mergeCleanly(cwd, 'theirs');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 0, `src/b.js still declares payload, so nothing dangles: ${result.stdout}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// The pathspec narrows where stale references are searched for, not where declarations
// count. A symbol declared outside it is still declared — reporting it would punish
// anyone who scopes the sweep to the directories they touched.
function testADeclarationOutsideThePathspecStillCounts() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    write(cwd, 'src/a.js', 'const payload = 1;\n');
    write(cwd, 'lib/vendor.js', 'const payload = 2;\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/a.js', 'const body = 1;\n');
    git(cwd, 'commit', '-qam', 'rename the one in src');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/c.js', 'use(payload);\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'reference the name');

    mergeCleanly(cwd, 'theirs');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 0, `lib/ still declares payload, so nothing dangles: ${result.stdout}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

function testKeywordsNarrowTheScan() {
    const cwd = createMergedRepo();
    const result = sweep(cwd, ['--base', 'theirs', '--keywords', 'class|trait', '--', 'src/']);

    assert.equal(result.status, 0, 'a keyword set that matches no declaration finds nothing');

    fs.rmSync(cwd, { recursive: true, force: true });
}

function testUsageErrorsExitTwo() {
    const cwd = createMergedRepo();

    const missingBase = sweep(cwd, ['--', 'src/']);
    assert.equal(missingBase.status, 2, '--base is required');
    assert.match(missingBase.stderr, /--base is required/);

    const unknownArgument = sweep(cwd, ['--nope']);
    assert.equal(unknownArgument.status, 2, 'an unknown flag is a usage error, not a finding');

    const badRef = sweep(cwd, ['--base', 'no-such-ref']);
    assert.equal(badRef.status, 2, 'an unresolvable ref is a usage error, not a finding');
    assert.match(badRef.stderr, /cannot resolve ref/);

    const outsideRepo = spawnSync('bash', [SCRIPT, '--base', 'theirs'], {
        cwd: os.tmpdir(),
        encoding: 'utf8',
    });
    assert.equal(outsideRepo.status, 2, 'outside a repository is a usage error');

    fs.rmSync(cwd, { recursive: true, force: true });
}

function testHelpPrintsTheHeader() {
    const result = sweep(os.tmpdir(), ['--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /cross-side consistency check/);
    assert.doesNotMatch(result.stdout, /^#/m, 'the header prints without its comment markers');
}

// The reference scan reports a path holding a colon. The scan reads git's NUL-terminated
// filenames for exactly this: splitting `path:line:match` on colons loses the path here.
function testReportsAPathContainingAColon() {
    const cwd = createMergedRepo({ ourCaller: 'formatAmount();\n' });
    write(cwd, 'src/odd:12:name.js', 'formatAmount();\n');
    git(cwd, 'add', '-A');
    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);

    assert.equal(result.status, 1, 'a dangling reference must exit 1');
    assert.match(result.stdout, /src\/odd:12:name\.js/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// Generated bundles are megabytes of vendored text that dominate the scan, and a stale
// reference inside one is not ours to fix. The declaration pass stays repo-wide, so this
// exclusion can hide a hit but never invent a clean sweep.
function testSkipsGeneratedBundlesWhenLookingForReferences() {
    const cwd = createMergedRepo({ ourCaller: 'nothingStale();\n' });
    write(cwd, 'src/bundle.min.js', 'formatAmount();\n');
    write(cwd, 'src/bundle.js.map', 'formatAmount();\n');
    git(cwd, 'add', '-A');
    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);

    assert.equal(result.status, 0, `expected a clean sweep, got: ${result.stdout}${result.stderr}`);
    assert.doesNotMatch(result.stdout, /bundle/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// A `git diff` that fails must stop the sweep, not leave it reporting a clean tree. The
// candidate collection runs `git diff` twice, and a failure there used to be swallowed:
// the script carried on with no candidates and printed "No dangling references".
function testAGitFailureStopsTheSweepInsteadOfReportingClean() {
    const cwd = createMergedRepo();
    const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-bin-'));
    const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    fs.writeFileSync(
        path.join(shim, 'git'),
        `#!/bin/sh\nfor arg in "$@"; do [ "$arg" = "diff" ] && exit 128; done\nexec ${realGit} "$@"\n`,
        { mode: 0o755 },
    );

    const result = spawnSync('bash', [SCRIPT, '--base', 'theirs', '--', 'src/'], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${shim}:${process.env.PATH}` },
    });

    assert.equal(result.status, 2, 'a failing git must exit 2');
    assert.doesNotMatch(result.stdout, /No dangling references/);

    fs.rmSync(shim, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
}

// The grep_tree guard is the centrepiece of the batched form: a git grep that errors must
// stop the sweep. Nothing else exercises that branch, so an edit dropping the status
// capture would turn a hard failure back into a silent clean with every test still green.
function testAFailingGitGrepStopsTheSweep() {
    const cwd = createMergedRepo();
    const result = sweep(cwd, ['--base', 'theirs', '--', ':(bogus)src/']);

    assert.equal(result.status, 2, 'a failing git grep must exit 2');
    assert.match(result.stderr, /git grep failed/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// The chunker is the performance change itself, and a chunk-boundary regression produces a
// SMALLER result set, which reads as cleaner. 250 candidates cross the 200-name boundary.
function testReportsEveryCandidateAcrossChunkBoundaries() {
    const count = 250;
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    const names = Array.from({ length: count }, (_, index) => `chunkedHelper${index}`);
    write(cwd, 'src/helper.js', `${names.map((name) => `function ${name}() {}`).join('\n')}\n`);
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/helper.js', '\n');
    git(cwd, 'commit', '-qam', 'remove them all');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/caller.js', `${names.map((name) => `${name}();`).join('\n')}\n`);
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'call them all');

    mergeCleanly(cwd, 'theirs');

    // No pathspec: the default branch carries its own copy of the exclude list, and the
    // pathspec branch is the one the other tests cover.
    const result = sweep(cwd, ['--base', 'theirs']);
    const reported = (result.stdout.match(/^DANGLING {2}/gm) ?? []).length;

    assert.equal(result.status, 1, 'dangling references must exit 1');
    assert.equal(reported, count, `expected ${count} symbols, got ${reported}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// An import is not a declaration. `import type MoneyAmount from './money'` carries the
// same shape as `type MoneyAmount = …`, so counting it would mark the removed alias as
// still declared and report the rename clean — the one wrong answer this script can give.
function testAnImportDoesNotCountAsADeclaration() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    write(cwd, 'src/money.ts', 'export type MoneyAmount = number;\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    git(cwd, 'checkout', '-q', '-b', 'theirs');
    write(cwd, 'src/money.ts', 'export type Money = number;\n');
    git(cwd, 'commit', '-qam', 'rename the alias');

    git(cwd, 'checkout', '-q', 'ours');
    write(cwd, 'src/cart.ts', "import type MoneyAmount from './money';\nlet total: MoneyAmount;\n");
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'import the old alias');

    mergeCleanly(cwd, 'theirs');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 1, 'the stale import must not mark the alias as declared');
    assert.match(result.stdout, /DANGLING {2}MoneyAmount/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// A generated bundle is build output, not a declaration site. If it still carries the old
// name after the source dropped it, counting it would mark the name declared and report a
// clean sweep over a tree whose source is broken.
function testAStaleBundleDeclarationDoesNotMaskADanglingReference() {
    const cwd = createMergedRepo();
    write(cwd, 'public/app.min.js', 'function formatAmount(){}\n');
    git(cwd, 'add', '-A');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 1, 'a bundle must not count as a declaration site');
    assert.match(result.stdout, /DANGLING {2}formatAmount/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// A git config that colours output must not empty the sweep. Both stages parse git's own
// output: the declaration pass reads names out of `git grep`, and the reference pass reads
// NUL-separated fields. ANSI codes wrapped around either make a declared name unmatchable
// and a path unusable, and the sweep reports clean rather than failing.
function testADiffRewritingGitConfigCannotEmptyTheSweep() {
    const cwd = createMergedRepo();
    git(cwd, 'config', 'color.ui', 'always');
    git(cwd, 'config', 'color.diff', 'always');

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);

    assert.equal(result.status, 1, 'forced colour must not hide the stale reference');
    assert.match(result.stdout, /DANGLING {2}formatAmount\n/);
    assert.match(result.stdout, / {10}src\/receipt\.js\n/);
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(result.stdout, /\x1B\[/, 'no ANSI codes reach the report');

    fs.rmSync(cwd, { recursive: true, force: true });
}

// Starts a repo on `ours` with the given files committed as the merge base.
function createBaseRepo(files) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dangling-'));
    git(cwd, 'init', '-q', '.');
    git(cwd, 'config', 'user.email', 'test@example.com');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'checkout', '-q', '-b', 'ours');

    for (const [file, content] of Object.entries(files)) {
        write(cwd, file, content);
    }
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'base');

    return cwd;
}

// Commits `theirs` and `ours` changes on their own branches, then merges theirs into ours.
function mergeSides(cwd, theirs, ours) {
    git(cwd, 'checkout', '-q', '-b', 'theirs');
    for (const [file, content] of Object.entries(theirs)) {
        write(cwd, file, content);
    }
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'their change');

    git(cwd, 'checkout', '-q', 'ours');
    for (const [file, content] of Object.entries(ours)) {
        write(cwd, file, content);
    }
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'our change');

    mergeCleanly(cwd, 'theirs');
}

// PHP 8.3 typed class constants: `const int LIMIT` declares LIMIT, not `int`. Adding
// a type to an existing constant is a common upgrade, and reading the type as the name
// reports every use of the constant.
function testATypedConstantKeepsItsName() {
    const cwd = createBaseRepo({ 'src/Limits.php': '<?php\nclass Limits { const LIMIT = 1; }\n' });
    mergeSides(
        cwd,
        { 'src/Limits.php': '<?php\nclass Limits { const ?int LIMIT = 1; }\n' },
        { 'src/Order.php': '<?php\necho Limits::LIMIT;\n' },
    );

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 0, `adding a type does not remove the constant: ${result.stdout}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

function testDetectsAStaleReferenceToARenamedTypedConstant() {
    const cwd = createBaseRepo({ 'src/Limits.php': '<?php\nclass Limits { const int | string LIMIT = 1; }\n' });
    mergeSides(
        cwd,
        { 'src/Limits.php': '<?php\nclass Limits { const int | string MAXIMUM = 1; }\n' },
        { 'src/Order.php': '<?php\necho Limits::LIMIT;\n' },
    );

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 1, 'a renamed typed constant is a removed declaration');
    assert.match(result.stdout, /DANGLING {2}LIMIT/);
    assert.match(result.stdout, /src\/Order\.php/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// A name one side removed still counts as declared when another file declares it as a
// typed constant, nullable included.
function testASurvivingTypedConstantStillCountsAsDeclared() {
    const cwd = createBaseRepo({
        'src/A.php': '<?php\nclass A { const LIMIT = 1; }\n',
        'src/B.php': '<?php\nclass B\n{\n    const ?int LIMIT = 2;\n}\n',
    });
    mergeSides(
        cwd,
        { 'src/A.php': '<?php\nclass A { const MAXIMUM = 1; }\n' },
        { 'src/Order.php': '<?php\necho B::LIMIT;\n' },
    );

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 0, `src/B.php still declares LIMIT: ${result.stdout}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// `use function` and `use const` import a name; they declare nothing. Removing one must
// not report every call to a built-in, and keeping one must not mark a name declared.
function testAUseFunctionImportIsNotADeclaration() {
    const cwd = createBaseRepo({
        'src/Check.php': '<?php\nuse function method_exists;\nuse const PHP_EOL;\nmethod_exists($a, "b");\n',
    });
    mergeSides(
        cwd,
        { 'src/Check.php': '<?php\nmethod_exists($a, "b");\n' },
        { 'src/Other.php': '<?php\nmethod_exists($c, "d") && print(PHP_EOL);\n' },
    );

    const result = sweep(cwd, ['--base', 'theirs', '--', 'src/']);
    assert.equal(result.status, 0, `removing an import removes no declaration: ${result.stdout}`);

    fs.rmSync(cwd, { recursive: true, force: true });
}

// Markdown prose and PHPStan baselines are not code. Prose that names the old symbol is
// not a stale reference, and a baseline message such as "Call to function formatAmount()"
// must not count as a declaration that hides the real one.
function testProseAndBaselinesAreNotCode() {
    const cwd = createMergedRepo();
    write(cwd, 'docs/notes.md', 'Call formatAmount() to format.\n');
    write(cwd, 'phpstan-baseline.neon', "message: '#Call to function formatAmount\\(\\)#'\n");
    write(cwd, 'config/services.neon', 'factory: formatAmount\n');
    git(cwd, 'add', '-A');

    const result = sweep(cwd, ['--base', 'theirs']);
    assert.equal(result.status, 1, 'the baseline must not mark the name declared');
    assert.match(result.stdout, /DANGLING {2}formatAmount/);
    assert.match(result.stdout, /src\/receipt\.js/);
    assert.doesNotMatch(result.stdout, /notes\.md|baseline\.neon/);
    // Only baselines are skipped: other .neon files are configuration that names real code.
    assert.match(result.stdout, /config\/services\.neon/);

    fs.rmSync(cwd, { recursive: true, force: true });
}

const tests = [
    testDetectsStaleReferenceToRenamedDeclaration,
    testCleanWhenTheCallerWasUpdatedToo,
    testDetectsReferenceIntoADeclarationOurSideRemoved,
    testDoesNotMatchASymbolEmbeddedInALongerName,
    testDetectsAStaleTypeScriptTypeAlias,
    testIgnoresANameStillDeclaredElsewhere,
    testADeclarationOutsideThePathspecStillCounts,
    testKeywordsNarrowTheScan,
    testUsageErrorsExitTwo,
    testHelpPrintsTheHeader,
    testReportsAPathContainingAColon,
    testSkipsGeneratedBundlesWhenLookingForReferences,
    testAGitFailureStopsTheSweepInsteadOfReportingClean,
    testAFailingGitGrepStopsTheSweep,
    testReportsEveryCandidateAcrossChunkBoundaries,
    testAnImportDoesNotCountAsADeclaration,
    testAStaleBundleDeclarationDoesNotMaskADanglingReference,
    testADiffRewritingGitConfigCannotEmptyTheSweep,
    testATypedConstantKeepsItsName,
    testDetectsAStaleReferenceToARenamedTypedConstant,
    testASurvivingTypedConstantStillCountsAsDeclared,
    testAUseFunctionImportIsNotADeclaration,
    testProseAndBaselinesAreNotCode,
];

let failures = 0;
for (const test of tests) {
    try {
        test();
        console.log(`PASS  ${test.name}`);
    } catch (error) {
        failures += 1;
        console.error(`FAIL  ${test.name}\n      ${error.message}`);
    }
}

console.log(`\n${tests.length - failures}/${tests.length} passed`);
process.exit(failures === 0 ? 0 : 1);
