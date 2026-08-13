import process from 'node:process';

import type { I_IssueEntry } from '../log/index.js';

import { clearAllErrorLists, getStoredErrorLists, runCommand } from '../command/index.js';
import { pathExistsSync } from '../fs/index.js';
import { catchError, E_IssueType, log } from '../log/index.js';
import { E_PackageType, setupPackages } from '../package/index.js';
import { command, ESLINT_PACKAGE_NAME, PATH, TSC_PACKAGE_NAME } from '../path/index.js';

/**
 * Resolves/installs lint tool dependencies once before typecheck and ESLint runs.
 * Avoids concurrent setupPackages writes that can blank versions in package.json.
 */
export async function ensureLintToolPackages() {
    await setupPackages(
        [
            {
                name: TSC_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
            {
                name: ESLINT_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        { install: true },
    );
}

/**
 * Performs TypeScript validation if a TypeScript configuration file exists.
 * Uses `--incremental` mode to cache results — the first run may be slow
 * (especially with large generated files), but subsequent runs are near-instant.
 *
 * @returns A promise that resolves when the TypeScript validation is complete.
 */
export async function checkTypescript() {
    if (!pathExistsSync(PATH.TS_CONFIG)) {
        log.warn('No TypeScript configuration found. Skipping type check.');
        return;
    }

    await runCommand('Performing TypeScript validation', await command.typescriptCheck({ setup: false }));
}

/**
 * Performs ESLint checking with optional auto-fix functionality.
 * This function runs ESLint checks on the codebase and optionally applies
 * automatic fixes to resolve linting issues.
 *
 * @param fix - Whether to apply automatic fixes to linting issues (default: false).
 * @returns A promise that resolves when the ESLint check is complete.
 */
export async function checkEslint(fix = false) {
    const commandToRun = fix
        ? await command.eslintFix({ setup: false })
        : await command.eslintCheck({ setup: false });
    const label = fix ? 'Running ESLint with auto-fix' : 'Running ESLint check';

    try {
        await runCommand(label, commandToRun, { timeout: 60000, throwOnError: true });
    }
    catch (error: unknown) {
        const errObj = error as { code?: string; killed?: boolean; signal?: string };
        if (errObj.code === 'ETIMEDOUT' || errObj.killed || errObj.signal === 'SIGTERM') {
            log.warn('Lint check timed out. Retrying with debug mode enabled...');
            process.env['DEBUG'] = 'true';
            await runCommand(`${label} (Debug Mode)`, commandToRun);
        }
        else {
            catchError(error);
        }
    }
}

/**
 * Prints a formatted list of issues (errors or warnings) to the console.
 *
 * @param type - The type of issues to display ('Errors' or 'Warnings').
 * @param list - An array of issue entries to display.
 */
function printIssues(type: 'Errors' | 'Warnings', list: I_IssueEntry[]) {
    if (!list.length) {
        return;
    }

    const color = type === 'Errors' ? 'red' : 'yellow';
    log.printBoxedLog(type === 'Errors' ? '✖ Errors' : '⚠ Warnings', list, color);
}

/**
 * Displays the final check results after all validation processes.
 *
 * @returns A promise that resolves when the results are displayed.
 */
export async function showCheckResult() {
    // Allow pending I/O (runCommand writes) to flush before reading results
    await new Promise(resolve => setImmediate(resolve));

    const allResults = (await getStoredErrorLists()) || [];
    const errors = allResults.filter(e => e.type === E_IssueType.Error);
    const warnings = allResults.filter(e => e.type === E_IssueType.Warning);

    if (!errors.length && !warnings.length) {
        log.printBoxedLog('✔ NO ISSUES FOUND', [], 'green');
    }
    else {
        printIssues('Warnings', warnings);
        printIssues('Errors', errors);

        if (errors.length > 0) {
            process.exit(1);
        }
    }
}

/**
 * Performs comprehensive linting checks including TypeScript and ESLint.
 * Installs lint tool dependencies once, then runs TypeScript validation and
 * ESLint sequentially to avoid diagnostic-storage races.
 *
 * @returns A promise that resolves when all linting checks are complete.
 */
export async function lintCheck() {
    await clearAllErrorLists();
    await ensureLintToolPackages();
    await checkTypescript();
    await checkEslint();
    await showCheckResult();
}

/**
 * Performs comprehensive linting checks with automatic fixes.
 * Installs lint tool dependencies once, then runs ESLint with auto-fix before
 * TypeScript validation so typecheck sees the fixed final files.
 *
 * @returns A promise that resolves when all linting checks with fixes are complete.
 */
export async function lintFix() {
    await clearAllErrorLists();
    await ensureLintToolPackages();
    await checkEslint(true);
    await checkTypescript();
    await showCheckResult();
}
