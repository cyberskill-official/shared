import { exec, execFile } from 'node:child_process';
import process from 'node:process';
import * as util from 'node:util';

import { getEnv } from '#config/env/index.js';

import type { I_IssueEntry } from '../log/index.js';
import type { I_CommandContext, I_EslintError, T_Command, T_CommandMapInput } from './command.type.js';

import { catchError, E_IssueType, log } from '../log/index.js';
import { getPackage } from '../package/index.js';
import { CYBERSKILL_CLI, CYBERSKILL_CLI_PATH, CYBERSKILL_PACKAGE_NAME, PNPM_EXEC_CLI, TSX_CLI } from '../path/index.js';
import { storage } from '../storage/index.js';

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);
const SHELL_METACHARACTERS = /[|&;<>`$(){}[\]!#~*?]/;
const RE_ESLINT_ERROR = /^\s*(\d+):(\d+)\s+(error|warning)\s+(\S+(?:\s+\S+)*)\s+(\S+)$/;
const RE_TS_ERROR = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(\S.+)$/;
const RE_COMMITLINT_ERROR = /^✖\s+(\S+(?:\s+\S+)*)\s+\[([^\]]*)\]$/;
const RE_WHITESPACE = /\s+/;
// eslint-disable-next-line no-control-regex -- Intentional: detect ASCII control chars to prevent command injection
const RE_CONTROL_CHARS = /[\x00-\x1F\x7F]/;

/**
 * Retrieves the package name for the current project.
 * This function attempts to get the package name from the current project's package.json.
 * If the package information cannot be retrieved, it returns a timestamp as a fallback.
 * Results are cached after first successful read to avoid redundant I/O.
 *
 * @returns A promise that resolves to the package name or a timestamp string.
 */
let _cachedPackageName: string | null = null;
/** Returns the cached package name, falling back to a timestamp if unavailable. */
async function getPackageName() {
    if (_cachedPackageName) {
        return _cachedPackageName;
    }

    const pkg = await getPackage();

    if (!pkg.success) {
        return Date.now().toString();
    }

    _cachedPackageName = pkg.result.name;
    return _cachedPackageName;
}

/**
 * Resets the cached package name. For testing only.
 * Call this to force `getPackageName()` to re-read the package.json on the next invocation.
 */
export function resetCommandCacheForTesting(): void {
    _cachedPackageName = null;
}

/**
 * Saves a list of error entries to persistent storage.
 * This function stores error information with the package name as the key,
 * and provides a log link for manual inspection of the stored errors.
 *
 * @param errorList - An array of error entries to be stored.
 * @returns A promise that resolves when the storage operation is complete.
 */
async function saveErrorListToStorage(errorList: I_IssueEntry[]): Promise<void> {
    if (errorList.length === 0) {
        return;
    }

    const packageName = await getPackageName();

    try {
        const existingErrors = await getStoredErrorLists();
        const mergedErrors = [...existingErrors, ...errorList];

        await storage.set(packageName, mergedErrors);

        const logPath = await storage.getLogLink(packageName);
        if (logPath) {
            log.info(`📂 Open the error list manually: ${logPath}`);
        }
    }
    catch (error: unknown) {
        catchError(error);
    }
}

/**
 * Retrieves all stored error lists from persistent storage.
 * This function fetches error entries that were previously saved using the package name as the key.
 *
 * @returns A promise that resolves to an array of error entries, or an empty array if none are found.
 */
export async function getStoredErrorLists(): Promise<I_IssueEntry[]> {
    try {
        const packageName = await getPackageName();
        const allErrors = await storage.get<I_IssueEntry[]>(packageName);

        return allErrors ?? [];
    }
    catch (error: unknown) {
        return catchError<I_IssueEntry[]>(error, {
            returnValue: [],
        });
    }
}

/**
 * Clears all stored error lists from persistent storage.
 * This function removes all error entries associated with the current package name.
 *
 * @returns A promise that resolves when the clearing operation is complete.
 */
export async function clearAllErrorLists(): Promise<void> {
    try {
        const packageName = await getPackageName();
        await storage.remove(packageName);
    }
    catch (error: unknown) {
        catchError(error);
    }
}

/**
 * Parses text-based error output and converts it to structured error entries.
 * This function processes command output that contains error information in text format,
 * extracting file paths, line numbers, error types, messages, and rule violations.
 * It handles multiple error formats including ESLint, TypeScript, and commitlint errors.
 *
 * @param output - The raw text output from a command execution containing error information.
 */
async function parseTextErrors(output: string): Promise<void> {
    const errorList: I_IssueEntry[] = [];
    const unmatchedLines: string[] = [];
    let lastFilePath = '';
    const eslintErrorDetailsRegex = RE_ESLINT_ERROR;
    const tsRegex = RE_TS_ERROR;
    const commitlintRegex = RE_COMMITLINT_ERROR;

    output.split('\n').forEach((line) => {
        const tsMatch = tsRegex.exec(line);

        if (tsMatch) {
            errorList.push({
                file: tsMatch?.[1] ?? '',
                position: `${tsMatch[2]}:${tsMatch[3]}`,
                type: tsMatch[4] === E_IssueType.Error ? E_IssueType.Error : E_IssueType.Warning,
                message: tsMatch?.[5]?.trim() ?? '',
            });
        }
        else if (line.startsWith('/')) {
            lastFilePath = line.trim();
        }
        else {
            const eslintMatch = eslintErrorDetailsRegex.exec(line);

            if (eslintMatch && lastFilePath) {
                errorList.push({
                    file: lastFilePath,
                    position: `${eslintMatch[1]}:${eslintMatch[2]}`,
                    type: eslintMatch[3] === E_IssueType.Error ? E_IssueType.Error : E_IssueType.Warning,
                    message: eslintMatch?.[4]?.trim() ?? '',
                    rule: eslintMatch?.[5]?.trim() ?? '',
                });
            }
            else {
                const commitlintMatch = commitlintRegex.exec(line);

                if (commitlintMatch) {
                    errorList.push({
                        file: 'commitlint',
                        type: E_IssueType.Error,
                        message: commitlintMatch?.[1]?.trim() ?? '',
                        rule: commitlintMatch?.[2]?.trim() ?? '',
                    });
                }
                else {
                    unmatchedLines.push(line.trim());
                }
            }
        }
    });

    if (errorList.length) {
        await saveErrorListToStorage(errorList);
    }

    if (unmatchedLines.length) {
        log.warn(`Unmatched lines:`);
        unmatchedLines.forEach(line => log.info(`  ${line}`));
    }
}

/**
 * Parses command output that contains structured error information.
 * This function attempts to parse JSON-formatted error output (typically from ESLint)
 * and converts it to structured error entries. If JSON parsing fails, it falls back
 * to text-based parsing.
 *
 * @param output - The command output to parse, expected to be JSON-formatted error data.
 */
async function parseCommandOutput(output: string): Promise<void> {
    try {
        const results: I_EslintError[] = JSON.parse(output);
        const errorList: I_IssueEntry[] = [];

        results.forEach(({ filePath, messages }) => {
            messages.forEach(({ severity, line, column, ruleId, message }) => {
                errorList.push({
                    type: severity === 2 ? E_IssueType.Error : E_IssueType.Warning,
                    file: filePath,
                    position: `${line}:${column}`,
                    rule: ruleId,
                    message,
                });
            });
        });

        if (errorList.length) {
            await saveErrorListToStorage(errorList);
        }
    }
    catch {
        await parseTextErrors(output);
    }
}

/**
 * Executes a command and processes its output for errors.
 * This function runs a command with proper signal handling for graceful termination,
 * processes both stdout and stderr for error information, and handles command failures.
 *
 * @param command - The command string to execute, or undefined if no command should be run.
 * @param parser - The function to use for parsing command output (defaults to parseCommandOutput).
 * @returns A promise that resolves when the command execution is complete.
 */
async function executeCommand(command: string | void, parser = parseCommandOutput, options: { timeout?: number } = {}): Promise<void> {
    const controller = new AbortController();

    const onSigint = () => {
        log.warn('Process interrupted. Terminating...');
        controller.abort();
        process.exit(130);
    };

    process.once('SIGINT', onSigint);

    try {
        if (typeof command === 'string') {
            const execOptions = {
                maxBuffer: 10 * 1024 * 1024,
                signal: controller.signal,
                timeout: options.timeout,
            };

            let result: { stdout: string; stderr: string };

            if (SHELL_METACHARACTERS.test(command)) {
                result = await execPromise(command, execOptions);
            }
            else {
                const parts = command.split(RE_WHITESPACE).filter(Boolean);
                const isWin = process.platform === 'win32';
                result = await execFilePromise(parts[0]!, parts.slice(1), { ...execOptions, shell: isWin });
            }

            await Promise.all([result.stdout, result.stderr].map(output => output && parser(output)));
        }
    }
    catch (error: unknown) {
        const { stdout, stderr, message } = error as {
            stdout?: string;
            stderr?: string;
            message: string;
        };

        await Promise.all([stdout, stderr].map(output => output && parser(output)));

        if (!stderr && !stdout) {
            log.error(`Command failed: ${message}`);
        }

        throw error;
    }
    finally {
        process.removeListener('SIGINT', onSigint);
    }
}

/**
 * Creates a raw command object that bypasses CLI formatting.
 * This function wraps a command string in an object that indicates it should be executed
 * as-is without any additional CLI formatting or path resolution.
 *
 * @internal
 * to execute user-provided strings — use the CLI formatting pipeline instead.
 *
 * @security All ASCII control characters (0x00–0x1F, 0x7F) are rejected to prevent
 * command injection via newline splitting, null-byte truncation, or escape-sequence
 * confusion (CWE-78).
 *
 * @param cmd - The raw command string to be executed directly.
 * @returns An object containing the raw command with a flag indicating it should not be formatted.
 */
export function rawCommand(cmd: string) {
    if (RE_CONTROL_CHARS.test(cmd)) {
        throw new Error('rawCommand: Command must not contain control characters (potential command injection).');
    }
    return { raw: true, cmd };
}

/**
 * Formats a command for CLI execution based on the current project context.
 * This function determines whether to use the current project's CLI path or the global CLI,
 * and formats the command accordingly with the appropriate executable paths.
 *
 * @param command - The command string to format.
 * @param context - Optional context information about the current project.
 * @returns The formatted command string ready for execution.
 */
function formatCLI(command: string, context?: I_CommandContext) {
    if (context?.isCurrentProject) {
        return `${PNPM_EXEC_CLI} ${TSX_CLI} ${CYBERSKILL_CLI_PATH} ${command}`;
    }

    return `${PNPM_EXEC_CLI} ${CYBERSKILL_CLI} ${command}`;
}

/**
 * Formats a command based on its type and context.
 * This function handles different command types:
 * - Function commands: Executes the function with context and formats the result
 * - Raw commands: Returns the command as-is without formatting
 * - String commands: Formats them as CLI commands
 *
 * @param command - The command to format, which can be a string, function, or raw command object.
 * @param context - Optional context information for command execution.
 * @returns The formatted command string ready for execution.
 */
export function formatCommand(command: T_Command, context?: I_CommandContext) {
    if (typeof command === 'function') {
        return formatCLI(command(context), context);
    }

    if (typeof command === 'object' && command?.raw === true) {
        return command.cmd;
    }

    if (typeof command === 'string') {
        return formatCLI(command, context);
    }

    return command;
}

/**
 * Resolves a map of commands by formatting them based on the current project context.
 * This function takes a command map (either static or dynamic) and formats all commands
 * using the appropriate CLI paths based on whether the current project is the Cyberskill package.
 *
 * @param input - The command map to resolve, which can be static or a function that returns a map.
 * @returns A promise that resolves to an object with formatted command strings, or undefined if package info cannot be retrieved.
 */
export async function resolveCommands(input: T_CommandMapInput) {
    const packageData = await getPackage({ name: CYBERSKILL_PACKAGE_NAME });

    if (packageData.success) {
        const ctx: I_CommandContext = { isCurrentProject: packageData.result.isCurrentProject };
        const commands = typeof input === 'function' ? input(ctx) : input;

        return Object.fromEntries(
            Object.entries(commands).map(([key, cmd]) => [key, formatCommand(cmd, ctx)]),
        );
    }
}

/**
 * Executes a command with proper logging and error handling.
 * This function provides a standardized way to run commands with:
 * - Progress logging with start and success messages
 * - Debug logging of the actual command when DEBUG mode is enabled
 * - Error handling and reporting
 *
 * @param label - A human-readable label describing what the command does.
 * @param command - The command string to execute, or undefined if no command should be run.
 * @returns A promise that resolves when the command execution is complete.
 */
export async function runCommand(label: string, command: string | void, options: { timeout?: number; throwOnError?: boolean } = {}) {
    let timer: NodeJS.Timeout | undefined;

    try {
        const startTime = Date.now();
        log.start(`${label}`);

        if (getEnv().DEBUG) {
            log.info(`→ ${command}`);
        }
        else {
            timer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);

                if (elapsed > 0) {
                    process.stdout.write(`\r⏳ ${label}... ${elapsed}s`);
                }
            }, 1000);
        }

        await executeCommand(command, parseCommandOutput, options);

        log.success(`${label} done.`);
    }
    catch (error: unknown) {
        if (options.throwOnError) {
            throw error;
        }
        catchError(error);
    }
    finally {
        if (timer) {
            clearInterval(timer);
            process.stdout.write(`\r\x1B[K`);
        }
    }
}
