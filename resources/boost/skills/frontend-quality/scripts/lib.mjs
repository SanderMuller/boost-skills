#!/usr/bin/env node
// lib.mjs — the frontend-quality skill's portable eye-verify helper library.
// Source of truth. boost-core (>= 1.3) emits this beside the rendered SKILL.md into
// each agent's skill dir (e.g. `.claude/skills/frontend-quality/scripts/`); edit it
// HERE, not the emitted copy, and re-sync.
//
// This is NOT a runnable script — it exports helpers a project's own drive-script
// imports to operationalize the eye-verify methodology (see references/eye-verify.md):
//
//   import { createChecker, capturePageIssues, withFailedRoute } from './lib.mjs';
//
// Every helper is framework-agnostic: it operates on a Playwright `page` the caller
// already has, so this module imports no browser itself (no `playwright` dependency).
// It knows nothing about any specific app — the app-specific seams (login, serving,
// data seeding, domain drivers) stay in the project's own drive-script.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * The coverage contract, operationalized: one `check()` per testable, an explicit
 * `skip()` for anything you could not drive, and a `summarize()` that prints the
 * tally plus the gap list. A drive-script that merely "ran without throwing" verifies
 * nothing — assert the expected value per testable and let the checker fail loudly.
 *
 * When a `page` is passed, `summarize()` auto-dumps a screenshot + DOM to
 * `artifactsDir` if any check failed, so a red run is diagnosable without re-driving.
 *
 * @param {object} [options]
 * @param {import('playwright').Page} [options.page]  Enables failure-artifact capture.
 * @param {string} [options.artifactsDir]             Where failure artifacts land.
 * @param {string} [options.label]                    Names the artifact files.
 * @param {(text: string) => void} [options.log]      Sink for the PASS/FAIL lines.
 */
export function createChecker({ page = null, artifactsDir = 'eye-verify-artifacts', label = 'run', log = (text) => process.stdout.write(`${text}\n`) } = {}) {
    const results = [];
    const gaps = [];

    function record(status, name, detail) {
        results.push({ status, name, detail });
        const mark = status === 'pass' ? 'PASS' : 'FAIL';
        log(detail ? `  ${mark}  ${name} — ${detail}` : `  ${mark}  ${name}`);
    }

    return {
        /**
         * Assert one testable. `condition` is the already-evaluated result of your
         * assertion (e.g. `toggle.checked === true`); pass a message either way so a
         * FAIL says what was expected. Returns the boolean so you can branch on it.
         */
        check(name, condition, detail = '') {
            const ok = Boolean(condition);
            record(ok ? 'pass' : 'fail', name, detail);

            return ok;
        },

        /**
         * Declare a testable you could NOT drive (needs a real API key, another
         * tenant, a manual play-through). It is listed at the end as a gap — never
         * silently dropped. An honest green names its gaps.
         */
        skip(name, reason) {
            gaps.push({ name, reason });
            log(`  SKIP  ${name} — NOT VERIFIED: ${reason}`);
        },

        /** `true` while no check has failed. */
        get ok() {
            return results.every((result) => result.status === 'pass');
        },

        /**
         * Print the tally + the NOT-VERIFIED gap list. Captures failure artifacts
         * when a `page` was given and something failed. Returns a summary object and
         * sets `process.exitCode` to 1 on any failure — or when the run recorded
         * nothing at all (no `check()` and no `skip()`): a run that asserted nothing
         * is not a pass, so it can't green a drive-script that forgot its testables.
         */
        async summarize() {
            const passed = results.filter((result) => result.status === 'pass').length;
            const failed = results.filter((result) => result.status === 'fail').length;
            const empty = results.length === 0 && gaps.length === 0;

            log('');
            log(`  ${passed} passed, ${failed} failed, ${gaps.length} not verified`);
            if (empty) {
                log('  NO CHECKS RECORDED — a run that asserted nothing is not a pass (coverage contract).');
            }
            if (gaps.length > 0) {
                log('  NOT VERIFIED (gaps — turn each into a QA testable):');
                for (const gap of gaps) {
                    log(`    - ${gap.name}: ${gap.reason}`);
                }
            }

            let artifacts = null;
            if (failed > 0 && page) {
                artifacts = await captureFailureArtifacts(page, artifactsDir, label).catch(() => null);
                if (artifacts) {
                    log(`  Failure artifacts: ${artifacts.screenshot}, ${artifacts.dom}`);
                }
            }

            if (failed > 0 || empty) {
                process.exitCode = 1;
            }

            return { passed, failed, empty, gaps: [...gaps], ok: failed === 0 && !empty, artifacts };
        },
    };
}

/**
 * Attach the runtime-error listeners a clean-looking page can hide — and attach them
 * BEFORE `goto`. A `console` listener alone misses uncaught module-scope exceptions
 * (`pageerror`); a bundle that dies on load produces a page with ZERO console errors
 * where nothing ever initialized. It also records failed requests — HTTP responses
 * with a ≥400 status (a silently-500ing XHR) and network-level failures (DNS, refused,
 * aborted); `requestfailed` alone never fires for 4xx/5xx, so the `response` listener is
 * what catches them.
 *
 * `clean` is true when there were no console errors, no uncaught page errors, the
 * main-document navigation did not itself return ≥400 (`navStatus` — the wrong-host /
 * dead-page signal), AND no **application request** failed (`appRequestFailed`). An
 * application request is an `xhr`/`fetch` (the calls a feature depends on); a failure
 * there — HTTP ≥400 or a network-level error — is almost always a real bug (a
 * silently-500ing save), so it fails `clean` explicitly, even when the browser logs no
 * console error for it (the hole the console-only signal leaves).
 *
 * A *decorative* sub-resource (favicon, image, font, stylesheet) failure does NOT trip
 * `appRequestFailed`; whether it fails `clean` is then decided by the browser's own
 * console error — Chromium logs one for a broken content image (so that fails `clean`)
 * but usually suppresses a favicon 404 (so that stays clean). `failedRequests` records
 * every failure regardless of type; assert on it directly when a specific one matters.
 *
 * @param {import('playwright').Page} page
 * @returns live arrays (fill as events fire) + `navStatus` + `clean` getter + `summary()`.
 */
export function capturePageIssues(page) {
    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];
    const failedRequests = [];
    let navStatus = null;
    let appRequestFailed = false;

    // xhr/fetch are the requests a feature depends on; a failure there gates `clean`.
    const isAppRequest = (request) => request.resourceType() === 'xhr' || request.resourceType() === 'fetch';

    page.on('console', (message) => {
        const type = message.type();
        if (type === 'error') {
            consoleErrors.push(message.text());
        } else if (type === 'warning') {
            consoleWarnings.push(message.text());
        }
    });
    page.on('pageerror', (error) => pageErrors.push(error?.message ?? String(error)));
    page.on('response', (response) => {
        const request = response.request();
        const status = response.status();
        if (request.resourceType() === 'document' && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
            navStatus = status;
        }
        if (status >= 400) {
            failedRequests.push(`${request.method()} ${response.url()} — ${status}`);
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

    const isClean = () => consoleErrors.length === 0 && pageErrors.length === 0 && !(navStatus !== null && navStatus >= 400) && !appRequestFailed;

    return {
        consoleErrors,
        consoleWarnings,
        pageErrors,
        failedRequests,
        get navStatus() {
            return navStatus;
        },
        get appRequestFailed() {
            return appRequestFailed;
        },
        get clean() {
            return isClean();
        },
        summary() {
            return {
                clean: isClean(),
                navStatus,
                consoleErrors: [...consoleErrors],
                pageErrors: [...pageErrors],
                failedRequests: [...failedRequests],
                consoleWarnings: [...consoleWarnings],
            };
        },
    };
}

/**
 * Fault injection — a feature is not verified until its FAILURE path was driven.
 * Force every request matching `urlPattern` to the injected status for the duration
 * of `action`, so you can assert the UI surfaces a visible error and leaves the user
 * a way forward (not a silent hang or a false success). The route is cleared
 * afterwards; then assert recovery on a fresh attempt. Inside `action`, trigger the
 * flow and wait on the visible error state (not a one-shot check that races the
 * roundtrip). A full runnable example is in ../references/eye-verify.md and
 * ../scripts/README.md.
 *
 * @param {import('playwright').Page} page
 * @param {string|RegExp} urlPattern       Playwright route glob or RegExp.
 * @param {() => Promise<T>} action         Runs while the fault is active.
 * @param {object} [response]               Injected response shape.
 * @returns {Promise<T>} whatever `action` returns.
 * @template T
 */
export async function withFailedRoute(page, urlPattern, action, { status = 500, contentType = 'application/json', body = '{"message":"Injected failure (eye-verify fault injection)"}' } = {}) {
    // Unroute by handler reference, not just pattern: `page.unroute(urlPattern)`
    // would also drop any route the drive-script already installed on the same
    // pattern, leaving the page in a different routing state than before.
    const handler = (route) => route.fulfill({ status, contentType, body });
    await page.route(urlPattern, handler);
    try {
        return await action();
    } finally {
        await page.unroute(urlPattern, handler);
    }
}

/**
 * Screenshot + DOM dump for a failed run. Used by `createChecker().summarize()`, and
 * callable directly for post-mortem. Best-effort: never throws into the caller.
 *
 * @param {import('playwright').Page} page
 * @param {string} dir
 * @param {string} label
 */
export async function captureFailureArtifacts(page, dir = 'eye-verify-artifacts', label = 'run') {
    const outDir = path.resolve(dir);
    fs.mkdirSync(outDir, { recursive: true });

    // Slugify the label to a filename-safe token: it's often derived from a route /
    // title / case name in a drive-script, so a value like `../debug/x` must not let
    // the artifact escape `outDir`.
    const safeLabel = String(label).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+/, '') || 'run';
    const screenshot = path.join(outDir, `${safeLabel}.png`);
    const dom = path.join(outDir, `${safeLabel}.html`);

    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    const html = await page.content().catch(() => '');
    fs.writeFileSync(dom, html);

    return { screenshot, dom };
}
