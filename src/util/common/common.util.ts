import { E_Environment } from '#typescript/index.js';

import type { I_EnvFlags, I_NodeEnvInput } from './common.type.js';

const charMap: Record<string, string[]> = {
    a: ['à', 'á', 'ạ', 'ả', 'ã', 'â', 'ầ', 'ấ', 'ậ', 'ẩ', 'ẫ', 'ă', 'ằ', 'ắ', 'ặ', 'ẳ', 'ẵ'],
    e: ['è', 'é', 'ẹ', 'ẻ', 'ẽ', 'ê', 'ề', 'ế', 'ệ', 'ể', 'ễ'],
    i: ['ì', 'í', 'ị', 'ỉ', 'ĩ'],
    o: ['ò', 'ó', 'ọ', 'ỏ', 'õ', 'ô', 'ồ', 'ố', 'ộ', 'ổ', 'ỗ', 'ơ', 'ờ', 'ớ', 'ợ', 'ở', 'ỡ'],
    u: ['ù', 'ú', 'ụ', 'ủ', 'ũ', 'ư', 'ừ', 'ứ', 'ự', 'ử', 'ữ'],
    y: ['ỳ', 'ý', 'ỵ', 'ỷ', 'ỹ'],
    d: ['đ'],
};

const upperCharMap: Record<string, string[]> = Object.entries(charMap).reduce(
    (map, [key, value]) => {
        map[key.toUpperCase()] = value.map(char => char.toUpperCase());
        return map;
    },
    {} as Record<string, string[]>,
);

const combinedMap = { ...charMap, ...upperCharMap };

// Pre-compute replacement map and search regex for better performance
// This avoids rebuilding regexes and maps on every function call
const replacementMap = new Map<string, string>();
const charsToMatch = new Set<string>();

Object.entries(combinedMap).forEach(([baseChar, variations]) => {
    // The replacement pattern is the same for the base char and all its variations
    // Example: 'a', 'à', 'á'... all map to '(a|à|á...)'
    const replacement = `(${[baseChar, ...variations].join('|')})`;

    [baseChar, ...variations].forEach((char) => {
        replacementMap.set(char, replacement);
        charsToMatch.add(char);
    });
});

// Construct a single regex that matches any character in our map
const patternString = [...charsToMatch].join('');
// We use a character class regex: [abc...]
// eslint-disable-next-line regexp/no-empty-character-class -- regex is built dynamically from precomputed charMap
const searchRegex = new RegExp(`[${patternString}]`, 'g');

const RE_ESCAPE_REGEXP = /[.*+?^${}()|[\]\\]/g;

/**
 * Escapes special characters in a string for use in a regular expression.
 * This function escapes characters that have special meaning in regex (e.g., ., *, +, ?, etc.)
 * so they are treated as literal characters.
 *
 * @param str - The string to escape.
 * @returns The escaped string safe for use in a RegExp.
 */
export function escapeRegExp(str: string): string {
    return str.replace(RE_ESCAPE_REGEXP, '\\$&');
}

/**
 * Simple LRU cache for regex search patterns.
 * Avoids redundant accent alternation and regex compilation for repeated search terms.
 */
const regexPatternCache = new Map<string, string>();
const REGEX_CACHE_MAX_SIZE = 128;

/**
 * Convert a string to a regex pattern that matches the string and its accented variations.
 * This function normalizes the input string and creates a regex pattern that can match
 * both the original characters and their accented equivalents.
 *
 * Optimization: Uses pre-computed regex and map to perform replacement in a single pass (O(N)),
 * instead of iterating through all character groups (O(K*N)).
 * Results are cached in an LRU cache (max 128 entries) to avoid redundant computation
 * for repeated search terms.
 *
 * @param str - The string to convert to a regex pattern.
 * @returns The regex pattern as a string that matches the original string and its accented variations.
 */
export function regexSearchMapper(str: string) {
    const cached = regexPatternCache.get(str);

    if (cached !== undefined) {
        return cached;
    }

    const escaped = escapeRegExp(str);
    const result = escaped.replace(searchRegex, match => replacementMap.get(match) || match);

    // Evict oldest entry if cache is full
    if (regexPatternCache.size >= REGEX_CACHE_MAX_SIZE) {
        const oldestKey = regexPatternCache.keys().next().value;
        if (oldestKey !== undefined) {
            regexPatternCache.delete(oldestKey);
        }
    }

    regexPatternCache.set(str, result);
    return result;
}

const RE_DIACRITIC = /\p{Diacritic}/gu;

/**
 * Remove accents from a string.
 * This function normalizes the string using NFD normalization and removes all diacritical marks.
 *
 * @param str - The string to remove accents from.
 * @returns The string without any accents or diacritical marks.
 */
export function removeAccent(str: string) {
    return str.normalize('NFD').replace(RE_DIACRITIC, '');
}

/**
 * Remove duplicates from an array based on a key function.
 * This function can remove duplicates either by comparing values directly (when no keyFn is provided)
 * or by using a custom key function to determine uniqueness.
 *
 * @param arr - The array to remove duplicates from.
 * @param keyFn - Optional function that returns a unique key for each item in the array.
 * @returns A new array with duplicates removed, maintaining the original order.
 */
export function uniqueArray<T>(
    arr: T[],
    keyFn?: (item: T) => string | number,
): T[] {
    if (!keyFn) {
        return [...new Set(arr)];
    }

    const seen = new Set<string | number>();
    const result: T[] = [];

    for (const item of arr) {
        const key = keyFn(item);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }

    return result;
}

/**
 * Map environment variables to boolean flags indicating the current environment.
 * This function takes NODE_ENV and NODE_ENV_MODE variables and returns flags
 * indicating whether the current environment is development, staging, or production.
 *
 * @param env - The environment variables object containing NODE_ENV and NODE_ENV_MODE.
 * @returns An object containing boolean flags for the environment (IS_DEV, IS_STAG, IS_PROD).
 * @throws {Error} When NODE_ENV is production but NODE_ENV_MODE is development.
 */
export function mapEnvironment(env: I_NodeEnvInput): I_EnvFlags {
    const { NODE_ENV = E_Environment.DEVELOPMENT, NODE_ENV_MODE = E_Environment.DEVELOPMENT } = env;

    const IS_DEV = NODE_ENV === E_Environment.DEVELOPMENT && NODE_ENV_MODE === E_Environment.DEVELOPMENT;
    const IS_STAG = NODE_ENV === E_Environment.PRODUCTION && NODE_ENV_MODE === E_Environment.STAGING;
    const IS_PROD = NODE_ENV === E_Environment.PRODUCTION && NODE_ENV_MODE === E_Environment.PRODUCTION;

    if (NODE_ENV === E_Environment.PRODUCTION && NODE_ENV_MODE === E_Environment.DEVELOPMENT) {
        throw new Error('NODE_ENV_MODE must be set to staging or production in production environment');
    }

    return { IS_DEV, IS_STAG, IS_PROD };
}

/**
 * Checks if value is object-like (e.g., objects, arrays, etc.), not null.
 * Re-exported from util for general use across the codebase.
 *
 * @remarks
 * Returns `true` for arrays, Dates, Maps, Sets, and class instances.
 * Use {@link isPlainObject} when you specifically need to check for plain objects only.
 *
 * @param value - The value to check.
 * @returns True if the value is an object and not null.
 */
export function isObject(value: unknown): value is object {
    return value != null && typeof value === 'object';
}

/**
 * Checks if a value is a plain object (created by `{}`, `Object.create(null)`, or `new Object()`).
 * Unlike {@link isObject}, this returns `false` for arrays, Dates, Maps, Sets, RegExps,
 * and other class instances.
 *
 * @param value - The value to check.
 * @returns True if the value is a plain object, false otherwise.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(value);

    return proto === Object.prototype || proto === null;
}

/**
 * Clamps a number between a minimum and maximum value (inclusive).
 * Returns `min` if `value < min`, `max` if `value > max`, otherwise `value`.
 *
 * @param value - The number to clamp.
 * @param min - The lower bound.
 * @param max - The upper bound (must be ≥ min).
 * @returns The clamped number.
 * @throws {RangeError} If `min > max`.
 * @since 3.19.0
 */
export function clamp(value: number, min: number, max: number): number {
    if (min > max) {
        throw new RangeError(`clamp: min (${min}) must be ≤ max (${max})`);
    }

    return Math.min(Math.max(value, min), max);
}

/**
 * Groups an array of items into a `Map` keyed by the result of a selector function.
 * Items that produce the same key are collected into an array in insertion order.
 *
 * @example
 * ```ts
 * const users = [{ role: 'admin', name: 'A' }, { role: 'user', name: 'B' }, { role: 'admin', name: 'C' }];
 * groupBy(users, u => u.role);
 * // Map { 'admin' => [{ role: 'admin', name: 'A' }, { role: 'admin', name: 'C' }], 'user' => [...] }
 * ```
 *
 * @param items - The array to group.
 * @param keyFn - A function that returns the grouping key for each item.
 * @returns A `Map` from keys to arrays of items.
 * @since 3.19.0
 */
export function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();

    for (const item of items) {
        const key = keyFn(item);
        const group = map.get(key);

        if (group) {
            group.push(item);
        }
        else {
            map.set(key, [item]);
        }
    }

    return map;
}

/**
 * Creates a debounced version of the provided function that delays invocation
 * until `waitMs` milliseconds have elapsed since the last call.
 *
 * Includes a `.cancel()` method to clear any pending invocation, preventing
 * timer leaks in component teardown or test cleanup.
 *
 * @param fn - The function to debounce.
 * @param waitMs - The debounce delay in milliseconds (must be ≥ 0).
 * @returns A debounced function with a `.cancel()` method.
 * @throws {RangeError} If `waitMs` is negative or not a finite number.
 * @since 3.20.0
 *
 * @example
 * ```typescript
 * const save = debounce((value: string) => api.save(value), 300);
 * input.addEventListener('input', (e) => save(e.target.value));
 * // On unmount:
 * save.cancel();
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    waitMs: number,
): T & { cancel: () => void } {
    if (!Number.isFinite(waitMs) || waitMs < 0) {
        throw new RangeError(`debounce: waitMs must be a non-negative finite number, got ${waitMs}`);
    }

    let timerId: ReturnType<typeof setTimeout> | undefined;

    /**
     *
     */
    function debounced(this: unknown, ...args: Parameters<T>) {
        if (timerId !== undefined) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(() => {
            timerId = undefined;
            fn.apply(this, args);
        }, waitMs);
    }

    debounced.cancel = () => {
        if (timerId !== undefined) {
            clearTimeout(timerId);
            timerId = undefined;
        }
    };

    return debounced as T & { cancel: () => void };
}

/**
 * Retries an async function up to `attempts` times with optional delay and exponential backoff.
 * Returns the result on first success, or throws the last error after exhausting all attempts.
 *
 * @param fn - The async function to retry.
 * @param options - Retry configuration.
 * @param options.attempts - Maximum number of attempts (default: 3, must be ≥ 1).
 * @param options.delayMs - Base delay between retries in milliseconds (default: 1000, must be ≥ 0).
 * @param options.backoff - Whether to use exponential backoff (default: false).
 *   When true, delay doubles each retry: `delayMs`, `delayMs * 2`, `delayMs * 4`, etc.
 * @returns A promise resolving to the function's return value.
 * @throws The last error thrown by `fn` after all attempts are exhausted.
 * @throws {RangeError} If `attempts` < 1 or `delayMs` < 0.
 * @since 3.20.0
 *
 * @example
 * ```typescript
 * const data = await retry(() => fetch('/api/data').then(r => r.json()), {
 *     attempts: 5,
 *     delayMs: 500,
 *     backoff: true,
 * });
 * ```
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options?: { attempts?: number; delayMs?: number; backoff?: boolean },
): Promise<T> {
    const attempts = options?.attempts ?? 3;
    const delayMs = options?.delayMs ?? 1000;
    const backoff = options?.backoff ?? false;

    if (!Number.isFinite(attempts) || attempts < 1) {
        throw new RangeError(`retry: attempts must be ≥ 1, got ${attempts}`);
    }

    if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new RangeError(`retry: delayMs must be ≥ 0, got ${delayMs}`);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await fn();
        }
        catch (error: unknown) {
            lastError = error;

            if (attempt < attempts - 1) {
                const delay = backoff ? delayMs * (2 ** attempt) : delayMs;
                await new Promise<void>(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
