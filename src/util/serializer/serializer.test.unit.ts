import { describe, expect, it } from 'vitest';

import { serializer } from './serializer.util.js';

const RE_ABC_I = /abc/i;
const RE_HELLO_GI = /hello/gi;
const BIGINT_OVER_MAX_SAFE = BigInt('9007199254740993');

describe('serializer', () => {
    it('should serialize and deserialize Map', () => {
        const map = new Map([['a', 1]]);
        const json = serializer.serialize(map);
        const result = serializer.deserialize(json);
        expect(result).toBeInstanceOf(Map);
        expect((result as Map<string, number>).get('a')).toBe(1);
    });

    it('should serialize and deserialize Set', () => {
        const set = new Set([1, 2]);
        const json = serializer.serialize(set);
        const result = serializer.deserialize(json);
        expect(result).toBeInstanceOf(Set);
        expect((result as Set<number>).has(1)).toBe(true);
    });

    it('should serialize and deserialize Date', () => {
        const date = new Date('2023-01-01');
        const json = serializer.serialize(date);
        const result = serializer.deserialize(json);
        expect(result).toBeInstanceOf(Date);
        expect((result as Date).toISOString()).toBe(date.toISOString());
    });

    it('should serialize and deserialize RegExp', () => {
        const regex = RE_ABC_I;
        const json = serializer.serialize(regex);
        const result = serializer.deserialize(json);
        expect(result).toBeInstanceOf(RegExp);
        expect((result as RegExp).source).toBe('abc');
        expect((result as RegExp).flags).toBe('i');
    });

    it('should serialize and deserialize BigInt', () => {
        const bigint = BigInt(123);
        const json = serializer.serialize(bigint);
        const result = serializer.deserialize(json);
        expect(typeof result).toBe('bigint');
        expect(result).toBe(bigint);
    });

    it('should serialize and deserialize a nested structure with mixed special types', () => {
        const date = new Date('2023-06-15T12:00:00.000Z');
        const nested = {
            name: 'test',
            timestamp: date,
            lookup: new Map<string, number>([['x', 10], ['y', 20]]),
            tags: new Set(['a', 'b']),
            pattern: RE_HELLO_GI,
            bigNum: BIGINT_OVER_MAX_SAFE,
            items: [
                { key: new Map([['nested', true]]) },
                new Set([BigInt(1), BigInt(2)]),
            ],
        };
        const json = serializer.serialize(nested);
        const result = serializer.deserialize(json) as typeof nested;
        expect(result.name).toBe('test');
        expect(result.timestamp).toBeInstanceOf(Date);
        expect((result.timestamp as unknown as Date).toISOString()).toBe(date.toISOString());
        expect(result.lookup).toBeInstanceOf(Map);
        expect((result.lookup as unknown as Map<string, number>).get('x')).toBe(10);
        expect(result.tags).toBeInstanceOf(Set);
        expect((result.tags as unknown as Set<string>).has('b')).toBe(true);
        expect(result.pattern).toBeInstanceOf(RegExp);
        expect((result.pattern as unknown as RegExp).source).toBe('hello');
        expect((result.pattern as unknown as RegExp).flags).toBe('gi');
        expect(typeof result.bigNum).toBe('bigint');
        expect(result.bigNum).toBe(BIGINT_OVER_MAX_SAFE);
        const firstItem = (result.items as unknown[])[0] as { key: Map<string, boolean> };
        expect(firstItem.key).toBeInstanceOf(Map);
        expect(firstItem.key.get('nested')).toBe(true);
        const secondItem = (result.items as unknown[])[1] as Set<bigint>;
        expect(secondItem).toBeInstanceOf(Set);
        expect(secondItem.has(BigInt(1))).toBe(true);
    });

    it('should pass through unknown __type values without reconstruction (security)', () => {
        const json = JSON.stringify({ __type: 'Function', value: 'alert(1)' });
        const result = serializer.deserialize(json) as { __type: string; value: string };
        expect(result.__type).toBe('Function');
        expect(result.value).toBe('alert(1)');
    });

    it('should reject BigInt strings exceeding maximum length (DoS prevention)', () => {
        const oversizedDigits = '9'.repeat(1001);
        const json = JSON.stringify({ __type: 'BigInt', value: oversizedDigits });
        const result = serializer.deserialize(json) as { __type: string; value: string };
        expect(result.__type).toBe('BigInt');
        expect(typeof result.value).toBe('string');
    });

    it('should reject non-numeric BigInt strings', () => {
        const json = JSON.stringify({ __type: 'BigInt', value: '123abc' });
        const result = serializer.deserialize(json) as { __type: string; value: string };
        expect(result.__type).toBe('BigInt');
        expect(result.value).toBe('123abc');
    });

    it('should reject RegExp with source exceeding maximum length (ReDoS prevention)', () => {
        const oversizedSource = 'a'.repeat(1001);
        const json = JSON.stringify({ __type: 'RegExp', value: { source: oversizedSource, flags: 'i' } });
        const result = serializer.deserialize(json) as { __type: string; value: { source: string; flags: string } };
        expect(result.__type).toBe('RegExp');
        expect(result.value.source).toBe(oversizedSource);
    });

    it('should reject RegExp with non-string flags (type guard)', () => {
        const json = JSON.stringify({ __type: 'RegExp', value: { source: 'abc', flags: 123 } });
        const result = serializer.deserialize(json) as { __type: string; value: { source: string; flags: number } };
        expect(result.__type).toBe('RegExp');
        expect(result.value.flags).toBe(123);
    });

    it('should reject RegExp with non-object value (type guard)', () => {
        const json = JSON.stringify({ __type: 'RegExp', value: 'not-an-object' });
        const result = serializer.deserialize(json) as { __type: string; value: string };
        expect(result.__type).toBe('RegExp');
        expect(result.value).toBe('not-an-object');
    });

    it('should reject BigInt with non-string value (type guard)', () => {
        const json = JSON.stringify({ __type: 'BigInt', value: 42 });
        const result = serializer.deserialize(json) as { __type: string; value: number };
        expect(result.__type).toBe('BigInt');
        expect(result.value).toBe(42);
    });

    // ---------- S-04: ReDoS hardening tests ----------

    it('should reject RegExp with nested quantifiers (ReDoS prevention)', () => {
        const redosPatterns = [
            '(a+)+', // classic catastrophic backtracking
            '(a*)*', // nested star
            '(a{1,})+', // nested brace quantifier
            '(x+)+b', // nested quantifier with trailing literal
        ];
        for (const source of redosPatterns) {
            const json = JSON.stringify({ __type: 'RegExp', value: { source, flags: '' } });
            const result = serializer.deserialize(json) as { __type: string; value: { source: string } };
            expect(result.__type).toBe('RegExp');
            expect(result.value.source).toBe(source);
        }
    });

    it('should accept safe RegExp patterns with quantifiers', () => {
        const safePatterns = [
            'a+b', // simple quantifier, no nesting
            '(abc)+', // group with quantifier, no inner quantifier
            '[a-z]{1,3}', // character class quantifier
        ];
        for (const source of safePatterns) {
            const json = JSON.stringify({ __type: 'RegExp', value: { source, flags: '' } });
            const result = serializer.deserialize(json);
            expect(result).toBeInstanceOf(RegExp);
        }
    });

    it('should handle invalid regex source gracefully (try-catch)', () => {
        // Unbalanced parentheses — syntactically invalid regex
        const json = JSON.stringify({ __type: 'RegExp', value: { source: '(abc', flags: '' } });
        const result = serializer.deserialize(json) as { __type: string; value: { source: string } };
        expect(result.__type).toBe('RegExp');
        expect(result.value.source).toBe('(abc');
    });
});
