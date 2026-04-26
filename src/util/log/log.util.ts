import type { I_Return } from '#typescript/index.js';

import { RESPONSE_STATUS } from '#constant/index.js';

import type { I_CatchErrorOptions } from './log.type.js';

/**
 * Core error-catching implementation shared between Node and React environments.
 * Normalizes the error input, optionally logs via the provided logger, invokes
 * an optional callback, and returns either the caller-supplied fallback value or
 * a standardized `I_Return` failure object.
 *
 * @param errorInput - The thrown value to handle.
 * @param options - Behavior options (shouldLog, returnValue, callback).
 * @param logError - Environment-specific function used to log the error message.
 * @returns The fallback value `T` when `returnValue` is provided, otherwise `I_Return<T>`.
 */
export function baseCatchError<T = unknown>(
    errorInput: unknown,
    options: I_CatchErrorOptions & { returnValue: T },
    logError: (message: string) => void,
): T;
export function baseCatchError<T = unknown>(
    errorInput: unknown,
    options: I_CatchErrorOptions | undefined,
    logError: (message: string) => void,
): I_Return<T>;
export function baseCatchError<T = unknown>(
    errorInput: unknown,
    options: I_CatchErrorOptions | undefined,
    logError: (message: string) => void,
): I_Return<T> | T {
    const { shouldLog = true, returnValue, callback } = options ?? {};

    const error = errorInput instanceof Error
        ? errorInput
        : new Error(typeof errorInput === 'string' ? errorInput : 'Unknown error');

    if (shouldLog) {
        logError(error.message);
    }

    if (callback && typeof callback === 'function') {
        callback(error);
    }

    if (returnValue !== undefined) {
        return returnValue as T;
    }

    return {
        success: false,
        message: error.message,
        code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
    };
}
