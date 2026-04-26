import { describe, expect, it } from 'vitest';

import { RESPONSE_STATUS } from '#constant/index.js';

import { throwError } from './log.util.js';

describe('throwError', () => {
    it('should throw an Error with the given message', () => {
        expect(() => throwError('test error')).toThrow('test error');
    });

    it('should set the default code to INTERNAL_SERVER_ERROR', () => {
        try {
            throwError('test error');
        }
        catch (error) {
            expect((error as Error & { code?: number }).code).toBe(RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE);
        }
    });

    it('should set a custom code when provided', () => {
        try {
            throwError('not found', 404);
        }
        catch (error) {
            expect((error as Error & { code?: number }).code).toBe(404);
        }
    });

    it('should throw an instance of Error', () => {
        expect(() => throwError('test')).toThrow(Error);
    });
});
