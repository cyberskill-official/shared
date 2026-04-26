import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storage } from './storage.util.js';

vi.mock('../log/index.js', () => ({
    catchError: vi.fn((_error: unknown, opts?: { returnValue?: unknown }) => opts?.returnValue !== undefined ? opts.returnValue : undefined),
}));

describe('storage', () => {
    const mockStore: Record<string, string> = {};

    beforeEach(async () => {
        vi.clearAllMocks();
        // Clear mock store
        Object.keys(mockStore).forEach(k => delete mockStore[k]);

        // Mock localStorage
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => mockStore[key] ?? null),
            setItem: vi.fn((key: string, value: string) => { mockStore[key] = value; }),
            removeItem: vi.fn((key: string) => { delete mockStore[key]; }),
            key: vi.fn((index: number) => Object.keys(mockStore)[index] ?? null),
            get length() { return Object.keys(mockStore).length; },
            clear: vi.fn(() => { Object.keys(mockStore).forEach(k => delete mockStore[k]); }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('get', () => {
        it('should return stored value by key', async () => {
            mockStore['key'] = JSON.stringify('hello');
            const result = await storage.get('key');
            expect(result).toBe('hello');
            expect(localStorage.getItem).toHaveBeenCalledWith('key');
        });

        it('should return null when key does not exist', async () => {
            const result = await storage.get('missing');
            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            vi.mocked(localStorage.getItem).mockImplementation(() => {
                throw new Error('fail');
            });
            const result = await storage.get('key');
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should store value with key', async () => {
            await storage.set('key', { data: 42 });
            expect(localStorage.setItem).toHaveBeenCalledWith('key', JSON.stringify({ data: 42 }));
        });

        it('should catch errors silently', async () => {
            vi.mocked(localStorage.setItem).mockImplementation(() => {
                throw new Error('fail');
            });
            await expect(storage.set('key', 'value')).resolves.toBeUndefined();
        });
    });

    describe('remove', () => {
        it('should remove value by key', async () => {
            await storage.remove('key');
            expect(localStorage.removeItem).toHaveBeenCalledWith('key');
        });

        it('should catch errors silently', async () => {
            vi.mocked(localStorage.removeItem).mockImplementation(() => {
                throw new Error('fail');
            });
            await expect(storage.remove('key')).resolves.toBeUndefined();
        });
    });

    describe('keys', () => {
        it('should return all storage keys', async () => {
            mockStore['a'] = '1';
            mockStore['b'] = '2';
            mockStore['c'] = '3';
            const result = await storage.keys();
            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('should return empty array on error', async () => {
            vi.mocked(localStorage.key).mockImplementation(() => {
                throw new Error('fail');
            });
            const result = await storage.keys();
            expect(result).toEqual([]);
        });

        it('should return empty array when no keys exist', async () => {
            const result = await storage.keys();
            expect(result).toEqual([]);
        });
    });

    describe('ttlMs and getOrSet', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should store wrapped value and return it if not expired', async () => {
            await storage.set('ttl-key', 'ttl-value', { ttlMs: 100 });
            let result = await storage.get<string>('ttl-key');
            expect(result).toBe('ttl-value');

            vi.advanceTimersByTime(150);

            result = await storage.get<string>('ttl-key');
            expect(result).toBeNull();
            expect(localStorage.removeItem).toHaveBeenCalledWith('ttl-key');
        });

        it('should return existing value directly in getOrSet', async () => {
            await storage.set('gor-exist', 'existing');
            const factory = vi.fn(async () => 'new-value');

            const result = await storage.getOrSet('gor-exist', factory);
            expect(result).toBe('existing');
            expect(factory).not.toHaveBeenCalled();
        });

        it('should invoke factory when value is missing', async () => {
            const factory = vi.fn(async () => 'computed-value');

            const result = await storage.getOrSet('gor-missing', factory, { ttlMs: 100 });
            expect(result).toBe('computed-value');
            expect(factory).toHaveBeenCalledOnce();

            const raw = mockStore['gor-missing'];
            expect(raw).toBeDefined();
            const stored = JSON.parse(raw as string);
            expect(stored.__isTtlEnvelope).toBe(true);
            expect(stored.value).toBe('computed-value');
        });
    });
    describe('has', () => {
        it('should return true if key exists', async () => {
            await storage.set('has-key', 'value');
            const result = await storage.has('has-key');
            expect(result).toBe(true);
        });

        it('should return false if key does not exist', async () => {
            const result = await storage.has('missing-key');
            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            vi.mocked(localStorage.getItem).mockImplementation(() => {
                throw new Error('fail');
            });
            const result = await storage.has('key');
            expect(result).toBe(false);
        });
    });

    describe('has (TTL branches)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return false and cleanup when TTL has expired', async () => {
            await storage.set('ttl-has', 'val', { ttlMs: 50 });
            expect(await storage.has('ttl-has')).toBe(true);

            vi.advanceTimersByTime(100);

            expect(await storage.has('ttl-has')).toBe(false);
            expect(localStorage.removeItem).toHaveBeenCalledWith('ttl-has');
        });

        it('should return true when TTL has NOT expired', async () => {
            await storage.set('ttl-has-fresh', 'val', { ttlMs: 200 });
            vi.advanceTimersByTime(50);
            expect(await storage.has('ttl-has-fresh')).toBe(true);
        });
    });

    describe('getOrSet (extended)', () => {
        it('should invoke sync factory when value is missing', async () => {
            const factory = vi.fn(() => 'sync-computed');
            const result = await storage.getOrSet('sync-factory', factory);
            expect(result).toBe('sync-computed');
            expect(factory).toHaveBeenCalledOnce();
        });

        it('should invoke factory and store when expired TTL key exists', async () => {
            vi.useFakeTimers();

            try {
                await storage.set('ttl-gor', 'old-value', { ttlMs: 50 });
                vi.advanceTimersByTime(100);

                const factory = vi.fn(async () => 'refreshed');
                const result = await storage.getOrSet('ttl-gor', factory);
                expect(result).toBe('refreshed');
                expect(factory).toHaveBeenCalledOnce();
            }
            finally {
                vi.useRealTimers();
            }
        });
    });

    describe('clear', () => {
        it('should clear all keys from storage', async () => {
            await storage.set('key1', 'val1');
            await storage.set('key2', 'val2');

            await storage.clear();

            expect(mockStore).toEqual({});
            expect(localStorage.clear).toHaveBeenCalledOnce();
        });

        it('should catch errors silently on clear', async () => {
            vi.mocked(localStorage.clear).mockImplementation(() => {
                throw new Error('fail');
            });
            await expect(storage.clear()).resolves.toBeUndefined();
        });
    });

    describe('size', () => {
        it('should return 0 for empty storage', async () => {
            const result = await storage.size();
            expect(result).toBe(0);
        });

        it('should return correct count after adding items', async () => {
            await storage.set('a', 1);
            await storage.set('b', 2);
            await storage.set('c', 3);

            const result = await storage.size();
            expect(result).toBe(3);
        });

        it('should return 0 on error', async () => {
            Object.defineProperty(localStorage, 'length', {
                get: () => { throw new Error('fail'); },
                configurable: true,
            });
            const result = await storage.size();
            expect(result).toBe(0);
        });
    });
});
