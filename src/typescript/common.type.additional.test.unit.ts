import { describe, expect, it } from 'vitest';

import type { I_Return } from './common.type.js';

import { isSuccess, unwrapResult } from './common.type.js';

describe('isSuccess', () => {
    it('should return true for a success result', () => {
        const result: I_Return<string> = { success: true, result: 'hello' };
        expect(isSuccess(result)).toBe(true);
    });

    it('should return false for a failure result', () => {
        const result: I_Return<string> = { success: false, message: 'err', code: 500 };
        expect(isSuccess(result)).toBe(false);
    });

    it('should narrow type on success branch', () => {
        const result: I_Return<number> = { success: true, result: 42 };
        if (isSuccess(result)) {
            // TypeScript should narrow to I_ReturnSuccess<number>
            expect(result.result).toBe(42);
        }
    });
});

describe('unwrapResult', () => {
    it('should return the result for a success', () => {
        const result: I_Return<string> = { success: true, result: 'data' };
        expect(unwrapResult(result)).toBe('data');
    });

    it('should throw an error for a failure', () => {
        const result: I_Return<string> = { success: false, message: 'not found', code: 404 };
        expect(() => unwrapResult(result)).toThrow('not found');
    });

    it('should throw Error instance on failure', () => {
        const result: I_Return<string> = { success: false, message: 'bad request', code: 400 };
        expect(() => unwrapResult(result)).toThrow(Error);
    });

    it('should return result with extended type', () => {
        const result: I_Return<{ name: string }, { extra: boolean }> = {
            success: true,
            result: { name: 'test', extra: true },
        };
        const unwrapped = unwrapResult(result);
        expect(unwrapped.name).toBe('test');
        expect(unwrapped.extra).toBe(true);
    });
});
