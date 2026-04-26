import { describe, expect, it } from 'vitest';

import { validate } from './validate.util.js';

describe('validate', () => {
    describe('isEmpty', () => {
        it('should return true for null/undefined', () => {
            expect(validate.isEmpty(null)).toBe(true);
            expect(validate.isEmpty(undefined)).toBe(true);
        });

        it('should return true for empty string', () => {
            expect(validate.isEmpty('')).toBe(true);
            expect(validate.isEmpty('   ')).toBe(true);
        });

        it('should return true for empty array', () => {
            expect(validate.isEmpty([])).toBe(true);
        });

        it('should return true for empty object', () => {
            expect(validate.isEmpty({})).toBe(true);
        });

        it('should handle Date objects correctly', () => {
            expect(validate.isEmpty(new Date())).toBe(false);
        });

        it('should handle Map and Set correctly', () => {
            expect(validate.isEmpty(new Map())).toBe(true);
            expect(validate.isEmpty(new Map([['a', 1]]))).toBe(false);
            expect(validate.isEmpty(new Set())).toBe(true);
            expect(validate.isEmpty(new Set(['a']))).toBe(false);
        });

        it('should handle WeakMap and WeakSet correctly', () => {
            expect(validate.isEmpty(new WeakMap())).toBe(true);
            expect(validate.isEmpty(new WeakSet())).toBe(true);
        });

        it('should handle ArrayBuffer views correctly', () => {
            expect(validate.isEmpty(new Uint8Array())).toBe(true);
            expect(validate.isEmpty(new Uint8Array([1, 2, 3]))).toBe(false);
        });

        it('should return false for non-empty values', () => {
            expect(validate.isEmpty('a')).toBe(false);
            expect(validate.isEmpty([1])).toBe(false);
            expect(validate.isEmpty({ a: 1 })).toBe(false);
            expect(validate.isEmpty(0)).toBe(false);
            expect(validate.isEmpty(false)).toBe(false);
        });
    });

    describe('isValidIP', () => {
        it('should validate IPv4', () => {
            expect(validate.isValidIP('192.168.1.1')).toBe(true);
            expect(validate.isValidIP('256.1.1.1')).toBe(false);
        });

        it('should validate IPv6', () => {
            expect(validate.isValidIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
            expect(validate.isValidIP('::1')).toBe(true);
        });

        it('should validate IPv4-mapped IPv6', () => {
            expect(validate.isValidIP('::ffff:192.168.0.1')).toBe(true);
        });

        it('should reject IPv4 with leading zeros (SSRF/octal ambiguity)', () => {
            expect(validate.isValidIP('010.0.0.1')).toBe(false);
            expect(validate.isValidIP('192.168.01.1')).toBe(false);
            expect(validate.isValidIP('0.0.0.01')).toBe(false);
            expect(validate.isValidIP('00.0.0.0')).toBe(false);
        });

        it('should allow valid single-zero IPv4 octets', () => {
            expect(validate.isValidIP('0.0.0.0')).toBe(true);
            expect(validate.isValidIP('0.0.0.1')).toBe(true);
        });

        it('should reject overlong input strings', () => {
            expect(validate.isValidIP('a'.repeat(100))).toBe(false);
        });

        it('should reject empty string', () => {
            expect(validate.isValidIP('')).toBe(false);
        });

        it('should reject IP with appended port (SSRF vector)', () => {
            expect(validate.isValidIP('192.168.1.1:8080')).toBe(false);
        });

        it('should reject non-IP strings', () => {
            expect(validate.isValidIP('not-an-ip')).toBe(false);
            expect(validate.isValidIP('localhost')).toBe(false);
        });

        it('should reject IPv4 with extra octets', () => {
            expect(validate.isValidIP('1.2.3.4.5')).toBe(false);
        });
    });
});
