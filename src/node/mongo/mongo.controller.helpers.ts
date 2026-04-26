import type { I_Return } from '#typescript/index.js';

import { RESPONSE_STATUS } from '#constant/index.js';

/**
 * Shared helper functions for MongoDB controllers.
 *
 * These helpers standardize response formatting and error patterns
 * across both the Mongoose and native MongoDB controllers, reducing
 * code duplication and ensuring consistency.
 */

/**
 * Creates a standardized success response wrapper.
 *
 * @param result - The operation result to wrap.
 * @returns A standardized success response.
 */
export function wrapSuccess<T>(result: T): I_Return<T> {
    return {
        success: true,
        result,
    };
}

/**
 * Creates a standardized success response with a "truncated" flag.
 *
 * @param result - The operation result to wrap.
 * @returns A standardized success response with truncated: true.
 */
export function wrapTruncated<T>(result: T): I_Return<T> {
    return {
        success: true,
        result,
        truncated: true,
    };
}

/**
 * Creates a standardized "not found" failure response.
 *
 * @param modelName - The model/collection name for the error message.
 * @returns A standardized not-found failure response.
 */
export function wrapNotFound<T>(modelName: string): I_Return<T> {
    return {
        success: false,
        message: `${modelName} not found`,
        code: RESPONSE_STATUS.NOT_FOUND.CODE,
    };
}

/**
 * Creates a standardized internal error failure response.
 *
 * @param message - The error message.
 * @returns A standardized internal error failure response.
 */
export function wrapError<T>(message: string): I_Return<T> {
    return {
        success: false,
        message,
        code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
    };
}

/**
 * Creates a standardized "bad request" failure response.
 *
 * @param message - The error message.
 * @returns A standardized bad request failure response.
 */
export function wrapBadRequest<T>(message: string): I_Return<T> {
    return {
        success: false,
        message,
        code: RESPONSE_STATUS.BAD_REQUEST.CODE,
    };
}
