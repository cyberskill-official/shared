import { afterEach, describe, expect, it, vi } from 'vitest';

import { RESPONSE_STATUS } from '#constant/index.js';

import { catchError, log } from './log.util.js';

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// log object
// ---------------------------------------------------------------------------
describe('log', () => {
    it('should expose standard logging methods', () => {
        expect(typeof log.error).toBe('function');
        expect(typeof log.warn).toBe('function');
        expect(typeof log.info).toBe('function');
        expect(typeof log.debug).toBe('function');
        expect(typeof log.success).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// catchError
// ---------------------------------------------------------------------------
describe('catchError', () => {
    it('should return error response for Error input', () => {
        vi.spyOn(log, 'error').mockImplementation(() => { });
        const result = catchError(new Error('Test error'));
        expect(result).toEqual({
            success: false,
            message: 'Test error',
            code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
        });
    });

    it('should wrap string input in Error', () => {
        vi.spyOn(log, 'error').mockImplementation(() => { });
        const result = catchError('string error');
        expect(result).toEqual({
            success: false,
            message: 'string error',
            code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
        });
    });

    it('should handle unknown error type', () => {
        vi.spyOn(log, 'error').mockImplementation(() => { });
        const result = catchError(42);
        expect(result).toEqual({
            success: false,
            message: 'Unknown error',
            code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
        });
    });

    it('should return the returnValue when provided', () => {
        vi.spyOn(log, 'error').mockImplementation(() => { });
        const result = catchError(new Error('err'), { returnValue: 'fallback' });
        expect(result).toBe('fallback');
    });

    it('should invoke callback when provided', () => {
        vi.spyOn(log, 'error').mockImplementation(() => { });
        const callback = vi.fn();
        catchError(new Error('err'), { callback });
        expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should suppress logging when shouldLog is false', () => {
        const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => { });
        catchError(new Error('silent'), { shouldLog: false });
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should log by default', () => {
        const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => { });
        catchError(new Error('loud'));
        expect(errorSpy).toHaveBeenCalled();
    });
});
