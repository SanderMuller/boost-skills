#!/usr/bin/env node
// screenshot.mjs — the frontend-quality skill's generic browser screenshot companion.
// Source of truth. boost-core (>= 1.3) emits this beside the rendered SKILL.md into
// each agent's skill dir (e.g. `.claude/skills/frontend-quality/scripts/`); edit it
// HERE, not the emitted copy, and re-sync.
//
// Framework-agnostic eye-verify capture: point it at a URL on the project's already
// running app, optionally crop to a CSS selector with >=15px breathing room, and save
// a PNG. No app coupling — no login flow, no framework assumptions. Authenticated pages
// use a Playwright storageState file the project captures itself (--storage-state), the
// one portable auth seam. Prints a JSON report to stdout.
//
// Prerequisite (the project provides it; this catalog does not bundle browsers):
//   npm i -D playwright && npx playwright install chromium
// The script fails fast with that guidance when Playwright or its browser is missing.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_PADDING = 15;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const INSTALL_HINT = 'npm i -D playwright && npx playwright install chromium';
const VALUE_OPTIONS = new Set([
    '--url', '--out', '--selector', '--wait-selector', '--padding', '--viewport', '--storage-state', '--timeout-ms',
]);

function usage() {
    return [
        'Usage:',
        '  node screenshot.mjs --url <url> --out <file.png> [--selector <css>] [--padding <px>]',
        '                      [--wait-selector <css>] [--full-page] [--viewport <WxH>]',
        '                      [--storage-state <file.json>] [--timeout-ms <ms>]',
        '',
        'Captures a PNG of a running app. With --selector, crops to that element plus',
        `--padding px of breathing room (default ${DEFAULT_PADDING}, clamped to the page).`,
        'Without --selector, captures the viewport (or the whole page with --full-page).',
        'Authenticated pages: capture a Playwright storageState once and pass --storage-state.',
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
        out: null,
        selector: null,
        waitSelector: null,
        padding: DEFAULT_PADDING,
        viewport: DEFAULT_VIEWPORT,
        storageState: null,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        fullPage: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--full-page') {
            options.fullPage = true;
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
            } else if (arg === '--selector') {
                options.selector = value;
            } else if (arg === '--wait-selector') {
                options.waitSelector = value;
            } else if (arg === '--storage-state') {
                options.storageState = value;
            } else if (arg === '--viewport') {
                options.viewport = parseViewport(value);
            } else if (arg === '--padding') {
                const padding = Number(value);
                if (!Number.isFinite(padding) || padding < 0) {
                    throw new Error('--padding must be a non-negative number.');
                }
                options.padding = Math.floor(padding);
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

// Element crop with padding, clamped to the page. Playwright's clip and fullPage are
// mutually exclusive, so we clip against page (not viewport) coordinates and let clip
// capture below the fold — scrolling the element in first makes its box reliable.
async function selectorClip(page, selector, padding) {
    const element = await page.$(selector);
    if (element === null) {
        throw new Error(`Selector not found: ${selector}`);
    }
    await element.scrollIntoViewIfNeeded();
    const box = await element.boundingBox();
    if (box === null) {
        throw new Error(`Selector matched but is not visible (no layout box): ${selector}`);
    }

    const page_ = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
    }));

    const x = Math.max(0, box.x - padding);
    const y = Math.max(0, box.y - padding);
    const right = Math.min(page_.width, box.x + box.width + padding);
    const bottom = Math.min(page_.height, box.y + box.height + padding);

    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
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

    try {
        const contextOptions = { viewport: options.viewport };
        if (options.storageState) {
            contextOptions.storageState = path.resolve(options.storageState);
        }
        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        page.setDefaultTimeout(options.timeoutMs);

        await page.goto(options.url, { waitUntil: 'load', timeout: options.timeoutMs });
        if (options.waitSelector) {
            await page.waitForSelector(options.waitSelector, { timeout: options.timeoutMs });
        }

        const outPath = path.resolve(options.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        const shot = { path: outPath };
        if (options.selector) {
            shot.clip = await selectorClip(page, options.selector, options.padding);
        } else {
            shot.fullPage = options.fullPage;
        }

        await page.screenshot(shot);

        return {
            width: shot.clip ? shot.clip.width : options.viewport.width,
            height: shot.clip ? shot.clip.height : null, // null: full/viewport height varies
            outPath,
        };
    } finally {
        await browser.close();
    }
}

async function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        report({ ok: false, outFile: null, error: error instanceof Error ? error.message : String(error) });
        process.exitCode = 1;

        return;
    }

    if (options.help) {
        process.stdout.write(`${usage()}\n`);

        return;
    }

    try {
        const result = await capture(options);
        report({
            ok: true,
            outFile: result.outPath,
            url: options.url,
            selector: options.selector,
            cropped: options.selector !== null,
            clipWidth: result.width,
            clipHeight: result.height,
            error: null,
        });
    } catch (error) {
        report({
            ok: false,
            outFile: null,
            url: options.url,
            selector: options.selector,
            error: error instanceof Error ? error.message : String(error),
        });
        process.exitCode = 1;
    }
}

await main();
