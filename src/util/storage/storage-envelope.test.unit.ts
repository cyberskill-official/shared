import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTtlEnvelope, isExpiredEnvelope, isTtlEnvelope } from './storage-envelope.js';

describe('storage-envelope utility', () => {
    describe('isTtlEnvelope', () => {
        it('should return true for a valid envelope', () => {
            expect(isTtlEnvelope({ __isTtlEnvelope: true, value: 'test' })).toBe(true);
            expect(isTtlEnvelope({ __isTtlEnvelope: true, expiresAt: 1234, value: null })).toBe(true);
        });

        it('should return false for invalid payloads', () => {
            expect(isTtlEnvelope(null)).toBe(false);
            expect(isTtlEnvelope(undefined)).toBe(false);
            expect(isTtlEnvelope('string')).toBe(false);
            expect(isTtlEnvelope(123)).toBe(false);
            expect(isTtlEnvelope({})).toBe(false);
            expect(isTtlEnvelope({ value: 'test' })).toBe(false);
        });
    });

    describe('isExpiredEnvelope', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return false if there is no expiration set', () => {
            const envelope = { __isTtlEnvelope: true as const, value: 'test' };
            expect(isExpiredEnvelope(envelope)).toBe(false);
        });

        it('should return false if the expiration is in the future', () => {
            const now = Date.now();
            const envelope = { __isTtlEnvelope: true as const, expiresAt: now + 5000, value: 'test' };
            expect(isExpiredEnvelope(envelope)).toBe(false);
        });

        it('should return true if the current time is past expiration', () => {
            const now = Date.now();
            const envelope = { __isTtlEnvelope: true as const, expiresAt: now + 5000, value: 'test' };

            vi.advanceTimersByTime(5001);

            expect(isExpiredEnvelope(envelope)).toBe(true);
        });
    });

    describe('createTtlEnvelope', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(1000); // fixed start time
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should wrap a value in a valid ttl envelope', () => {
            const value = 'test-value';
            const ttlMs = 500;
            const envelope = createTtlEnvelope(value, ttlMs);

            expect(envelope.__isTtlEnvelope).toBe(true);
            expect(envelope.expiresAt).toBe(1500); // 1000 + 500
            expect(envelope.value).toBe(value);
        });
    });
});
