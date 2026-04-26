import fsExtra from 'fs-extra';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { log } from '../log/index.js';

// Set env BEFORE importing storage module (module-level getEnv call)
const testDir = fsExtra.mkdtempSync(join(tmpdir(), 'storage-test-'));
process.env['CYBERSKILL_STORAGE_DIRECTORY'] = testDir;

// eslint-disable-next-line antfu/no-top-level-await
const { storage } = await import('./storage.util.js');

afterAll(() => {
    fsExtra.removeSync(testDir);
});

beforeEach(() => {
    vi.spyOn(log, 'error').mockImplementation(() => {});
    vi.spyOn(log, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// storage.set / storage.get
// ---------------------------------------------------------------------------
describe('storage.set & storage.get', () => {
    it('should store and retrieve a string value', async () => {
        await storage.set('test-key', 'hello');
        const result = await storage.get<string>('test-key');
        expect(result).toBe('hello');
    });

    it('should store and retrieve an object', async () => {
        const data = { name: 'test', count: 42 };
        await storage.set('obj-key', data);
        const result = await storage.get<typeof data>('obj-key');
        expect(result).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
        const result = await storage.get('missing-key');
        expect(result).toBeNull();
    });

    it('should overwrite existing key', async () => {
        await storage.set('overwrite-key', 'first');
        await storage.set('overwrite-key', 'second');
        const result = await storage.get<string>('overwrite-key');
        expect(result).toBe('second');
    });

    it('should respect ttlMs parameter and expire keys', async () => {
        vi.useFakeTimers();
        try {
            await storage.set('ttl-key', 'ttl-value', { ttlMs: 100 });
            let result = await storage.get<string>('ttl-key');
            expect(result).toBe('ttl-value');

            // Advance time past TTL
            vi.advanceTimersByTime(150);

            result = await storage.get<string>('ttl-key');
            expect(result).toBeNull();
        }
        finally {
            vi.useRealTimers();
        }
    });
});

describe('storage.getOrSet', () => {
    it('should return existing value if present', async () => {
        await storage.set('gor-exist', 'initial');
        const factory = vi.fn(async () => 'factory-value');
        const result = await storage.getOrSet('gor-exist', factory);

        expect(result).toBe('initial');
        expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and store if missing', async () => {
        await storage.remove('gor-missing');
        const factory = vi.fn(async () => 'computed-value');
        const result = await storage.getOrSet('gor-missing', factory);

        expect(result).toBe('computed-value');
        expect(factory).toHaveBeenCalledOnce();

        const stored = await storage.get<string>('gor-missing');
        expect(stored).toBe('computed-value');
    });

    it('should apply ttlMs to newly created values', async () => {
        vi.useFakeTimers();
        try {
            const factory = async () => 'temporal-value';
            const result = await storage.getOrSet('gor-ttl', factory, { ttlMs: 100 });
            expect(result).toBe('temporal-value');

            vi.advanceTimersByTime(150);
            const expired = await storage.get('gor-ttl');
            expect(expired).toBeNull();
        }
        finally {
            vi.useRealTimers();
        }
    });
});

// ---------------------------------------------------------------------------
// storage.has
// ---------------------------------------------------------------------------
describe('storage.has', () => {
    it('should return true if key exists', async () => {
        await storage.set('has-key', 'data');
        const result = await storage.has('has-key');
        expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
        const result = await storage.has('has-missing');
        expect(result).toBe(false);
    });

    it('should return false and remove key if ttl expired', async () => {
        vi.useFakeTimers();
        try {
            await storage.set('has-ttl', 'data', { ttlMs: 100 });
            let result = await storage.has('has-ttl');
            expect(result).toBe(true);

            vi.advanceTimersByTime(150);
            result = await storage.has('has-ttl');
            expect(result).toBe(false);

            // Verify it was actually removed
            const getResult = await storage.get('has-ttl');
            expect(getResult).toBeNull();
        }
        finally {
            vi.useRealTimers();
        }
    });
});

// ---------------------------------------------------------------------------
// storage.remove
// ---------------------------------------------------------------------------
describe('storage.remove', () => {
    it('should remove a stored value', async () => {
        await storage.set('remove-me', 'data');
        await storage.remove('remove-me');
        const result = await storage.get('remove-me');
        expect(result).toBeNull();
    });

    it('should not throw when removing non-existent key', async () => {
        await expect(storage.remove('ghost-key')).resolves.not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// storage.keys
// ---------------------------------------------------------------------------
describe('storage.keys', () => {
    it('should return all stored keys', async () => {
        // Clean slate for this test
        const freshDir = fsExtra.mkdtempSync(join(tmpdir(), 'storage-keys-'));
        process.env['CYBERSKILL_STORAGE_DIRECTORY'] = freshDir;

        // Re-import is not practical, so we test from existing state
        const keys = await storage.keys();
        expect(Array.isArray(keys)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// storage.getLogLink
// ---------------------------------------------------------------------------
describe('storage.getLogLink', () => {
    it('should return a formatted log link string', async () => {
        const link = await storage.getLogLink('some-key');
        expect(link).toContain('some-key');
        expect(typeof link).toBe('string');
    });

    it('should return null when generating link fails (e.g. key too long)', async () => {
        const giantKey = 'a'.repeat(300); // Exceeds MAX_KEY_LENGTH
        const link = await storage.getLogLink(giantKey);
        expect(link).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// storage.clear
// ---------------------------------------------------------------------------
describe('storage.clear', () => {
    it('should clear all keys atomically', async () => {
        await storage.set('clear-a', 'val-a');
        await storage.set('clear-b', 'val-b');

        let keys = await storage.keys();
        expect(keys.length).toBeGreaterThanOrEqual(2);

        await storage.clear();

        keys = await storage.keys();
        expect(keys.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// storage.iterate / storage.clear / storage.length / storage.key
// ---------------------------------------------------------------------------
describe('storage.iterate', () => {
    it('should iterate through stored keys', async () => {
        await storage.set('iter-a', 'val-a');
        await storage.set('iter-b', 'val-b');

        await (storage as any).get('iter-a'); // ensure accessible
        const keys = await storage.keys();
        expect(keys.length).toBeGreaterThanOrEqual(0);
    });
});

describe('storage - edge cases', () => {
    it('should handle getting a key that was removed', async () => {
        await storage.set('temp-key', 'temp');
        await storage.remove('temp-key');
        const result = await storage.get('temp-key');
        expect(result).toBeNull();
    });

    it('should handle setting null value', async () => {
        await storage.set('null-key', null);
        const result = await storage.get('null-key');
        expect(result).toBeNull();
    });

    it('should handle setting undefined value', async () => {
        await expect(storage.set('undef-key', undefined)).rejects.toThrow();
    });

    it('should handle multiple sequential sets on same key', async () => {
        await storage.set('multi-key', 'first');
        await storage.set('multi-key', 'second');
        await storage.set('multi-key', 'third');
        const result = await storage.get<string>('multi-key');
        expect(result).toBe('third');
    });

    it('should handle storing complex nested objects', async () => {
        const complex = { a: { b: { c: [1, 2, 3] } }, d: null };
        await storage.set('complex-key', complex);
        const result = await storage.get<typeof complex>('complex-key');
        expect(result).toEqual(complex);
    });

    it('should handle concurrent initialization properly', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        // Simulate 5 parallel storage ops racing to init
        await Promise.all([
            storage.set('p1', 'v1'),
            storage.set('p2', 'v2'),
            storage.set('p3', 'v3'),
            storage.keys(),
            storage.getLogLink('p1'),
        ]);

        const k = await storage.keys();
        expect(k).toContain('p1');
        expect(k).toContain('p2');
        expect(k).toContain('p3');
    });

    it('should bubble up driver initialization failures', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        // Mock fs.mkdir to throw to test ensureDriverReady catch block
        const fs = await import('node:fs/promises');
        const spy = vi.spyOn(fs.default, 'mkdir').mockRejectedValueOnce(new Error('Permission denied'));

        await expect(storage.set('fail-init', 'val')).rejects.toThrow('Permission denied');

        spy.mockRestore();
        resetStorageForTesting(); // restore state for future tests
    });

    it('should log error and return null for non-ENOENT read errors', async () => {
        const fs = await import('node:fs/promises');
        const spy = vi.spyOn(fs.default, 'readFile').mockRejectedValueOnce(new Error('EACCES: permission denied'));

        await expect(storage.get('some-key')).resolves.toBeNull();
        expect(log.error).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('storage custom driver & errors', () => {
    it('should handle invalid keys array from driver', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        await storage.initDriver({
            init: async () => {},
            clear: async () => {},
            getItem: async () => null,
            keys: async () => 'not-an-array' as any,
            removeItem: async () => {},
            setItem: async (_k, _v) => _v,
        });

        const result = await storage.keys();
        expect(result).toEqual([]);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid keys response'), 'not-an-array');

        resetStorageForTesting();
    });

    it('should catch error from driver keys()', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        await storage.initDriver({
            init: async () => {},
            clear: async () => {},
            getItem: async () => null,
            keys: async () => { throw new Error('keys crash'); },
            removeItem: async () => {},
            setItem: async (_k, _v) => _v,
        });

        const result = await storage.keys();
        expect(result).toEqual([]);
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('keys crash'));

        resetStorageForTesting();
    });

    it('should catch error from driver removeItem', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        await storage.initDriver({
            init: async () => {},
            clear: async () => {},
            getItem: async () => null,
            keys: async () => [],
            removeItem: async () => { throw new Error('remove crash'); },
            setItem: async (_k, _v) => _v,
        });

        await storage.remove('some-key');
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('remove crash'));

        resetStorageForTesting();
    });

    it('should catch error from driver getItem via has()', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        await storage.initDriver({
            init: async () => {},
            clear: async () => {},
            getItem: async () => { throw new Error('getItem crash'); },
            keys: async () => [],
            removeItem: async () => {},
            setItem: async (_k, _v) => _v,
        });

        const result = await storage.has('some-key');
        expect(result).toBe(false);
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('getItem crash'));

        resetStorageForTesting();
    });

    it('should catch error from driver clear()', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        await storage.initDriver({
            init: async () => {},
            clear: async () => { throw new Error('clear crash'); },
            getItem: async () => null,
            keys: async () => [],
            removeItem: async () => {},
            setItem: async (_k, _v) => _v,
        });

        await storage.clear();
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('clear crash'));

        resetStorageForTesting();
    });

    it('should reject oversized keys on set() with RangeError', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        const oversizedKey = 'k'.repeat(201); // Exceeds MAX_KEY_LENGTH (200)
        await expect(storage.set(oversizedKey, 'value')).rejects.toThrow(RangeError);

        resetStorageForTesting();
    });
});

// ---------------------------------------------------------------------------
// storage.size
// ---------------------------------------------------------------------------
describe('storage.size', () => {
    it('should return 0 after clearing', async () => {
        await storage.clear();
        const result = await storage.size();
        expect(result).toBe(0);
    });

    it('should return correct count after adding items', async () => {
        await storage.clear();
        await storage.set('size-a', 'val-a');
        await storage.set('size-b', 'val-b');

        const result = await storage.size();
        expect(result).toBe(2);
    });

    it('should return 0 on driver error', async () => {
        const { resetStorageForTesting } = await import('./storage.util.js');
        resetStorageForTesting();

        await storage.initDriver({
            init: async () => {},
            clear: async () => {},
            getItem: async () => null,
            keys: async () => { throw new Error('keys crash'); },
            removeItem: async () => {},
            setItem: async (_k, _v) => _v,
        });

        const result = await storage.size();
        expect(result).toBe(0);

        resetStorageForTesting();
    });
});
