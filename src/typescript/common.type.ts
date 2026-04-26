import type consola from 'consola';

/**
 * Generic object type with string keys and values of type T (defaults to unknown).
 */
export type T_Object<T = unknown> = Record<string, T>;

/**
 * Logging interface for browser and Node.js environments, compatible with consola.
 */
export interface I_Log {
    silent: typeof consola['silent'];
    level: typeof consola['level'];
    fatal: typeof consola['fatal'];
    error: typeof consola['error'];
    warn: typeof consola['warn'];
    log: typeof consola['log'];
    info: typeof consola['info'];
    success: typeof consola['success'];
    ready: typeof consola['ready'];
    start: typeof consola['start'];
    box: typeof consola['box'];
    debug: typeof consola['debug'];
    trace: typeof consola['trace'];
    verbose: typeof consola['verbose'];
}

/**
 * Base interface for return types with common properties.
 */
export interface I_ReturnBase {
    success: boolean;
    message?: string;
    code?: number | string;
}

/**
 * Success return type with result data.
 * @template T - The main result type
 * @template E - Additional properties to merge with the result (defaults to unknown)
 */
export interface I_ReturnSuccess<T, E = unknown> extends I_ReturnBase {
    success: true;
    result: T & E;
    /** True when results were limited by a default cap and may not include all matching documents. */
    truncated?: boolean;
}

/**
 * Failure return type with error information.
 */
export interface I_ReturnFailure extends I_ReturnBase {
    success: false;
    message: string;
    code: number | string;
}

/**
 * Discriminated union type for function return values.
 * Provides type-safe handling of success and failure cases.
 *
 * @template T - The success result type (defaults to void)
 * @template E - Additional properties to merge with the result (defaults to unknown)
 *
 * @example
 * ```typescript
 * function fetchUser(id: string): I_Return<User> {
 *   try {
 *     const user = await getUser(id);
 *     return { success: true, result: user };
 *   } catch (error) {
 *     return { success: false, message: error.message, code: 'USER_NOT_FOUND' };
 *   }
 * }
 * ```
 */
export type I_Return<T = void, E = unknown> = I_ReturnSuccess<T, E> | I_ReturnFailure;

/**
 * Type guard that narrows an `I_Return` to `I_ReturnSuccess`.
 *
 * @param result - The result to check.
 * @returns True if the result is a success.
 */
export function isSuccess<T, E = unknown>(result: I_Return<T, E>): result is I_ReturnSuccess<T, E> {
    return result.success;
}

/**
 * Unwraps a successful `I_Return`, throwing an error for failure cases.
 * Useful when a failure is unexpected and should abort execution.
 *
 * @param result - The result to unwrap.
 * @returns The success result value.
 * @throws {Error} When the result is a failure.
 */
export function unwrapResult<T, E = unknown>(result: I_Return<T, E>): T & E {
    if (!result.success) {
        throw new Error(result.message);
    }

    return result.result;
}

/**
 * Alias for `unwrapResult` to improve discoverability.
 */
export const unwrapOrThrow = unwrapResult;

export enum E_Environment {
    PRODUCTION = 'production',
    STAGING = 'staging',
    DEVELOPMENT = 'development',
}
