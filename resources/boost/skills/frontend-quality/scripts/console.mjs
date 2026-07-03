#!/usr/bin/env node
// console.mjs — the frontend-quality skill's browser console/error capture companion.
// Source of truth. boost-core (>= 1.3) emits this beside the rendered SKILL.md into
// each agent's skill dir (e.g. `.claude/skills/frontend-quality/scripts/`); edit it
// HERE, not the emitted copy, and re-sync.
//
// Framework-agnostic runtime check: load a URL on the project's running app and record
// console errors/warnings, uncaught page errors, and failed requests — the signals
// type-check and lint can't see. Optionally scan the rendered text for a leak pattern
// the project supplies (e.g. untranslated-key markers). Prints a JSON report; with
// --fail-on-error, exits non-zero when errors, page errors, or leaks are present.
//
// Prerequisite (the project provides it): npm i -D playwright && npx playwright install chromium

import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DWELL_MS = 1_500;
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const INSTALL_HINT = 'npm i -D playwright && npx playwright install chromium';
const VALUE_OPTIONS = new Set([
    '--url', '--wait-selector', '--dwell-ms', '--text-pattern', '--storage-state', '--viewport', '--timeout-ms',
]);

function usage() {
    return [
        'Usage:',
        '  node console.mjs --url <url> [--wait-selector <css>] [--dwell-ms <ms>]',
        '                   [--text-pattern <regex>] [--storage-state <file.json>]',
        '                   [--viewport <WxH>] [--timeout-ms <ms>] [--fail-on-error]',
        '',
        'Loads the page and records console errors/warnings, uncaught page errors, and',
        'failed requests. --text-pattern scans the rendered body text for a project-supplied',
        'regex (e.g. untranslated-key markers). --fail-on-error exits 1 when anything is found.',
        `Prerequisite: Playwright installed in the project (${INSTALL_HINT}).`,
    ].join('\n');
}

function parseViewport(value) {
    const match = /^(\d+)x(\d+)$/.exec(value);
    if (match === null) {
        throw new Error('--viewport must look like 1280x800.');
    }

    return { width: Number(match[1]), height: Number(match[2]) };
}

function parseArgs(argv) {
    const options = {
        url: null,
        waitSelector: null,
        dwellMs: DEFAULT_DWELL_MS,
        textPattern: null,
        storageState: null,
        viewport: DEFAULT_VIEWPORT,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        failOnError: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--fail-on-error') {
            options.failOnError = true;
            continue;
        }

        if (VALUE_OPTIONS.has(arg)) {
            const value = argv[index + 1];
            if (value === undefined) {
                throw new Error(`Missing value for ${arg}.`);
            }

            if (arg === '--url') {
                options.url = value;
            } else if (arg === '--wait-selector') {
                options.waitSelector = value;
            } else if (arg === '--text-pattern') {
                options.textPattern = value;
            } else if (arg === '--storage-state') {
                options.storageState = value;
            } else if (arg === '--viewport') {
                options.viewport = parseViewport(value);
            } else if (arg === '--dwell-ms') {
                const dwellMs = Number(value);
                if (!Number.isFinite(dwellMs) || dwellMs < 0) {
                    throw new Error('--dwell-ms must be a non-negative number.');
                }
                options.dwellMs = Math.floor(dwellMs);
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

    if (!options.url) {
        throw new Error('--url is required.');
    }
    if (options.textPattern !== null) {
        try {
            options.textRegex = new RegExp(options.textPattern, 'g');
        } catch (error) {
            throw new Error(`--text-pattern is not a valid regex: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (options.storageState && !fs.existsSync(path.resolve(options.storageState))) {
        throw new Error(`--storage-state file not found: ${options.storageState}`);
    }

    return options;
}

function report(object) {
    process.stdout.write(`${JSON.stringify(object, null, 2)}\n`);
}

async function loadChromium() {
    let playwright;
    try {
        playwright = await import('playwright');
    } catch (error) {
        const failure = new Error(`Playwright is not installed. Install it in this project:\n  ${INSTALL_HINT}`);
        failure.cause = error;
        throw failure;
    }

    return playwright.chromium;
}

async function capture(options) {
    const chromium = await loadChromium();

    let browser;
    try {
        browser = await chromium.launch();
    } catch (error) {
        const failure = new Error(`Could not launch Chromium. If the browser binary is missing, install it:\n  ${INSTALL_HINT}\n${error instanceof Error ? error.message : String(error)}`);
        failure.cause = error;
        throw failure;
    }

    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];
    const failedRequests = [];

    try {
        const contextOptions = { viewport: options.viewport };
        if (options.storageState) {
            contextOptions.storageState = path.resolve(options.storageState);
        }
        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        page.setDefaultTimeout(options.timeoutMs);

        page.on('console', (message) => {
            const type = message.type();
            if (type === 'error') {
                consoleErrors.push(message.text());
            } else if (type === 'warning') {
                consoleWarnings.push(message.text());
            }
        });
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('requestfailed', (request) => {
            failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`);
        });

        await page.goto(options.url, { waitUntil: 'load', timeout: options.timeoutMs });
        if (options.waitSelector) {
            await page.waitForSelector(options.waitSelector, { timeout: options.timeoutMs });
        }
        if (options.dwellMs > 0) {
            await page.waitForTimeout(options.dwellMs);
        }

        let leaks = [];
        if (options.textRegex) {
            const text = await page.evaluate(() => document.body?.innerText ?? '');
            leaks = [...new Set(text.match(options.textRegex) ?? [])];
        }

        return { consoleErrors, consoleWarnings, pageErrors, failedRequests, leaks };
    } finally {
        await browser.close();
    }
}

async function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        report({ ok: false, error: error instanceof Error ? error.message : String(error) });
        process.exitCode = 1;

        return;
    }

    if (options.help) {
        process.stdout.write(`${usage()}\n`);

        return;
    }

    try {
        const result = await capture(options);
        const clean = result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.leaks.length === 0;
        report({
            ok: true,
            url: options.url,
            clean,
            consoleErrors: result.consoleErrors,
            pageErrors: result.pageErrors,
            leaks: result.leaks,
            consoleWarnings: result.consoleWarnings,
            failedRequests: result.failedRequests,
            error: null,
        });
        if (options.failOnError && !clean) {
            process.exitCode = 1;
        }
    } catch (error) {
        report({ ok: false, url: options.url, error: error instanceof Error ? error.message : String(error) });
        process.exitCode = 1;
    }
}

await main();
