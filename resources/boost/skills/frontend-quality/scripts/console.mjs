#!/usr/bin/env node
// console.mjs — the frontend-quality skill's browser console/error capture companion.
// Source of truth. boost-core (>= 1.3) emits this beside the rendered SKILL.md into
// each agent's skill dir (e.g. `.claude/skills/frontend-quality/scripts/`); edit it
// HERE, not the emitted copy, and re-sync.
//
// Framework-agnostic runtime check: load a URL on the project's running app and record
// console errors/warnings, uncaught page errors, and failed requests — the signals
// type-check and lint can't see. Optionally scan for a leak pattern the project supplies
// (e.g. untranslated-key markers): --text-pattern matches both the rendered text AND
// screen-reader attributes (aria-label, title, alt, placeholder — where a raw key hides
// from a visible-text-only scan). Optionally run an axe-core accessibility/contrast pass
// (--axe). Prints a JSON report; with --fail-on-error, exits non-zero when the page is not
// clean: console/page errors, leaks, serious/critical axe violations, a main-document ≥400
// (wrong-host / dead page), or a failed application request (xhr/fetch ≥400 or network fail).
// Every failed request (any type) is listed in `failedRequests` for inspection.
//
// Prerequisite (the project provides it): npm i -D playwright && npx playwright install chromium
// The --axe pass additionally needs: npm i -D @axe-core/playwright

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
        '                   [--viewport <WxH>] [--timeout-ms <ms>] [--axe] [--fail-on-error]',
        '',
        'Loads the page and records console errors/warnings, uncaught page errors, and',
        'failed requests. --text-pattern scans both the rendered text and screen-reader',
        'attributes (aria-label, title, alt, placeholder) for a project-supplied regex',
        '(e.g. untranslated-key markers). --axe runs an axe-core accessibility/contrast pass',
        '(needs @axe-core/playwright). --fail-on-error exits 1 when the page is not clean:',
        'console/page errors, leaks, serious/critical axe violations, a main-document ≥400, or',
        'a failed application request (xhr/fetch). Every failed request is listed in failedRequests.',
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
        axe: false,
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
        if (arg === '--axe') {
            options.axe = true;
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
    let appRequestFailed = false;

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
        // Both HTTP ≥400 responses (a silently-500ing XHR) and network-level failures:
        // `requestfailed` never fires for 4xx/5xx, so the `response` listener catches those.
        // An xhr/fetch failure is an application-request failure (a feature depends on it) and
        // gates `clean`; a decorative sub-resource failure (favicon/image/font) does not by
        // itself gate `clean` (the browser may still log its own console error for it).
        const isAppRequest = (request) => request.resourceType() === 'xhr' || request.resourceType() === 'fetch';
        page.on('response', (response) => {
            if (response.status() >= 400) {
                const request = response.request();
                failedRequests.push(`${request.method()} ${response.url()} — ${response.status()}`);
                if (isAppRequest(request)) {
                    appRequestFailed = true;
                }
            }
        });
        page.on('requestfailed', (request) => {
            failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`);
            if (isAppRequest(request)) {
                appRequestFailed = true;
            }
        });

        const response = await page.goto(options.url, { waitUntil: 'load', timeout: options.timeoutMs });
        // The MAIN document status is a first-class signal: a hard 404/500 here is the
        // "wrong host / dead page" case the docs warn about, so it gates `clean` (below) —
        // distinct from a subresource ≥400 (favicon), which stays informational.
        const navStatus = response ? response.status() : null;
        if (options.waitSelector) {
            await page.waitForSelector(options.waitSelector, { timeout: options.timeoutMs });
        }
        if (options.dwellMs > 0) {
            await page.waitForTimeout(options.dwellMs);
        }

        let leaks = [];
        if (options.textRegex) {
            // Scan the rendered text AND screen-reader attributes: a raw i18n key in an
            // aria-label / title / alt / placeholder is invisible to a body-text-only scan.
            const scanText = await page.evaluate(() => {
                const parts = [document.body?.innerText ?? ''];
                const attributes = ['aria-label', 'aria-valuetext', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'title', 'alt', 'placeholder'];
                for (const element of document.querySelectorAll('*')) {
                    for (const name of attributes) {
                        const value = element.getAttribute(name);
                        if (value) {
                            parts.push(value);
                        }
                    }
                }

                return parts.join('\n');
            });
            leaks = [...new Set(scanText.match(options.textRegex) ?? [])];
        }

        const axe = options.axe ? await runAxe(page) : null;

        return { consoleErrors, consoleWarnings, pageErrors, failedRequests, leaks, axe, navStatus, appRequestFailed };
    } finally {
        await browser.close();
    }
}

// Optional axe-core accessibility/contrast pass. @axe-core/playwright is a project
// prerequisite for --axe; a missing package is reported as a setup gap (available:false
// + install hint), not a page defect, so it never silently greens a skipped audit.
async function runAxe(page) {
    let AxeBuilder;
    try {
        // @axe-core/playwright exports AxeBuilder as a NAMED export (its README documents
        // `const { AxeBuilder } = require(...)`); under `await import()` of the CJS module,
        // `.default` is the namespace object, not the class. Prefer the named export, fall
        // back to `.default` for any dual-published build.
        const mod = await import('@axe-core/playwright');
        AxeBuilder = mod.AxeBuilder ?? mod.default;
        if (typeof AxeBuilder !== 'function') {
            throw new Error('@axe-core/playwright did not export an AxeBuilder constructor');
        }
    } catch (error) {
        return {
            available: false,
            hint: 'Install the axe pass: npm i -D @axe-core/playwright',
            error: error instanceof Error ? error.message : String(error),
        };
    }

    const results = await new AxeBuilder({ page }).analyze();
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    const violations = results.violations.map((violation) => {
        if (violation.impact && counts[violation.impact] !== undefined) {
            counts[violation.impact] += 1;
        }

        return {
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.length,
            targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
        };
    });

    return {
        available: true,
        blocking: counts.critical > 0 || counts.serious > 0,
        counts,
        violations,
    };
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
        const axeBlocking = result.axe?.available === true && result.axe.blocking === true;
        // A requested --axe pass that couldn't run (missing @axe-core/playwright) is a setup
        // failure: it must not read green in the JSON either, or a consumer parsing `clean`
        // (rather than the exit code) sees a pass for an audit that never ran.
        const axeRequestedButUnavailable = options.axe && result.axe?.available === false;
        const navFailed = result.navStatus !== null && result.navStatus >= 400;
        const clean = result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.leaks.length === 0 && !axeBlocking && !axeRequestedButUnavailable && !navFailed && !result.appRequestFailed;
        report({
            ok: true,
            url: options.url,
            clean,
            navStatus: result.navStatus,
            appRequestFailed: result.appRequestFailed,
            consoleErrors: result.consoleErrors,
            pageErrors: result.pageErrors,
            leaks: result.leaks,
            consoleWarnings: result.consoleWarnings,
            failedRequests: result.failedRequests,
            axe: result.axe,
            error: null,
        });
        // Missing-but-requested axe (folded into `clean` above) exits non-zero even
        // without --fail-on-error: a setup failure like a missing Playwright, so it
        // can't silently green an audit that never ran.
        if (axeRequestedButUnavailable || (options.failOnError && !clean)) {
            process.exitCode = 1;
        }
    } catch (error) {
        report({ ok: false, url: options.url, error: error instanceof Error ? error.message : String(error) });
        process.exitCode = 1;
    }
}

await main();
