import { describe, expect, it } from 'vitest';

import { generateRandomPassword, generateRandomString, generateShortId, generateSlug, getFileName, substringBetween, truncate } from './string.util.js';

const RE_ABC_ONLY = /^[abc]+$/;

describe('generateShortId', () => {
    it('should generate a short ID of specified length', () => {
        const uuid = '123e4567-e89b-12d3-a456-426614174000';
        const id = generateShortId(uuid, 6);
        expect(id).toHaveLength(6);
    });

    it('should be deterministic for the same input', () => {
        const uuid = '123e4567-e89b-12d3-a456-426614174000';
        const id1 = generateShortId(uuid);
        const id2 = generateShortId(uuid);
        expect(id1).toBe(id2);
    });

    it('should fallback to uuid slice if length is large', () => {
        const uuid = '123e4567-e89b-12d3-a456-426614174000';
        const id = generateShortId(uuid, 10);
        // Stripped dashes: 123e4567e89b12d3a456426614174000
        // First 10 chars: 123e4567e8
        expect(id).toBe('123e4567e8');
    });
});

describe('generateSlug', () => {
    it('should slugify a string', () => {
        const input = 'Hello World!';
        const result = generateSlug(input);
        expect(result).toBe('hello-world');
    });

    it('should handle accents', () => {
        const input = 'Héllò Wórld';
        const result = generateSlug(input);
        expect(result).toBe('hello-world');
    });

    it('should handle special characters', () => {
        const input = 'Foo & Bar @ Baz';
        const result = generateSlug(input);
        expect(result).toBe('foo-bar-baz');
    });

    it('should slugify an object values', () => {
        const input = { title: 'Hello World', desc: 'Foo Bar' };
        const result = generateSlug(input);
        expect(result).toEqual({ title: 'hello-world', desc: 'foo-bar' });
    });

    it('should keep already slugified string unchanged', () => {
        const input = 'hello-world-123';
        const result = generateSlug(input);
        expect(result).toBe('hello-world-123');
    });
});

describe('generateRandomPassword', () => {
    it('should generate password of specified length', () => {
        expect(generateRandomPassword(10)).toHaveLength(10);
    });
});

describe('generateRandomString', () => {
    it('should generate string of specified length', () => {
        expect(generateRandomString(10)).toHaveLength(10);
    });

    it('should use custom charset if provided', () => {
        const charset = 'abc';
        const result = generateRandomString(100, charset);
        expect(result).toMatch(RE_ABC_ONLY);
    });

    it('should return empty string if length is 0', () => {
        expect(generateRandomString(0)).toBe('');
    });

    it('should throw RangeError for negative length', () => {
        expect(() => generateRandomString(-1)).toThrow(RangeError);
    });

    it('should throw RangeError for non-integer length', () => {
        expect(() => generateRandomString(3.5)).toThrow(RangeError);
    });

    it('should throw RangeError for unsafe integer length', () => {
        expect(() => generateRandomString(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    });

    it('should throw RangeError for Infinity length', () => {
        expect(() => generateRandomString(Infinity)).toThrow(RangeError);
    });

    it('should throw RangeError for empty charset', () => {
        expect(() => generateRandomString(5, '')).toThrow(RangeError);
    });
});

describe('getFileName', () => {
    it('should extract filename from URL', () => {
        expect(getFileName('http://example.com/path/to/file.png')).toBe('file');
    });

    it('should include extension if requested', () => {
        expect(getFileName('http://example.com/path/to/file.png', true)).toBe('file.png');
    });

    it('should handle query parameters', () => {
        expect(getFileName('http://example.com/file.png?v=1')).toBe('file');
    });
});

describe('substringBetween', () => {
    it('should extract string between markers', () => {
        expect(substringBetween('start [middle] end', '[', ']')).toBe('middle');
    });

    it('should return empty string if markers not found', () => {
        expect(substringBetween('start end', '[', ']')).toBe('');
    });

    it('should return empty string if end marker not found', () => {
        expect(substringBetween('start [middle', '[', ']')).toBe('');
    });
});

describe('generateSlug (branch coverage)', () => {
    it('should preserve case when lower is false', () => {
        expect(generateSlug('Hello World', { lower: false })).toBe('Hello-World');
    });

    it('should handle null-ish values gracefully', () => {
        expect(generateSlug(null as any)).toBe('');
    });
});

describe('generateRandomPassword (branch coverage)', () => {
    it('should generate default 8-char password', () => {
        expect(generateRandomPassword()).toHaveLength(8);
    });

    it('should throw RangeError for negative length', () => {
        expect(() => generateRandomPassword(-1)).toThrow(RangeError);
    });

    it('should generate empty password for length 0', () => {
        expect(generateRandomPassword(0)).toBe('');
    });
});

describe('getFileName (branch coverage)', () => {
    it('should handle URL with no path', () => {
        expect(getFileName('')).toBe('');
    });

    it('should handle filename without extension', () => {
        expect(getFileName('http://example.com/README')).toBe('README');
    });

    it('should handle fragment URLs', () => {
        expect(getFileName('http://example.com/file.png#section')).toBe('file');
    });
});

describe('generateShortId (branch coverage)', () => {
    it('should use hash for length <= 8', () => {
        const id = generateShortId('test-uuid', 4);
        expect(id).toHaveLength(4);
    });

    it('should use default length of 4', () => {
        const id = generateShortId('test-uuid');
        expect(id).toHaveLength(4);
    });
});

const RE_HAS_LOWER = /[a-z]/;
const RE_HAS_UPPER = /[A-Z]/;
const RE_HAS_DIGIT = /\d/;
const RE_HAS_SPECIAL = /[!@#$%^&*()_+[\]{}|;:,.<>?]/;

describe('generateRandomPassword (character-class enforcement)', () => {
    it('should produce passwords with all 4 character classes when length >= 4', () => {
        for (let i = 0; i < 50; i++) {
            // Test at the boundary (length 4) where collisions are most likely
            const pw = generateRandomPassword(4);
            expect(pw).toHaveLength(4);

            // Assert all required classes are present
            expect(RE_HAS_LOWER.test(pw)).toBe(true);
            expect(RE_HAS_UPPER.test(pw)).toBe(true);
            expect(RE_HAS_DIGIT.test(pw)).toBe(true);
            expect(RE_HAS_SPECIAL.test(pw)).toBe(true);
        }
    });

    it('should produce larger passwords containing all classes', () => {
        const pw = generateRandomPassword(12);
        expect(pw).toHaveLength(12);
        expect(RE_HAS_LOWER.test(pw)).toBe(true);
        expect(RE_HAS_UPPER.test(pw)).toBe(true);
        expect(RE_HAS_DIGIT.test(pw)).toBe(true);
        expect(RE_HAS_SPECIAL.test(pw)).toBe(true);
    });

    it('should not enforce character classes when length < 4', () => {
        const pw = generateRandomPassword(2);
        expect(pw).toHaveLength(2);
        expect(typeof pw).toBe('string');
    });
});

describe('generateRandomFromCharset (internal branches via generateRandomString)', () => {
    it('should handle large lengths exceeding MAX_UINT32_VALUES_PER_CALL (16384)', () => {
        const length = 20000;
        const result = generateRandomString(length);
        expect(result).toHaveLength(length);
    });

    it('should produce unbiased output via rejection sampling', () => {
        // With a charset of length 3, limit = floor(2^32/3)*3 = 4294967295
        // This means values >= 4294967295 are rejected (very rare, but the code path exists).
        // We verify correctness by checking that with charset 'abc', all chars are from that set.
        const result = generateRandomString(500, 'abc');
        expect(result).toHaveLength(500);
        for (const ch of result) {
            expect('abc').toContain(ch);
        }
    });
});

describe('truncate', () => {
    it('should truncate a long string with default suffix', () => {
        expect(truncate('Hello, World!', 8)).toBe('Hello, \u2026');
    });

    it('should return original string if within limit', () => {
        expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should return original string if exactly at limit', () => {
        expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should use custom suffix', () => {
        expect(truncate('Hello, World!', 8, '..')).toBe('Hello,..');
    });

    it('should handle empty string', () => {
        expect(truncate('', 5)).toBe('');
    });

    it('should handle maxLength equal to suffix length', () => {
        expect(truncate('Hello', 1)).toBe('\u2026');
    });

    it('should throw RangeError when maxLength < suffix length', () => {
        expect(() => truncate('Hello', 0)).toThrow(RangeError);
    });

    it('should throw RangeError with multi-char suffix exceeding maxLength', () => {
        expect(() => truncate('Hello', 1, '...')).toThrow(RangeError);
    });

    it('should handle empty suffix', () => {
        expect(truncate('Hello, World!', 5, '')).toBe('Hello');
    });
});
