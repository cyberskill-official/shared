import type { T_Object } from '#typescript/index.js';

import type { I_SlugifyOptions } from './string.type.js';

import { removeAccent } from '../common/common.util.js';

const RE_NON_ALNUM = /[^a-z0-9\s-]/gi;
const RE_MULTI_SPACE_DASH = /[\s-]+/g;
const RE_LEADING_TRAILING_DASH = /^-+|-+$/g;
const RE_HYPHEN = /-/g;
const RE_HAS_LOWER = /[a-z]/;
const RE_HAS_UPPER = /[A-Z]/;
const RE_HAS_DIGIT = /\d/;
const RE_HAS_SPECIAL = /[!@#$%^&*()_+[\]{}|;:,.<>?]/;

/**
 * Generates a slug from a string.
 * The slug is a URL-friendly version of the string, removing special characters
 * and converting spaces to hyphens.
 *
 * @param input - The string to be slugified.
 * @param options - Options for slugification.
 * @returns The slugified string.
 */
function slugify(input: string, options?: I_SlugifyOptions): string {
    let slug = input.trim();

    // 1. Remove accents
    slug = removeAccent(slug);

    // 2. To lower case if requested (default true)
    if (options?.lower !== false) {
        slug = slug.toLowerCase();
    }

    // 3. Replace invalid characters with space (keeping alphanumeric, hyphens, and spaces)
    slug = slug.replace(RE_NON_ALNUM, ' ');

    // 4. Replace multiple spaces or hyphens with a single hyphen
    slug = slug.replace(RE_MULTI_SPACE_DASH, '-');

    // 5. Remove leading/trailing hyphens
    slug = slug.replace(RE_LEADING_TRAILING_DASH, '');

    return slug;
}

/**
 * Generates a slug from a string or an object containing strings.
 * The slug is a URL-friendly version of the string, removing special characters
 * and converting spaces to hyphens. This function can handle both single strings
 * and objects with string values.
 *
 * @param input - The string or object to be slugified.
 * @param options - Options for slugification including replacement character, case sensitivity, locale, etc.
 * @returns The slugified string or object with the same structure as the input.
 */
export function generateSlug<T = string>(
    input: T,
    options?: I_SlugifyOptions,
): T {
    const slugifyWithOptions = (value: string) =>
        slugify(value ?? '', options);

    if (typeof input === 'object' && input !== null) {
        const result: T_Object = {};

        for (const [key, value] of Object.entries(input)) {
            result[key] = slugifyWithOptions(value as string);
        }

        return result as T;
    }

    return slugifyWithOptions(input as string) as T;
}

/**
 * Generates a short ID from a UUID.
 * The ID is a substring of the UUID, providing a shorter identifier.
 * Note: This is NOT cryptographically secure and collisions are possible,
 * but suitable for display purposes where uniqueness is handled elsewhere.
 *
 * @param uuid - The UUID to be converted to a short ID.
 * @param length - The desired length of the short ID (default: 4 characters).
 * @returns A short ID string of the specified length derived from the UUID.
 */
export function generateShortId(uuid: string, length = 4): string {
    // Simple hash function (FNV-1a variant) to generate a hex string from the UUID
    let hash = 0x811C9DC5;
    for (let i = 0; i < uuid.length; i++) {
        hash ^= uuid.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    // Convert to unsigned 32-bit integer hex string
    const hex = (hash >>> 0).toString(16).padStart(8, '0');

    // If we need more than 8 chars, we can just append part of the original UUID (stripped of dashes)
    // or use a different strategy. For short IDs (usually < 8), the hash is fine.
    // If length > 8, we fallback to just slicing the clean UUID.
    if (length > 8) {
        return uuid.replace(RE_HYPHEN, '').slice(0, length);
    }

    return hex.slice(0, length);
}

/**
 * Internal helper that fills `length` characters from `charset` using
 * rejection-sampling over `crypto.getRandomValues` to avoid modulo bias.
 * Random values are requested in bounded chunks to keep allocations small.
 *
 * @param length - Number of characters to generate.
 * @param charset - The pool of characters to draw from.
 * @returns A randomly generated string of the requested length.
 */
function generateRandomFromCharset(length: number, charset: string): string {
    const limit = Math.floor(2 ** 32 / charset.length) * charset.length;
    const result: string[] = [];
    const MAX_UINT32_VALUES_PER_CALL = 16384;

    while (result.length < length) {
        const remaining = length - result.length;
        const chunkSize = remaining > MAX_UINT32_VALUES_PER_CALL ? MAX_UINT32_VALUES_PER_CALL : remaining;
        const values = new Uint32Array(chunkSize);
        crypto.getRandomValues(values);

        for (const value of values) {
            if (result.length >= length) {
                break;
            }
            if (value < limit) {
                result.push(charset[value % charset.length] as string);
            }
        }
    }

    return result.join('');
}

/**
 * Generates a random password of a given length.
 * The password contains a mix of letters (both cases), numbers, and special characters
 * to ensure complexity and security.
 *
 * @param length - The desired length of the password (default: 8 characters).
 * @returns A randomly generated password string with the specified length.
 * @throws {RangeError} If `length` is not a non-negative safe integer.
 */
export function generateRandomPassword(length = 8): string {
    if (!Number.isSafeInteger(length) || length < 0) {
        throw new RangeError('length must be a non-negative safe integer');
    }

    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const special = '!@#$%^&*()_+[]{}|;:,.<>?';
    const charset = lower + upper + digits + special;

    const password = generateRandomFromCharset(length, charset);

    // Ensure at least one char from each class when length >= 4
    if (length >= 4) {
        const hasLower = RE_HAS_LOWER.test(password);
        const hasUpper = RE_HAS_UPPER.test(password);
        const hasDigit = RE_HAS_DIGIT.test(password);
        const hasSpecial = RE_HAS_SPECIAL.test(password);

        if (hasLower && hasUpper && hasDigit && hasSpecial) {
            return password;
        }

        // If the pure random string lacks required classes, construct a guaranteed-valid one
        const chars = [
            generateRandomFromCharset(1, lower),
            generateRandomFromCharset(1, upper),
            generateRandomFromCharset(1, digits),
            generateRandomFromCharset(1, special),
        ];

        // Fill the rest with random characters
        if (length > 4) {
            const rest = generateRandomFromCharset(length - 4, charset);
            for (const c of rest) {
                chars.push(c);
            }
        }

        // Fisher-Yates shuffle using rejection sampling to avoid modulo bias
        for (let i = chars.length - 1; i > 0; i--) {
            const range = i + 1;
            // 0x1_0000_0000 = 2^32, the exclusive upper bound of Uint32Array values
            const maxUnbiased = Math.floor(0x1_0000_0000 / range) * range;
            const buf = new Uint32Array(1);
            let randomValue: number;

            do {
                crypto.getRandomValues(buf);
                randomValue = buf[0]!;
            } while (randomValue >= maxUnbiased);

            const j = randomValue % range;
            [chars[i], chars[j]] = [chars[j]!, chars[i]!];
        }

        return chars.join('');
    }

    return password;
}

/**
 * Generates a random string of a given length using a secure random number generator.
 * This function is a cryptographically secure alternative to Math.random().toString(36).
 *
 * @param length - The desired length of the string (default: 8 characters).
 * @param charset - The characters to use (default: lowercase alphanumeric).
 * @returns A randomly generated string.
 * @throws {RangeError} If `length` is not a non-negative safe integer.
 * @throws {RangeError} If `charset` is empty or exceeds 2^32 characters.
 */
export function generateRandomString(
    length = 8,
    charset = 'abcdefghijklmnopqrstuvwxyz0123456789',
): string {
    if (!Number.isSafeInteger(length) || length < 0) {
        throw new RangeError('length must be a non-negative safe integer');
    }

    if (charset.length === 0 || charset.length > 2 ** 32) {
        throw new RangeError('charset.length must be between 1 and 2^32');
    }

    return generateRandomFromCharset(length, charset);
}

/**
 * Get the file name from a URL.
 * This function extracts the file name from a URL, optionally including or excluding
 * the file extension. It handles URLs with query parameters and fragments.
 *
 * @param url - The URL to extract the file name from (default: empty string).
 * @param getExtension - Whether to include the file extension in the result (default: false).
 * @returns The file name extracted from the URL, with or without the extension.
 */
export function getFileName(url = '', getExtension = false): string {
    let withoutQuery = url;

    // Fast path: avoid RegExp split overhead for common URLs
    const qIndex = url.indexOf('?');
    if (qIndex !== -1) {
        withoutQuery = url.slice(0, qIndex);
    }

    const hIndex = withoutQuery.indexOf('#');
    if (hIndex !== -1) {
        withoutQuery = withoutQuery.slice(0, hIndex);
    }

    const fileName = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);

    if (getExtension) {
        return fileName;
    }

    const dotIndex = fileName.lastIndexOf('.');

    return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

/**
 * Extracts a substring between two strings.
 * This function finds the first occurrence of the starting string, then finds the first
 * occurrence of the ending string after the starting string, and returns the content between them.
 *
 * @param s - The original string to search within.
 * @param a - The starting string that marks the beginning of the desired substring.
 * @param b - The ending string that marks the end of the desired substring.
 * @returns The substring between the two specified strings, or an empty string if either string is not found.
 */
export function substringBetween(s: string, a: string, b: string): string {
    const start = s.indexOf(a);

    if (start === -1) {
        return '';
    }

    const from = start + a.length;
    const end = s.indexOf(b, from);

    if (end === -1) {
        return '';
    }

    return s.slice(from, end);
}

/**
 * Truncates a string to a maximum length, appending a suffix when truncated.
 * If the string is already within the limit, it is returned unchanged.
 * The returned string (including suffix) will never exceed `maxLength`.
 *
 * @param str - The string to truncate.
 * @param maxLength - The maximum length of the result (including suffix).
 * @param suffix - The suffix to append when truncated (default: `…` U+2026).
 * @returns The original string if within limits, or the truncated string with suffix.
 * @throws {RangeError} If `maxLength` is less than the suffix length.
 *
 * @example
 * ```typescript
 * truncate('Hello, World!', 8);       // 'Hello, …'
 * truncate('Hello', 10);              // 'Hello'
 * truncate('Hello, World!', 8, '..'); // 'Hello,..'
 * ```
 */
export function truncate(str: string, maxLength: number, suffix = '\u2026'): string {
    if (maxLength < suffix.length) {
        throw new RangeError(`maxLength (${maxLength}) must be >= suffix length (${suffix.length})`);
    }

    if (str.length <= maxLength) {
        return str;
    }

    return str.slice(0, maxLength - suffix.length) + suffix;
}
