import type { ChalkInstance } from 'chalk';

import chalk from 'chalk';
import consola from 'consola';
import { GraphQLError } from 'graphql';
import { randomUUID } from 'node:crypto';

import type { I_Return } from '#typescript/index.js';

import { getEnv } from '#config/env/index.js';
import { RESPONSE_STATUS } from '#constant/index.js';
import { baseCatchError } from '#util/log/index.js';

import type { I_CatchErrorOptions, I_IssueEntry, I_Log, I_ThrowError } from './log.type.js';

let _logLevelConfigured = false;

/**
 * Lazily configures the consola log level based on the DEBUG environment variable.
 * Only runs once on first invocation to avoid repeated env loading.
 */
function ensureLogLevel() {
    if (!_logLevelConfigured) {
        _logLevelConfigured = true;
        const env = getEnv();

        if (!env.DEBUG) {
            consola.level = 4;
        }
    }
}

/**
 * Throws a standardized error with optional status information and type specification.
 * This function creates and throws errors that can be either GraphQL errors (with extensions)
 * or standard JavaScript errors, depending on the specified type.
 *
 * @param options - Error configuration including message, status information, and error type.
 * @param options.message - The error message to display.
 * @param options.status - The response status information (defaults to INTERNAL_SERVER_ERROR).
 * @param options.type - The type of error to throw ('graphql' or 'rest', defaults to 'graphql').
 * @throws {GraphQLError} When type is 'graphql', throws a GraphQL error with extensions.
 * @throws {Error} When type is 'rest' or unspecified, throws a standard JavaScript error.
 */
export function throwError({
    message,
    status = RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
    type = 'graphql',
}: I_ThrowError): never {
    const responseMessage
        = message ?? status.MESSAGE ?? 'Internal server error';

    if (type === 'graphql') {
        throw new GraphQLError(responseMessage, {
            extensions: { code: status.CODE },
        });
    }

    throw new Error(responseMessage);
}

/**
 * Gets a chalk color instance by keyword name.
 * This function safely retrieves a chalk color function by name, falling back to green
 * if the specified color is not available or invalid.
 *
 * @param color - The color keyword to get the chalk instance for.
 * @returns A chalk instance for the specified color, or green as fallback.
 */
function chalkKeyword(color: string): ChalkInstance {
    const chalkColor = chalk[color as keyof typeof chalk];

    return typeof chalkColor === 'function' ? (chalkColor as ChalkInstance) : chalk.green;
}

/**
 * Enhanced logging interface that extends consola with custom functionality.
 * This object provides all standard consola logging methods plus additional features
 * like boxed log printing for structured error/warning display.
 */
export const log: I_Log = {
    silent: consola.silent,
    level: consola.level,
    fatal: consola.fatal,
    error: consola.error,
    warn: consola.warn,
    log: consola.log,
    info: consola.info,
    success: consola.success,
    ready: consola.ready,
    start: consola.start,
    box: consola.box,
    debug: consola.debug,
    trace: consola.trace,
    verbose: consola.verbose,
    /**
     * Prints a boxed log with structured issue information.
     * This method displays issues (errors or warnings) in a formatted box with:
     * - File paths and line/column positions
     * - Rule violations (if applicable)
     * - Error/warning messages
     * - Color-coded output based on issue type
     *
     * @param title - The title to display in the box header.
     * @param issues - An array of issue entries to display.
     * @param color - The color to use for highlighting (defaults to 'red').
     */
    printBoxedLog(title: string, issues: I_IssueEntry[], color = 'red') {
        if (!issues?.length) {
            consola.box(chalk.green(title));
            return;
        }

        issues.forEach(({ file, position, rule, message }) => {
            const positionSuffix = position ? `:${position}` : '';
            const filePath = `${file}${positionSuffix}`;
            consola.log(`${chalk.gray('File:')} ${chalk.blue(filePath)}`);

            if (rule) {
                consola.log(`   ${chalkKeyword(color)('Rule:')} ${rule}`);
            }

            consola.log(`   ${chalkKeyword(color)('Message:')} ${message}`);
        });

        consola.box(chalkKeyword(color)(`${title} : ${issues.length}`));

        consola.log(chalk.gray('─'.repeat(40)));
    },
    /**
     * Creates a context-aware logger that prefixes all messages with a correlation ID.
     * Useful for distributed tracing across CyberSkill services.
     *
     * @param correlationId - A UUID correlation ID. If not provided, a new UUID is generated.
     * @returns A logger object with all standard methods that prefix output with the correlation ID.
     */
    withContext(correlationId?: string) {
        const id = correlationId ?? randomUUID();
        const prefix = chalk.gray(`[${id}]`);

        const withPrefix = (fn: (...args: unknown[]) => void) => {
            return (...args: unknown[]) => fn(prefix, ...args);
        };

        return {
            correlationId: id,
            fatal: withPrefix(consola.fatal),
            error: withPrefix(consola.error),
            warn: withPrefix(consola.warn),
            log: withPrefix(consola.log),
            info: withPrefix(consola.info),
            success: withPrefix(consola.success),
            debug: withPrefix(consola.debug),
        };
    },
};

/**
 * Catches and handles errors with configurable behavior.
 * Delegates to the shared `baseCatchError` implementation, adding Node-specific
 * log-level configuration via `ensureLogLevel()` before logging.
 *
 * @param errorInput - The error to catch and handle.
 * @param options - Configuration options for error handling behavior.
 * @returns Either the specified return value or a standardized error response object.
 */
export function catchError<T = unknown>(errorInput: unknown, options: I_CatchErrorOptions & { returnValue: T }): T;
export function catchError<T = unknown>(errorInput: unknown, options?: I_CatchErrorOptions): I_Return<T>;
export function catchError<T = unknown>(errorInput: unknown, options?: I_CatchErrorOptions): I_Return<T> | T {
    return baseCatchError<T>(errorInput, options, (message) => {
        ensureLogLevel();
        log.error(message);
    });
}
