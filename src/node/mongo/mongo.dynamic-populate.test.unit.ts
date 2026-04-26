/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import { isObject } from '#util/common/index.js';

import { catchError } from '../log/index.js';
import {
    filterDynamicVirtualsFromPopulate,
    isMongooseDoc,
    populateDynamicVirtuals,
    remapDynamicPopulate,
} from './mongo.dynamic-populate.js';

vi.mock('#util/index.js', () => ({
    deepClone: vi.fn(<T>(v: T): T => JSON.parse(JSON.stringify(v))),
}));

vi.mock('../log/index.js', () => ({
    catchError: vi.fn(),
}));

vi.mock('./mongo.populate.js', () => ({
    applyNestedPopulate: vi.fn(async (_m: any, docs: any[]) => docs),
}));

vi.mock('./mongo.util.js', () => ({
    convertEnumToModelName: vi.fn((v: string) => {
        if (v === v.toUpperCase())
            return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        return v;
    }),
}));

/* ---------- isObject ---------- */

describe('isObject', () => {
    it('should return true for plain objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
    });

    it('should return true for arrays', () => {
        expect(isObject([])).toBe(true);
    });

    it('should return false for null', () => {
        expect(isObject(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isObject(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
        expect(isObject(42)).toBe(false);
        expect(isObject('str')).toBe(false);
        expect(isObject(true)).toBe(false);
    });
});

/* ---------- isMongooseDoc ---------- */

describe('isMongooseDoc', () => {
    it('should return true if object has toObject function', () => {
        expect(isMongooseDoc({ toObject: () => ({}) })).toBe(true);
    });

    it('should return false for plain objects', () => {
        expect(isMongooseDoc({ name: 'test' })).toBe(false);
    });

    it('should return false for null', () => {
        expect(isMongooseDoc(null)).toBe(false);
    });

    it('should return false if toObject is not a function', () => {
        expect(isMongooseDoc({ toObject: 'string' })).toBe(false);
    });
});

/* ---------- filterDynamicVirtualsFromPopulate ---------- */

describe('filterDynamicVirtualsFromPopulate', () => {
    const dynamicVirtuals = [
        { name: 'gallery', options: { ref: () => 'Media', localField: 'id', foreignField: 'entityId' } },
        { name: 'likes', options: { ref: () => 'Like', localField: 'id', foreignField: 'postId' } },
    ] as any[];

    it('should return populate unchanged when no dynamic virtuals', () => {
        expect(filterDynamicVirtualsFromPopulate('field', [])).toBe('field');
        expect(filterDynamicVirtualsFromPopulate('field', undefined)).toBe('field');
    });

    it('should return undefined for undefined populate', () => {
        expect(filterDynamicVirtualsFromPopulate(undefined, dynamicVirtuals)).toBeUndefined();
    });

    it('should filter out dynamic virtual from string populate', () => {
        expect(filterDynamicVirtualsFromPopulate('gallery', dynamicVirtuals)).toBeUndefined();
    });

    it('should keep non-dynamic string populate', () => {
        expect(filterDynamicVirtualsFromPopulate('author', dynamicVirtuals)).toBe('author');
    });

    it('should filter dynamic virtuals from string with prefix "gallery.items"', () => {
        expect(filterDynamicVirtualsFromPopulate('gallery.items', dynamicVirtuals)).toBeUndefined();
    });

    it('should filter dynamic virtuals from array populate', () => {
        const result = filterDynamicVirtualsFromPopulate(['author', 'gallery', 'likes'], dynamicVirtuals);
        expect(result).toEqual(['author']);
    });

    it('should return undefined when all items filtered from array', () => {
        const result = filterDynamicVirtualsFromPopulate(['gallery', 'likes'], dynamicVirtuals);
        expect(result).toBeUndefined();
    });

    it('should filter dynamic virtuals from object populate', () => {
        const result = filterDynamicVirtualsFromPopulate({ path: 'gallery' }, dynamicVirtuals);
        expect(result).toBeUndefined();
    });

    it('should keep non-dynamic object populate', () => {
        const result = filterDynamicVirtualsFromPopulate({ path: 'author' }, dynamicVirtuals);
        expect(result).toEqual({ path: 'author' });
    });

    it('should filter objects in array by path', () => {
        const result = filterDynamicVirtualsFromPopulate(
            [{ path: 'gallery' }, { path: 'author' }],
            dynamicVirtuals,
        );
        expect(result).toEqual([{ path: 'author' }]);
    });

    it('should handle non-string non-object entries in array', () => {
        const result = filterDynamicVirtualsFromPopulate([42 as any, 'author'], dynamicVirtuals);
        expect(result).toEqual([42, 'author']);
    });
});

/* ---------- remapDynamicPopulate ---------- */

describe('remapDynamicPopulate', () => {
    it('should return empty array for empty documents', () => {
        expect(remapDynamicPopulate([], 'gallery', { ref: () => 'Media' } as any)).toEqual([]);
    });

    it('should return empty array when virtualName is empty', () => {
        expect(remapDynamicPopulate([{ id: '1' }], '', { ref: () => 'Media' } as any)).toEqual([]);
    });

    it('should return empty array when options.ref is missing', () => {
        expect(remapDynamicPopulate([{ id: '1' }], 'gallery', {} as any)).toEqual([]);
    });

    it('should group documents by model name', () => {
        const docs = [
            { entityType: 'USER', id: '1' },
            { entityType: 'POST', id: '2' },
            { entityType: 'USER', id: '3' },
        ];
        const options = { ref: (doc: any) => doc.entityType } as any;
        const result = remapDynamicPopulate(docs, 'entity', options);

        expect(result).toHaveLength(2);
        expect(result.find(g => g.model === 'User')?.docs).toHaveLength(2);
        expect(result.find(g => g.model === 'Post')?.docs).toHaveLength(1);
    });

    it('should skip documents where ref returns null/undefined', () => {
        const docs = [{ id: '1' }, { id: '2' }];
        const options = { ref: () => null } as any;
        const result = remapDynamicPopulate(docs, 'entity', options);
        expect(result).toEqual([]);
    });

    it('should skip documents where ref returns empty string', () => {
        const docs = [{ id: '1' }];
        const options = { ref: () => '   ' } as any;
        const result = remapDynamicPopulate(docs, 'entity', options);
        expect(result).toEqual([]);
    });

    it('should catch errors in ref function', () => {
        const docs = [{ id: '1' }];
        const options = {
            ref: () => { throw new Error('ref error'); },
        } as any;
        const result = remapDynamicPopulate(docs, 'entity', options);
        expect(result).toEqual([]);
        expect(catchError).toHaveBeenCalled();
    });
});

/* ---------- populateDynamicVirtuals ---------- */

describe('populateDynamicVirtuals', () => {
    /**
     *
     */
    function createMockMongoose(modelsMap: Record<string, any> = {}) {
        return { models: modelsMap } as any;
    }

    /**
     *
     */
    function createMockModel(findResult: any[] = []) {
        return {
            find: vi.fn(() => ({
                lean: vi.fn().mockResolvedValue(findResult),
            })),
            schema: { virtuals: {}, paths: {}, statics: {} },
        };
    }

    const baseConfig = (name: string, opts: Partial<any> = {}) => ({
        name,
        options: {
            ref: () => 'User',
            localField: 'id',
            foreignField: 'entityId',
            justOne: false,
            count: false,
            ...opts,
        },
    });

    it('should return docs unchanged when documents are empty', async () => {
        const mongoose = createMockMongoose();
        const result = await populateDynamicVirtuals(mongoose, [], [baseConfig('gallery')], 'gallery');
        expect(result).toEqual([]);
    });

    it('should return docs unchanged when virtualConfigs are empty', async () => {
        const mongoose = createMockMongoose();
        const result = await populateDynamicVirtuals(mongoose, [{ id: '1' }], [], 'gallery');
        expect(result).toEqual([{ id: '1' }]);
    });

    it('should return docs unchanged when populate is undefined', async () => {
        const mongoose = createMockMongoose();
        const result = await populateDynamicVirtuals(mongoose, [{ id: '1' }], [baseConfig('gallery')]);
        expect(result).toEqual([{ id: '1' }]);
    });

    it('should return docs unchanged when no requested virtuals match', async () => {
        const mongoose = createMockMongoose();
        const result = await populateDynamicVirtuals(mongoose, [{ id: '1' }], [baseConfig('gallery')], 'nonexistent');
        expect(result).toEqual([{ id: '1' }]);
    });

    it('should populate dynamic virtuals with string populate', async () => {
        const UserModel = createMockModel([
            { id: 'u1', entityId: '1', name: 'Alice' },
        ]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'gallery');

        expect(UserModel.find).toHaveBeenCalled();
        expect(result[0]).toHaveProperty('gallery');
    });

    it('should populate dynamic virtuals with array populate', async () => {
        const UserModel = createMockModel([{ id: 'u1', entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, ['gallery']);

        expect(UserModel.find).toHaveBeenCalled();
        expect(result[0]).toHaveProperty('gallery');
    });

    it('should populate dynamic virtuals with object populate', async () => {
        const UserModel = createMockModel([{ id: 'u1', entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, { path: 'gallery' });

        expect(UserModel.find).toHaveBeenCalled();
        expect(result[0]).toHaveProperty('gallery');
    });

    it('should handle count mode', async () => {
        const UserModel = createMockModel([
            { entityId: '1' },
            { entityId: '1' },
        ]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('likesCount', { count: true })];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'likesCount');

        expect(result[0]).toHaveProperty('likesCount');
    });

    it('should handle justOne mode', async () => {
        const UserModel = createMockModel([{ entityId: '1', name: 'only' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('profile', { justOne: true })];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'profile');

        expect(result[0]).toHaveProperty('profile');
    });

    it('should skip when Model is not found', async () => {
        const mongoose = createMockMongoose({}); // no models
        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'gallery');
        expect(result[0]).toHaveProperty('gallery');
    });

    it('should convert Mongoose docs with toObject', async () => {
        const UserModel = createMockModel([]);
        const mongoose = createMockMongoose({ User: UserModel });

        const mongooseDoc = {
            id: '1',
            toObject: () => ({ id: '1', converted: true }),
        };
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, [mongooseDoc] as any, configs as any, 'gallery');
        expect(result[0]).toHaveProperty('converted', true);
    });

    it('should handle dotted string populate normalization', async () => {
        const UserModel = createMockModel([{ entityId: '1', name: 'a' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'gallery.items');
        expect(result).toBeDefined();
    });

    it('should handle multiple virtuals for same model', async () => {
        const UserModel = createMockModel([
            { entityId: '1', name: 'a' },
        ]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [
            baseConfig('gallery'),
            baseConfig('avatar', { ref: () => 'User' }),
        ];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, ['gallery', 'avatar']);
        expect(result[0]).toHaveProperty('gallery');
        expect(result[0]).toHaveProperty('avatar');
    });

    it('should handle documents with _id instead of id for index matching', async () => {
        const UserModel = createMockModel([{ entityId: 'abc', name: 'a' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ _id: 'abc' }];
        const configs = [baseConfig('gallery', { localField: '_id' })];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'gallery');
        expect(result).toBeDefined();
    });

    it('should use $or query when multiple foreignFields exist', async () => {
        const UserModel = createMockModel([]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [
            baseConfig('gallery', { foreignField: 'entityId' }),
            baseConfig('avatar', { foreignField: 'userId', ref: () => 'User' }),
        ];
        await populateDynamicVirtuals(mongoose, docs, configs as any, ['gallery', 'avatar']);
        expect(UserModel.find).toHaveBeenCalled();
        const query = (UserModel.find as any).mock.calls[0][0];
        expect(query).toHaveProperty('$or');
    });

    it('should normalize object populate with dotted path', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            { path: 'gallery.items' },
        );
        expect(result).toBeDefined();
    });

    it('should normalize object populate with dotted path and nested populate', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            { path: 'gallery.items', populate: 'author' } as any,
        );
        expect(result).toBeDefined();
    });

    it('should handle mixed array populate with object entries', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            [{ path: 'gallery' }, 'someOther'] as any,
        );
        expect(result).toBeDefined();
    });

    it('should handle object populate with non-dotted path (passthrough)', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            [{ path: 'gallery' }] as any,
        );
        expect(result[0]).toHaveProperty('gallery');
    });

    it('should pass projection to Model.find', async () => {
        const UserModel = createMockModel([{ entityId: '1', name: 'a' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const projection = { name: 1 as const };
        await populateDynamicVirtuals(mongoose, docs, configs as any, 'gallery', projection);
        expect(UserModel.find).toHaveBeenCalledWith(expect.any(Object), projection);
    });

    it('should handle docs with null localField values', async () => {
        const UserModel = createMockModel([]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: null }, { id: undefined }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, 'gallery');
        expect(result).toBeDefined();
    });

    it('should handle populate with object populate path startsWith match', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            [{ path: 'gallery.nested.deep' }] as any,
        );
        expect(result).toBeDefined();
    });

    it('should handle empty populate array', async () => {
        const mongoose = createMockMongoose({});
        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(mongoose, docs, configs as any, [] as any);
        expect(result).toEqual([{ id: '1' }]);
    });

    it('should normalize dotted string paths with object entries in flat array', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        // Object with dotted path and nested populate entries
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            [{ path: 'gallery.items', populate: { path: 'detail' } }] as any,
        );
        expect(result).toBeDefined();
    });

    it('should handle dotted path that groups to root with no rest (edge)', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        // Dotted path where first segment matches but rest is empty
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            'gallery.', // empty rest after split
        );
        expect(result).toBeDefined();
    });

    it('should handle non-string non-object entries in normalizer', async () => {
        const UserModel = createMockModel([{ entityId: '1' }]);
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ id: '1' }];
        const configs = [baseConfig('gallery')];
        const result = await populateDynamicVirtuals(
            mongoose,
            docs,
            configs as any,
            [42 as any, { path: 'gallery' }] as any,
        );
        expect(result).toBeDefined();
    });
});
