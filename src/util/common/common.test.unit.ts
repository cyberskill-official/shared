import { describe, expect, it, vi } from 'vitest';

import { E_Environment } from '#typescript/index.js';

import { clamp, debounce, escapeRegExp, groupBy, isObject, isPlainObject, mapEnvironment, regexSearchMapper, removeAccent, retry, uniqueArray } from './common.util.js';

const RE_TEST = /regex/;

describe('regexSearchMapper', () => {
    it('should create regex pattern for accented characters', () => {
        const input = 'a';
        // Expecting something like [aàáạảãâầấậẩẫăằắặẳẵAÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]...
        const result = regexSearchMapper(input);
        expect(result).toContain('a');
        expect(result).toContain('à');
    });

    it('should normalize input before mapping', () => {
        const input = 'e\u0301'; // é decomposed
        const result = regexSearchMapper(input);
        // Should treat as 'é' and map it
        expect(result).toContain('é');
    });

    it('should escape regex special characters', () => {
        const input = 'a+b.c(d)';
        const result = regexSearchMapper(input);

        // + and . and ( and ) should be escaped
        expect(result).toContain('\\+');
        expect(result).toContain('\\.');
        expect(result).toContain('\\(');
        expect(result).toContain('\\)');
    });

    it('should match NFC target when input is NFC accented', () => {
        const input = 'café';
        const regexStr = regexSearchMapper(input);
        const regex = new RegExp(regexStr);
        expect(regex.test('café')).toBe(true);
    });
});

describe('escapeRegExp', () => {
    it('should escape all regex special characters', () => {
        const specialChars = '.*+?^${}()|[]\\';
        const escaped = escapeRegExp(specialChars);
        expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });
});

describe('removeAccent', () => {
    it('should remove accents from a string', () => {
        expect(removeAccent('Héllò Wórld')).toBe('Hello World');
        expect(removeAccent('Xin chào')).toBe('Xin chao');
    });
});

describe('uniqueArray', () => {
    it('should return unique elements from array', () => {
        expect(uniqueArray([1, 2, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should support key function', () => {
        const input = [{ id: 1 }, { id: 2 }, { id: 1 }];
        const result = uniqueArray(input, (item: { id: number }) => item.id);
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
});

describe('mapEnvironment', () => {
    it('should map development environment', () => {
        const env = { NODE_ENV: E_Environment.DEVELOPMENT, NODE_ENV_MODE: E_Environment.DEVELOPMENT };
        expect(mapEnvironment(env)).toEqual({ IS_DEV: true, IS_STAG: false, IS_PROD: false });
    });

    it('should map production environment', () => {
        const env = { NODE_ENV: E_Environment.PRODUCTION, NODE_ENV_MODE: E_Environment.PRODUCTION };
        expect(mapEnvironment(env)).toEqual({ IS_DEV: false, IS_STAG: false, IS_PROD: true });
    });

    it('should map staging environment', () => {
        const env = { NODE_ENV: E_Environment.PRODUCTION, NODE_ENV_MODE: E_Environment.STAGING };
        expect(mapEnvironment(env)).toEqual({ IS_DEV: false, IS_STAG: true, IS_PROD: false });
    });

    it('should throw error for invalid production config', () => {
        const env = { NODE_ENV: E_Environment.PRODUCTION, NODE_ENV_MODE: E_Environment.DEVELOPMENT };
        expect(() => mapEnvironment(env)).toThrow();
    });

    it('should default to development when no env vars provided', () => {
        expect(mapEnvironment({})).toEqual({ IS_DEV: true, IS_STAG: false, IS_PROD: false });
    });
});

describe('isObject', () => {
    it('should return true for plain objects', () => {
        expect(isObject({})).toBe(true);
    });

    it('should return true for arrays', () => {
        expect(isObject([])).toBe(true);
    });

    it('should return true for Date instances', () => {
        expect(isObject(new Date())).toBe(true);
    });

    it('should return true for Map instances', () => {
        expect(isObject(new Map())).toBe(true);
    });

    it('should return false for null', () => {
        expect(isObject(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isObject(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
        expect(isObject(42)).toBe(false);
        expect(isObject('string')).toBe(false);
        expect(isObject(true)).toBe(false);
    });
});

describe('isPlainObject', () => {
    it('should return true for literal objects', () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it('should return true for Object.create(null)', () => {
        expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it('should return false for arrays', () => {
        expect(isPlainObject([])).toBe(false);
    });

    it('should return false for class instances', () => {
        expect(isPlainObject(new Date())).toBe(false);
        expect(isPlainObject(new Map())).toBe(false);
        expect(isPlainObject(new Set())).toBe(false);
        expect(isPlainObject(RE_TEST)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isPlainObject(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isPlainObject(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
        expect(isPlainObject(42)).toBe(false);
        expect(isPlainObject('string')).toBe(false);
    });
});

describe('regexSearchMapper (branch coverage)', () => {
    it('should return the same result for the same input (deterministic)', () => {
        const first = regexSearchMapper('cache-test');
        const second = regexSearchMapper('cache-test');
        expect(first).toBe(second);
    });

    it('should still return a valid result after the 128-entry cache limit is reached', () => {
        // Fill the cache with 129 unique strings to trigger the eviction path
        const strings = Array.from({ length: 129 }, (_, i) => `eviction-test-${i}`);
        for (const s of strings) {
            regexSearchMapper(s);
        }

        // Regardless of whether the first entry was evicted, re-computing it
        // should still produce a valid non-empty string result.
        const result = regexSearchMapper('eviction-test-0');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('should handle strings with no accented characters', () => {
        const result = regexSearchMapper('xz123');
        expect(result).toBe('xz123');
    });
});

describe('clamp', () => {
    it('should return value when within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should clamp to min when value is below', () => {
        expect(clamp(-3, 0, 10)).toBe(0);
    });

    it('should clamp to max when value is above', () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should return boundary values exactly', () => {
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should handle min === max (single valid value)', () => {
        expect(clamp(5, 3, 3)).toBe(3);
        expect(clamp(3, 3, 3)).toBe(3);
    });

    it('should handle negative ranges', () => {
        expect(clamp(-5, -10, -1)).toBe(-5);
        expect(clamp(0, -10, -1)).toBe(-1);
    });

    it('should throw RangeError when min > max', () => {
        expect(() => clamp(5, 10, 0)).toThrow(RangeError);
    });

    it('should handle decimal values', () => {
        expect(clamp(0.5, 0, 1)).toBe(0.5);
        expect(clamp(1.5, 0, 1)).toBe(1);
    });
});

describe('groupBy', () => {
    it('should group items by key function', () => {
        const items = [
            { role: 'admin', name: 'Alice' },
            { role: 'user', name: 'Bob' },
            { role: 'admin', name: 'Carol' },
        ];
        const result = groupBy(items, i => i.role);
        expect(result.get('admin')).toEqual([
            { role: 'admin', name: 'Alice' },
            { role: 'admin', name: 'Carol' },
        ]);
        expect(result.get('user')).toEqual([{ role: 'user', name: 'Bob' }]);
    });

    it('should return empty map for empty array', () => {
        const result = groupBy([], (x: number) => x);
        expect(result.size).toBe(0);
    });

    it('should handle numeric keys', () => {
        const result = groupBy([1, 2, 3, 4, 5], n => n % 2);
        expect(result.get(0)).toEqual([2, 4]);
        expect(result.get(1)).toEqual([1, 3, 5]);
    });

    it('should preserve insertion order within groups', () => {
        const items = ['banana', 'apple', 'blueberry', 'avocado'];
        const result = groupBy(items, s => s[0]!);
        expect(result.get('b')).toEqual(['banana', 'blueberry']);
        expect(result.get('a')).toEqual(['apple', 'avocado']);
    });

    it('should handle single-element groups', () => {
        const result = groupBy([1, 2, 3], n => n);
        expect(result.size).toBe(3);
        expect(result.get(1)).toEqual([1]);
    });
});

describe('debounce', () => {
    it('should delay invocation until waitMs elapsed', async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('should reset timer on repeated calls', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced(); // reset
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('should cancel pending invocation', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced.cancel();
        vi.advanceTimersByTime(200);

        expect(fn).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should invoke immediately when waitMs is 0', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 0);

        debounced('arg1');
        vi.advanceTimersByTime(0);

        expect(fn).toHaveBeenCalledWith('arg1');
        vi.useRealTimers();
    });

    it('should throw RangeError for negative waitMs', () => {
        expect(() => debounce(() => {}, -1)).toThrow(RangeError);
        expect(() => debounce(() => {}, Number.NaN)).toThrow(RangeError);
        expect(() => debounce(() => {}, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    });

    it('should forward arguments to the original function', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 50);

        debounced('a', 'b', 3);
        vi.advanceTimersByTime(50);

        expect(fn).toHaveBeenCalledWith('a', 'b', 3);
        vi.useRealTimers();
    });
});

describe('retry', () => {
    it('should return result on first success', async () => {
        const result = await retry(async () => 42, { attempts: 3, delayMs: 0 });
        expect(result).toBe(42);
    });

    it('should retry until success', async () => {
        let calls = 0;
        const result = await retry(async () => {
            calls++;
            if (calls < 3)
                throw new Error('not yet');
            return 'ok';
        }, { attempts: 5, delayMs: 0 });

        expect(result).toBe('ok');
        expect(calls).toBe(3);
    });

    it('should throw last error after exhausting attempts', async () => {
        const fn = async () => {
            throw new Error('always fail');
        };
        await expect(retry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow('always fail');
    });

    it('should use defaults (3 attempts, 1000ms delay)', async () => {
        vi.useFakeTimers();
        let calls = 0;
        const promise = retry(async () => {
            calls++;
            if (calls < 3)
                throw new Error('fail');
            return 'done';
        });

        // After first call, advance past first delay
        await vi.advanceTimersByTimeAsync(1000);
        // After second call, advance past second delay
        await vi.advanceTimersByTimeAsync(1000);

        const result = await promise;
        expect(result).toBe('done');
        expect(calls).toBe(3);
        vi.useRealTimers();
    });

    it('should apply exponential backoff when enabled', async () => {
        vi.useFakeTimers();
        let calls = 0;
        const promise = retry(async () => {
            calls++;
            if (calls < 3)
                throw new Error('fail');
            return 'ok';
        }, { attempts: 3, delayMs: 100, backoff: true });

        // First retry delay: 100ms (100 * 2^0)
        await vi.advanceTimersByTimeAsync(100);
        expect(calls).toBe(2);

        // Second retry delay: 200ms (100 * 2^1)
        await vi.advanceTimersByTimeAsync(200);
        const result = await promise;

        expect(result).toBe('ok');
        expect(calls).toBe(3);
        vi.useRealTimers();
    });

    it('should work with zero delay', async () => {
        let calls = 0;
        const result = await retry(async () => {
            calls++;
            if (calls < 2)
                throw new Error('once');
            return calls;
        }, { delayMs: 0 });

        expect(result).toBe(2);
    });

    it('should throw RangeError for invalid options', async () => {
        await expect(retry(async () => 1, { attempts: 0 })).rejects.toThrow(RangeError);
        await expect(retry(async () => 1, { delayMs: -1 })).rejects.toThrow(RangeError);
    });
});
