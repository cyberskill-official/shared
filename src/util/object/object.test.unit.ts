import { describe, expect, it } from 'vitest';

import { deepClone, deepMerge, getNestedValue, isJSON, normalizeMongoFilter, omit, pick, setNestedValue } from './object.util.js';

const RE_ABC_I = /abc/i;
const RE_TEST_GI = /test/gi;

describe('deepMerge', () => {
    it('should ignore __proto__ in merged objects to prevent prototype pollution', () => {
        const target = {};
        const malicious = JSON.parse('{"__proto__": {"polluted3": true}}');
        const result = deepMerge(target, malicious);
        expect(({} as any).polluted3).toBeUndefined();
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect((result as any).polluted3).toBeUndefined();
    });

    it('should treat constructor as a regular key (not a prototype-pollution vector)', () => {
        const target = {};
        const malicious = JSON.parse('{"constructor": {"prototype": {"polluted4": true}}}');
        const result = deepMerge(target, malicious);
        expect(({} as any).polluted4).toBeUndefined();
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect((result as any).polluted4).toBeUndefined();
    });
    it('should merge two objects', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { b: { d: 3 }, e: 4 };
        const result = deepMerge(obj1, obj2);
        expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
    });

    it('should merge arrays by concatenation', () => {
        const arr1 = [1, 2];
        const arr2 = [3, 4];
        const result = deepMerge(arr1, arr2);
        expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should merge nested arrays within objects', () => {
        const obj1 = { a: [1, 2] };
        const obj2 = { a: [3, 4] };
        const result = deepMerge(obj1, obj2);
        expect(result).toEqual({ a: [1, 2, 3, 4] });
    });

    it('should handle null/undefined arguments', () => {
        const obj1 = { a: 1 };
        const result = deepMerge(obj1, null, undefined, { b: 2 });
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should overwrite non-mergeable types', () => {
        const obj1 = { a: 1 };
        const obj2 = { a: 'string' };
        const result = deepMerge(obj1, obj2);
        expect(result).toEqual({ a: 'string' });
    });
});

describe('deepClone', () => {
    it('should deep clone objects', () => {
        const obj = { a: 1, b: { c: 2 } };
        const clone = deepClone(obj);
        expect(clone).toEqual(obj);
        expect(clone).not.toBe(obj);
        expect(clone.b).not.toBe(obj.b);
    });

    it('should deep clone arrays', () => {
        const arr = [1, { a: 2 }];
        const clone = deepClone(arr);
        expect(clone).toEqual(arr);
        expect(clone).not.toBe(arr);
        expect(clone[1]).not.toBe(arr[1]);
    });

    it('should clone Date and RegExp', () => {
        const obj = { d: new Date(), r: RE_ABC_I };
        const clone = deepClone(obj);
        expect(clone.d).toBeInstanceOf(Date);
        expect(clone.d).not.toBe(obj.d);
        expect(clone.d.getTime()).toBe(obj.d.getTime());
        expect(clone.r).toBeInstanceOf(RegExp);
        expect(clone.r).not.toBe(obj.r);
        expect(clone.r.source).toBe(obj.r.source);
        expect(clone.r.flags).toBe(obj.r.flags);
    });

    it('should return reference for class instances (like ObjectId)', () => {
        class MockObjectId {
            id: string;
            constructor(id: string) { this.id = id; }
        }
        const id = new MockObjectId('123');
        const obj = { id };
        const clone = deepClone(obj);
        expect(clone.id).toBe(id); // Same reference
        expect(clone.id).toBeInstanceOf(MockObjectId);
    });
});

describe('isJSON', () => {
    it('should return true for valid JSON object', () => {
        expect(isJSON('{"a": 1}')).toBe(true);
    });

    it('should return true for valid JSON array', () => {
        expect(isJSON('[1, 2, 3]')).toBe(true);
    });

    it('should return true for valid JSON string', () => {
        expect(isJSON('"string"')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
        expect(isJSON('{a: 1}')).toBe(false); // unquoted key
        expect(isJSON('invalid')).toBe(false);
    });
});

describe('normalizeMongoFilter', () => {
    it('should ignore __proto__ to prevent prototype pollution', () => {
        const malicious = JSON.parse('{"__proto__": {"polluted5": true}}');
        const result = normalizeMongoFilter(malicious);
        expect(({} as any).polluted5).toBeUndefined();
        expect((result as any).polluted5).toBeUndefined();
    });
    it('should flatten nested objects to dot notation', () => {
        const filter = { a: { b: 1 } };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual({ 'a.b': 1 });
    });

    it('should preserve MongoDB operators', () => {
        const filter = { a: { $in: [1, 2] } };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual({ a: { $in: [1, 2] } });
    });

    it('should handle mixed nested and operators', () => {
        const filter = { a: { b: 1 }, c: { $gt: 5 } };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual({ 'a.b': 1, 'c': { $gt: 5 } });
    });
});

describe('getNestedValue', () => {
    const obj = { a: { b: { c: 1 } } };

    it('should get nested value', () => {
        expect(getNestedValue(obj, ['a', 'b', 'c'])).toBe(1);
    });

    it('should return undefined for non-existent path', () => {
        expect(getNestedValue(obj, ['a', 'x'])).toBeUndefined();
    });

    it('should return the object itself for empty path', () => {
        expect(getNestedValue(obj, [])).toBe(obj);
    });

    it('should return undefined if object is null/undefined', () => {
        expect(getNestedValue(null, ['a'])).toBeUndefined();
        expect(getNestedValue(undefined, ['a'])).toBeUndefined();
    });

    it('should return undefined if path is broken by primitive', () => {
        const objWithPrimitive = { a: 1 };
        expect(getNestedValue(objWithPrimitive, ['a', 'b'])).toBeUndefined();
    });

    it('should access array indices', () => {
        const objWithArray = { a: [10, 20, 30] };
        expect(getNestedValue(objWithArray, ['a', 1])).toBe(20);
    });
});

describe('setNestedValue', () => {
    it('should ignore __proto__ to prevent prototype pollution', () => {
        const obj = {};
        const result = setNestedValue(obj, ['__proto__', 'polluted'], true);
        expect(({} as any).polluted).toBeUndefined();
        expect((result as any).polluted).toBeUndefined();
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(obj).toEqual({});
    });

    it('should allow constructor as a legitimate data key', () => {
        const obj = {};
        const result = setNestedValue(obj, ['constructor', 'name'], 'MyClass');
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect((result as any).constructor).toEqual({ name: 'MyClass' });
        expect(obj).toEqual({});
    });

    it('should set nested value', () => {
        const obj = {};
        const result = setNestedValue(obj, ['a', 'b'], 1);
        expect(result).toEqual({ a: { b: 1 } });
    });

    it('should be immutable', () => {
        const obj = { a: 1 };
        const result = setNestedValue(obj, ['b'], 2);
        expect(obj).toEqual({ a: 1 });
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should return original object for empty path', () => {
        const obj = { a: 1 };
        expect(setNestedValue(obj, [], 'ignored')).toBe(obj);
    });

    it('should overwrite nested non-object values', () => {
        const obj = { a: 'string' };
        const result = setNestedValue(obj, ['a', 'b'], 1);
        expect(result).toEqual({ a: { b: 1 } });
    });
});

describe('deepMerge (branch coverage)', () => {
    it('should return empty object for no arguments', () => {
        expect(deepMerge()).toEqual({});
    });

    it('should return empty object when all args are null/undefined', () => {
        expect(deepMerge(null, undefined)).toEqual({});
    });

    it('should return single argument directly', () => {
        const obj = { a: 1 };
        expect(deepMerge(obj)).toBe(obj);
    });

    it('should throw when mixing arrays and objects', () => {
        expect(() => deepMerge([1], { a: 1 })).toThrow('Cannot mix arrays and objects');
    });

    it('should handle object-vs-array overwrite in nested merge', () => {
        const obj1 = { a: [1, 2] };
        const obj2 = { a: { b: 1 } };
        const result = deepMerge(obj1, obj2);
        expect(result).toEqual({ a: { b: 1 } });
    });

    it('should throw on excessively deep nesting (max-depth guard)', () => {
        // Build two objects nested > 20 levels deep with overlapping keys
        // to trigger recursive mergeRecursive calls
        let obj1: Record<string, unknown> = { value: 'a' };
        let obj2: Record<string, unknown> = { value: 'b' };
        for (let i = 0; i < 22; i++) {
            obj1 = { [`lvl${i}`]: obj1 };
            obj2 = { [`lvl${i}`]: obj2 };
        }
        expect(() => deepMerge(obj1, obj2)).toThrow('Maximum depth');
    });
});

describe('deepClone (branch coverage)', () => {
    it('should return primitives as-is', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(true)).toBe(true);
        expect(deepClone(null)).toBeNull();
        expect(deepClone(undefined)).toBeUndefined();
    });

    it('should clone standalone Date', () => {
        const date = new Date('2024-01-01');
        const cloned = deepClone(date);
        expect(cloned).toBeInstanceOf(Date);
        expect(cloned).not.toBe(date);
        expect(cloned.getTime()).toBe(date.getTime());
    });

    it('should clone standalone RegExp', () => {
        const regex = RE_TEST_GI;
        const cloned = deepClone(regex);
        expect(cloned).toBeInstanceOf(RegExp);
        expect(cloned).not.toBe(regex);
        expect(cloned.source).toBe('test');
        expect(cloned.flags).toBe('gi');
    });

    it('should clone standalone array', () => {
        const arr = [1, 2, 3];
        const cloned = deepClone(arr);
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
    });

    it('should handle circular reference gracefully', () => {
        const obj: Record<string, unknown> = { a: 1 };
        obj['self'] = obj;
        const cloned = deepClone(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned['a']).toBe(1);
        // The circular reference should point back to the cloned object itself
        expect(cloned['self']).toBe(cloned);
    });

    it('should handle nested circular reference gracefully', () => {
        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = { a };
        a['b'] = b;
        const clonedA = deepClone(a);
        expect(clonedA).not.toBe(a);
        // Mutual references should be preserved in the clone
        expect((clonedA['b'] as Record<string, unknown>)['a']).toBe(clonedA);
    });

    it('should handle shared references without error', () => {
        const shared = { x: 1 };
        const obj = { a: shared, b: shared };
        const cloned = deepClone(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.a).toEqual({ x: 1 });
        expect(cloned.b).toEqual({ x: 1 });
        // Both should reference the same cloned object
        expect(cloned.a).toBe(cloned.b);
        // But not the original
        expect(cloned.a).not.toBe(shared);
    });

    it('should strip __proto__ keys to prevent prototype pollution', () => {
        const malicious = JSON.parse('{"__proto__": {"polluted_clone": true}, "safe": 1}');
        const cloned = deepClone(malicious);
        expect(({} as any).polluted_clone).toBeUndefined();
        expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
        expect((cloned as any).polluted_clone).toBeUndefined();
        expect((cloned as any).safe).toBe(1);
    });
});

describe('normalizeMongoFilter (branch coverage)', () => {
    it('should return null/falsy input as-is', () => {
        expect(normalizeMongoFilter(null as any)).toBeNull();
        expect(normalizeMongoFilter(undefined as any)).toBeUndefined();
    });

    it('should handle flat keys without nesting', () => {
        const filter = { name: 'test', age: 25 };
        expect(normalizeMongoFilter(filter)).toEqual({ name: 'test', age: 25 });
    });

    it('should handle array values without flattening', () => {
        const filter = { tags: ['a', 'b'] };
        expect(normalizeMongoFilter(filter)).toEqual({ tags: ['a', 'b'] });
    });

    it('should handle deeply nested objects', () => {
        const filter = { a: { b: { c: 1 } } };
        expect(normalizeMongoFilter(filter)).toEqual({ 'a.b.c': 1 });
    });

    it('should preserve non-POJO values (class instances) as-is', () => {
        class CustomId {
            id: string;
            constructor(id: string) { this.id = id; }
        }
        const customId = new CustomId('abc');
        const filter = { owner: customId };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual({ owner: customId });
    });

    it('should handle null-prototype objects as POJO', () => {
        const nullProto = Object.create(null);
        nullProto.nested = 'value';
        const filter = { data: nullProto };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual({ 'data.nested': 'value' });
    });

    it('should throw on excessively deep nesting (max-depth guard)', () => {
        // Build a filter nested > 10 levels deep
        let filter: Record<string, unknown> = { deep: 'value' };
        for (let i = 0; i < 12; i++) {
            filter = { [`level${i}`]: filter };
        }
        expect(() => normalizeMongoFilter(filter)).toThrow('Maximum depth');
    });

    it('should handle mixed nested levels with Mongo operators at various depths', () => {
        const filter = { a: { b: { c: { $exists: true } } } };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual({ 'a.b.c': { $exists: true } });
    });

    it('should pass through non-object input types', () => {
        expect(normalizeMongoFilter(0 as any)).toBe(0);
        expect(normalizeMongoFilter('' as any)).toBe('');
    });
});

// ---------- S-05: Expanded operator blocklist tests ----------

describe('normalizeMongoFilter (dangerous operator blocking)', () => {
    it.each([
        ['$where', { name: { $where: 'this.isAdmin' } }],
        ['$function', { score: { $function: { body: 'return 1', args: [], lang: 'js' } } }],
        ['$accumulator', { count: { $accumulator: { init: 'return 0' } } }],
        ['$merge', { data: { $merge: { into: 'secrets' } } }],
        ['$out', { data: { $out: 'secrets' } }],
        ['$lookup', { ref: { $lookup: { from: 'users', localField: 'id' } } }],
    ])('should throw for dangerous operator %s', (_label, filter) => {
        expect(() => normalizeMongoFilter(filter)).toThrow('Dangerous operator');
    });

    it('should allow safe operators like $in, $gt, $exists', () => {
        const filter = { status: { $in: ['active', 'pending'] }, age: { $gt: 18 }, name: { $exists: true } };
        const result = normalizeMongoFilter(filter);
        expect(result).toEqual(filter);
    });
});

describe('pick', () => {
    it('should pick specified keys from an object', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should return empty object for empty keys array', () => {
        expect(pick({ a: 1, b: 2 }, [])).toEqual({});
    });

    it('should silently ignore non-existent keys', () => {
        const obj = { a: 1, b: 2 };
        expect(pick(obj, ['a', 'z' as keyof typeof obj])).toEqual({ a: 1 });
    });

    it('should not mutate the source object', () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = pick(obj, ['a']);
        expect(result).toEqual({ a: 1 });
        expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should handle all keys', () => {
        const obj = { x: 10, y: 20 };
        expect(pick(obj, ['x', 'y'])).toEqual({ x: 10, y: 20 });
    });

    it('should deduplicate keys', () => {
        const obj = { a: 1, b: 2 };
        expect(pick(obj, ['a', 'a'])).toEqual({ a: 1 });
    });
});

describe('omit', () => {
    it('should omit specified keys from an object', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });

    it('should return full object for empty keys array', () => {
        const obj = { a: 1, b: 2 };
        const result = omit(obj, []);
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should silently ignore non-existent keys', () => {
        const obj = { a: 1, b: 2 };
        expect(omit(obj, ['z' as keyof typeof obj])).toEqual({ a: 1, b: 2 });
    });

    it('should not mutate the source object', () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = omit(obj, ['c']);
        expect(result).toEqual({ a: 1, b: 2 });
        expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should return empty object when all keys are omitted', () => {
        const obj = { a: 1, b: 2 };
        expect(omit(obj, ['a', 'b'])).toEqual({});
    });

    it('should skip inherited properties', () => {
        const proto = { inherited: true };
        const obj = Object.create(proto);
        obj.own = 1;
        expect(omit(obj, [])).toEqual({ own: 1 });
    });
});
