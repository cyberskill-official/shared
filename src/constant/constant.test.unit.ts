import { describe, expect, it } from 'vitest';

import { IS_BROWSER } from './common.js';
import { RESPONSE_STATUS } from './response-status.js';

describe('IS_BROWSER', () => {
    it('should be a boolean', () => {
        expect(typeof IS_BROWSER).toBe('boolean');
    });
});

describe('RESPONSE_STATUS', () => {
    it('should have CODE and MESSAGE for every entry', () => {
        for (const [key, value] of Object.entries(RESPONSE_STATUS)) {
            expect(value, `${key} should have CODE`).toHaveProperty('CODE');
            expect(value, `${key} should have MESSAGE`).toHaveProperty('MESSAGE');
            expect(typeof value.MESSAGE, `${key}.MESSAGE should be string`).toBe('string');
        }
    });

    it('should contain standard HTTP status codes', () => {
        expect(RESPONSE_STATUS.OK.CODE).toBe(200);
        expect(RESPONSE_STATUS.CREATED.CODE).toBe(201);
        expect(RESPONSE_STATUS.BAD_REQUEST.CODE).toBe(400);
        expect(RESPONSE_STATUS.UNAUTHORIZED.CODE).toBe(401);
        expect(RESPONSE_STATUS.FORBIDDEN.CODE).toBe(403);
        expect(RESPONSE_STATUS.NOT_FOUND.CODE).toBe(404);
        expect(RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE).toBe(500);
    });

    it('should contain GraphQL-specific codes as strings', () => {
        expect(typeof RESPONSE_STATUS.GRAPHQL_PARSE_FAILED.CODE).toBe('string');
        expect(typeof RESPONSE_STATUS.BAD_USER_INPUT.CODE).toBe('string');
    });

    it('should have non-empty MESSAGE for all entries', () => {
        for (const [key, value] of Object.entries(RESPONSE_STATUS)) {
            expect(value.MESSAGE.length, `${key}.MESSAGE should not be empty`).toBeGreaterThan(0);
        }
    });

    it('should have unique CODEs across HTTP numeric entries', () => {
        const numericCodes = Object.values(RESPONSE_STATUS)
            .map(v => v.CODE)
            .filter(c => typeof c === 'number') as number[];
        const unique = new Set(numericCodes);
        expect(unique.size).toBe(numericCodes.length);
    });
});
