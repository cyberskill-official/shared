import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESPONSE_STATUS } from '#constant/index.js';

import { E_IssueType } from './log.type.js';
import { catchError, log, throwError } from './log.util.js';

const RE_UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

vi.mock('#config/env/index.js', () => ({
    getEnv: () => ({ DEBUG: true }),
}));

beforeEach(() => {
    vi.spyOn(log, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('throwError', () => {
    it('should throw GraphQLError by default', () => {
        expect(() => throwError({ message: 'fail' })).toThrow('fail');
    });

    it('should throw GraphQLError with status extension', () => {
        try {
            throwError({
                message: 'not found',
                status: RESPONSE_STATUS.NOT_FOUND,
                type: 'graphql',
            });
        }
        catch (error: any) {
            expect(error.extensions?.code).toBe(404);
        }
    });

    it('should throw standard Error for rest type', () => {
        expect(() => throwError({ message: 'rest fail', type: 'rest' })).toThrow('rest fail');
    });

    it('should use status MESSAGE as fallback when message is undefined', () => {
        expect(() =>
            throwError({
                status: RESPONSE_STATUS.BAD_REQUEST,
                type: 'rest',
            }),
        ).toThrow('Bad Request');
    });

    it('should use empty MESSAGE as error when no message is provided', () => {
        expect(() =>
            throwError({
                status: { CODE: 'CUSTOM', MESSAGE: '' } as any,
                type: 'rest',
            }),
        ).toThrow('');
    });
});

describe('catchError', () => {
    it('should return error response with success=false by default', () => {
        const result = catchError(new Error('test error'), { shouldLog: false });
        expect(result).toEqual({
            success: false,
            message: 'test error',
            code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
        });
    });

    it('should return specified returnValue when provided', () => {
        const result = catchError(new Error('test'), {
            shouldLog: false,
            returnValue: 'custom-value',
        });
        expect(result).toBe('custom-value');
    });

    it('should return 0 when returnValue is 0', () => {
        const result = catchError(new Error('test'), { shouldLog: false, returnValue: 0 });
        expect(result).toBe(0);
    });

    it('should return empty string when returnValue is ""', () => {
        const result = catchError(new Error('test'), { shouldLog: false, returnValue: '' });
        expect(result).toBe('');
    });

    it('should return false when returnValue is false', () => {
        const result = catchError(new Error('test'), { shouldLog: false, returnValue: false });
        expect(result).toBe(false);
    });

    it('should handle string error input', () => {
        const result = catchError('string error', { shouldLog: false });
        expect(result).toEqual(expect.objectContaining({
            success: false,
            message: 'string error',
        }));
    });

    it('should handle non-string non-Error input', () => {
        const result = catchError(42, { shouldLog: false });
        expect(result).toEqual(expect.objectContaining({
            success: false,
            message: 'Unknown error',
        }));
    });

    it('should call callback when provided', () => {
        const callback = vi.fn();
        catchError(new Error('cb test'), { shouldLog: false, callback });
        expect(callback).toHaveBeenCalledWith(expect.any(Error));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should log error when shouldLog is true (default)', () => {
        catchError(new Error('logged error'));
        expect(log.error).toHaveBeenCalled();
    });

    it('should handle undefined options', () => {
        const result = catchError(new Error('no options'));
        expect(result).toEqual(expect.objectContaining({ success: false }));
    });
});

describe('log.withContext', () => {
    it('should return a logger with all standard methods', () => {
        const ctxLog = log.withContext();
        expect(ctxLog).toHaveProperty('correlationId');
        expect(typeof ctxLog.fatal).toBe('function');
        expect(typeof ctxLog.error).toBe('function');
        expect(typeof ctxLog.warn).toBe('function');
        expect(typeof ctxLog.log).toBe('function');
        expect(typeof ctxLog.info).toBe('function');
        expect(typeof ctxLog.success).toBe('function');
        expect(typeof ctxLog.debug).toBe('function');
    });

    it('should use provided correlation ID', () => {
        const ctxLog = log.withContext('my-custom-id');
        expect(ctxLog.correlationId).toBe('my-custom-id');
    });

    it('should generate a UUID when no correlation ID provided', () => {
        const ctxLog = log.withContext();
        expect(ctxLog.correlationId).toMatch(RE_UUID);
    });

    it('should generate unique IDs for each call', () => {
        const a = log.withContext();
        const b = log.withContext();
        expect(a.correlationId).not.toBe(b.correlationId);
    });
});

describe('log object', () => {
    it('should expose all standard consola methods', () => {
        expect(typeof log.info).toBe('function');
        expect(typeof log.error).toBe('function');
        expect(typeof log.warn).toBe('function');
        expect(typeof log.success).toBe('function');
        expect(typeof log.start).toBe('function');
        expect(typeof log.box).toBe('function');
        expect(typeof log.debug).toBe('function');
        expect(typeof log.fatal).toBe('function');
    });

    it('should have printBoxedLog method', () => {
        expect(typeof log.printBoxedLog).toBe('function');
    });
});

describe('log.printBoxedLog', () => {
    it('should handle empty issues array gracefully', () => {
        expect(() => log.printBoxedLog('No Issues', [])).not.toThrow();
    });

    it('should print issues with file and message', () => {
        const issues = [
            { file: 'test.ts', position: '1:1', type: E_IssueType.Error, message: 'Missing semi' },
        ];
        expect(() => log.printBoxedLog('Errors', issues)).not.toThrow();
    });

    it('should print issues with rule information', () => {
        const issues = [
            { file: 'test.ts', position: '5:10', type: E_IssueType.Warning, message: 'Unused var', rule: 'no-unused-vars' },
        ];
        expect(() => log.printBoxedLog('Warnings', issues, 'yellow')).not.toThrow();
    });

    it('should handle issues without position', () => {
        const issues = [
            { file: 'commitlint', type: E_IssueType.Error, message: 'Invalid commit' },
        ];
        expect(() => log.printBoxedLog('Errors', issues)).not.toThrow();
    });
});

describe('ensureLogLevel guard', () => {
    it('should allow repeated ensureLogLevel-triggering calls without error', async () => {
        // The module is imported under the shared getEnv mock, which returns { DEBUG: true }.
        // This test does not cover the DEBUG=false branch; it validates that invoking a
        // log method through a contextual logger does not crash when ensureLogLevel runs
        // through its guard/idempotency path.
        const ctxLog = log.withContext();
        expect(() => ctxLog.info('test')).not.toThrow();
    });
});
