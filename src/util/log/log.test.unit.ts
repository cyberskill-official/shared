import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESPONSE_STATUS } from '#constant/index.js';

import { baseCatchError } from './log.util.js';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('baseCatchError', () => {
    const noop = () => {};

    describe('error normalization', () => {
        it('should wrap a string into an Error', () => {
            const result = baseCatchError('something went wrong', { shouldLog: false }, noop);

            expect(result).toEqual({
                success: false,
                message: 'something went wrong',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            });
        });

        it('should use the message from an Error instance', () => {
            const result = baseCatchError(new Error('oops'), { shouldLog: false }, noop);

            expect(result).toEqual({
                success: false,
                message: 'oops',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            });
        });

        it('should default to "Unknown error" for non-string non-Error values', () => {
            const result = baseCatchError(42, { shouldLog: false }, noop);

            expect(result).toEqual({
                success: false,
                message: 'Unknown error',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            });
        });

        it('should default to "Unknown error" for null', () => {
            const result = baseCatchError(null, { shouldLog: false }, noop);

            expect(result).toEqual({
                success: false,
                message: 'Unknown error',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            });
        });
    });

    describe('logging', () => {
        it('should call logError when shouldLog is true', () => {
            const logError = vi.fn();
            baseCatchError(new Error('logged error'), { shouldLog: true }, logError);

            expect(logError).toHaveBeenCalledWith('logged error');
        });

        it('should call logError by default (shouldLog defaults to true)', () => {
            const logError = vi.fn();
            baseCatchError('default log', undefined, logError);

            expect(logError).toHaveBeenCalledWith('default log');
        });

        it('should NOT call logError when shouldLog is false', () => {
            const logError = vi.fn();
            baseCatchError('silent', { shouldLog: false }, logError);

            expect(logError).not.toHaveBeenCalled();
        });
    });

    describe('callback', () => {
        it('should invoke callback with the normalized Error', () => {
            const callback = vi.fn();
            baseCatchError('cb test', { shouldLog: false, callback }, noop);

            expect(callback).toHaveBeenCalledOnce();
            expect(callback).toHaveBeenCalledWith(expect.any(Error));
            expect((callback.mock.calls[0]?.[0] as Error).message).toBe('cb test');
        });

        it('should skip callback when it is not provided', () => {
            // Should not throw
            expect(() => baseCatchError('no cb', { shouldLog: false }, noop)).not.toThrow();
        });
    });

    describe('returnValue', () => {
        it('should return the provided returnValue instead of I_Return', () => {
            const result = baseCatchError<string>(
                'ignored',
                { shouldLog: false, returnValue: 'fallback' },
                noop,
            );

            expect(result).toBe('fallback');
        });

        it('should return I_Return when returnValue is undefined', () => {
            const result = baseCatchError('test', { shouldLog: false }, noop);

            expect(result).toEqual({
                success: false,
                message: 'test',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            });
        });
    });
});
