#!/usr/bin/env node
// auth-capture.mjs — the frontend-quality skill's portable auth-session capturer.
// Source of truth. boost-core (>= 1.3) emits this beside the rendered SKILL.md into
// each agent's skill dir (e.g. `.claude/skills/frontend-quality/scripts/`); edit it
// HERE, not the emitted copy, and re-sync.
//
// Opens a HEADED browser at --url and lets a human log in by hand; when the
// login-complete signal is reached (a post-login --wait-selector appears, or the URL
// comes to contain --success-url-contains), it saves the Playwright storageState to
// --out. screenshot.mjs / console.mjs then reuse it via --storage-state. This knows
// nothing about any login form, so it works for any app — the portable auth seam.
//
// Needs a real display (headed browser) — it cannot run in a headless CI sandbox.
// Prerequisite (the project provides it): npm i -D playwright && npx playwright install chromium

import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

const DEFAULT_TIMEOUT_MS = 180_000; // 3 min for a human to log in
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const INSTALL_HINT = 'npm i -D playwright && npx playwright install chromium';
const VALUE_OPTIONS = new Set(['--url', '--out', '--wait-selector', '--success-url-contains', '--viewport', '--timeout-ms']);

function usage() {
    return [
        'Usage:',
        '  node auth-capture.mjs --url <login-url> --out <state.json>',
        '                        (--wait-selector <css> | --success-url-contains <substr>)',
        '                        [--viewport <WxH>] [--timeout-ms <ms>]',
        '',
        'Opens a headed browser; log in by hand. The session is saved to --out once the',
        'login-complete signal is reached: a post-login element (--wait-selector) appears,',
        'or the URL comes to contain --success-url-contains. Reuse it via --storage-state.',
        `Needs a display (headed). Prerequisite: Playwright installed (${INSTALL_HINT}).`,
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
        out: null,
        waitSelector: null,
        successUrlContains: null,
        viewport: DEFAULT_VIEWPORT,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (VALUE_OPTIONS.has(arg)) {
            const value = argv[index + 1];
            if (value === undefined) {
                throw new Error(`Missing value for ${arg}.`);
            }

            if (arg === '--url') {
                options.url = value;
            } else if (arg === '--out') {
                options.out = value;
            } else if (arg === '--wait-selector') {
                options.waitSelector = value;
            } else if (arg === '--success-url-contains') {
                options.successUrlContains = value;
            } else if (arg === '--viewport') {
                options.viewport = parseViewport(value);
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

    if (!options.url || !options.out) {
        throw new Error('Both --url and --out are required.');
    }
    if (!options.waitSelector && !options.successUrlContains) {
        throw new Error('Provide a login-complete signal: --wait-selector <css> or --success-url-contains <substr>.');
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
        browser = await chromium.launch({ headless: false });
    } catch (error) {
        const failure = new Error(`Could not launch a headed Chromium. This needs a real display (not a headless CI sandbox); if the browser binary is missing, install it:\n  ${INSTALL_HINT}\n${error instanceof Error ? error.message : String(error)}`);
        failure.cause = error;
        throw failure;
    }

    try {
        const context = await browser.newContext({ viewport: options.viewport });
        const page = await context.newPage();
        await page.goto(options.url, { waitUntil: 'load', timeout: options.timeoutMs });

        process.stderr.write(`Log in in the opened browser. Waiting up to ${Math.round(options.timeoutMs / 1000)}s for the login-complete signal…\n`);

        if (options.waitSelector) {
            await page.waitForSelector(options.waitSelector, { timeout: options.timeoutMs });
        } else {
            await page.waitForURL((url) => url.toString().includes(options.successUrlContains), { timeout: options.timeoutMs });
        }

        const outPath = path.resolve(options.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        await context.storageState({ path: outPath });

        return { outPath };
    } finally {
        await browser.close();
    }
}

async function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        report({ ok: false, out: null, error: error instanceof Error ? error.message : String(error) });
        process.exitCode = 1;

        return;
    }

    if (options.help) {
        process.stdout.write(`${usage()}\n`);

        return;
    }

    try {
        const result = await capture(options);
        report({ ok: true, out: result.outPath, url: options.url, error: null });
    } catch (error) {
        report({
            ok: false,
            out: null,
            url: options.url,
            error: error instanceof Error ? error.message : String(error),
        });
        process.exitCode = 1;
    }
}

await main();
