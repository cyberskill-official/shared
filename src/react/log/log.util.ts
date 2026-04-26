import { consola } from 'consola/browser';

import type { I_Log, I_Return } from '#typescript/index.js';

import { RESPONSE_STATUS } from '#constant/index.js';
import { baseCatchError } from '#util/log/index.js';

import type { I_CatchErrorOptions } from './log.type.js';

/**
 * Browser-compatible logging interface using consola.
 * This object provides all standard consola logging methods for use in browser environments,
 * including error, warning, info, success, and debug logging capabilities.
 *
 * @remarks
 * This module imports from `consola/browser` (not `consola`) to ensure no Node.js-specific
 * code is included in client bundles. The `I_Log` type from `#typescript` is a type-only
 * import and is erased at build time.
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
};

/**
 * Catches and handles errors with configurable behavior for React applications.
 * Delegates to the shared `baseCatchError` implementation, using the browser
 * consola instance for logging.
 *
 * @param errorInput - The error to catch and handle, can be Error object, string, or unknown type.
 * @param options - Configuration options for error handling behavior.
 * @returns Either the specified return value or a standardized error response object.
 */
export function catchError<T = unknown>(errorInput: unknown, options: I_CatchErrorOptions & { returnValue: T }): T;
export function catchError<T = unknown>(errorInput: unknown, options?: I_CatchErrorOptions): I_Return<T>;
export function catchError<T = unknown>(errorInput: unknown, options?: I_CatchErrorOptions): I_Return<T> | T {
    return baseCatchError<T>(errorInput, options, message => log.error(message));
}

/**
 * Throws a standardized error with a message and optional HTTP status code.
 * Provides a consistent way to throw errors across React and Node environments.
 *
 * @param message - The error message.
 * @param code - Optional HTTP status code (defaults to 500).
 */
export function throwError(message: string, code?: number): never {
    const error = new Error(message);
    (error as Error & { code?: number }).code = code ?? RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE;
    throw error;
}
