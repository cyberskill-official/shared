/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import type { I_ReturnSuccess } from '../../typescript/common.type.js';
import type { I_ExtendedModel } from './mongo.type.js';

import { MongooseController } from './mongo.controller.mongoose.js';

/** Narrows I_Return to I_ReturnSuccess and asserts success. */
function expectSuccess<T>(result: { success: boolean }): asserts result is I_ReturnSuccess<T> {
    expect(result.success).toBe(true);
}

vi.mock('@dotenvx/dotenvx', () => ({
    default: { config: vi.fn() },
}));

vi.mock('../log/index.js', () => ({
    catchError: vi.fn((err: any) => ({ success: false, message: err?.message || 'error', code: 500 })),
    log: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

/**
 *
 */
function createMockQuery(result: unknown) {
    const query = {
        maxTimeMS: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(result),
        then: vi.fn((resolve: (value: unknown) => void) => resolve(result)),
    };
    return query;
}

/**
 *
 */
function createMockModel(overrides: Record<string, unknown> = {}) {
    return {
        modelName: 'TestModel',
        findOne: vi.fn(() => createMockQuery(null)),
        find: vi.fn(() => createMockQuery([])),
        countDocuments: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ name: 'test' }),
        insertMany: vi.fn().mockResolvedValue([]),
        findOneAndUpdate: vi.fn(() => createMockQuery(null)),
        updateMany: vi.fn(() => createMockQuery({ modifiedCount: 0 })),
        findOneAndDelete: vi.fn(() => createMockQuery(null)),
        deleteMany: vi.fn(() => createMockQuery({ deletedCount: 0 })),
        exists: vi.fn().mockResolvedValue(null),
        paginate: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
        aggregatePaginate: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
        aggregate: vi.fn().mockReturnValue([]),
        distinct: vi.fn().mockResolvedValue([]),
        schema: { statics: {} },
        base: {},
        ...overrides,
    } as unknown as I_ExtendedModel<any>;
}

describe('MongooseController', () => {
    describe('findOne', () => {
        it('should return success with result when document found', async () => {
            const doc = { _id: '1', name: 'test' };
            const mockModel = createMockModel({
                findOne: vi.fn(() => createMockQuery(doc)),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.findOne({ name: 'test' });

            expectSuccess(result);
            expect(result.result).toEqual(doc);
        });

        it('should return not found when document does not exist', async () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);
            const result = await controller.findOne({ name: 'nonexistent' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('TestModel not found');
            expect(result.code).toBe(404);
        });

        it('should handle errors gracefully', async () => {
            const mockModel = createMockModel({
                findOne: vi.fn(() => { throw new Error('DB error'); }),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.findOne({});

            expect(result.success).toBe(false);
        });
    });

    describe('findAll', () => {
        it('should return success with array of documents', async () => {
            const docs = [{ _id: '1', name: 'a' }, { _id: '2', name: 'b' }];
            const mockModel = createMockModel({
                find: vi.fn(() => createMockQuery(docs)),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.findAll();

            expectSuccess(result);
            expect(result.result).toEqual(docs);
        });

        it('should return empty array when no documents found', async () => {
            const mockModel = createMockModel({
                find: vi.fn(() => createMockQuery([])),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.findAll();

            expectSuccess(result);
            expect(result.result).toEqual([]);
        });

        it('should apply default limit of 1000 when no limit specified', async () => {
            const query = createMockQuery([]);
            const mockModel = createMockModel({
                find: vi.fn(() => query),
            });

            const controller = new MongooseController(mockModel);
            await controller.findAll();

            expect(query.limit).toHaveBeenCalledWith(1_000);
        });
    });

    describe('count', () => {
        it('should return document count', async () => {
            const mockModel = createMockModel({
                countDocuments: vi.fn().mockResolvedValue(42),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.count();

            expectSuccess(result);
            expect(result.result).toBe(42);
        });

        it('should handle count errors', async () => {
            const mockModel = createMockModel({
                countDocuments: vi.fn().mockRejectedValue(new Error('DB error')),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.count();

            expect(result.success).toBe(false);
        });
    });

    describe('createOne', () => {
        it('should create and return document', async () => {
            const doc = { name: 'test' };
            const mockModel = createMockModel({
                create: vi.fn().mockResolvedValue(doc),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.createOne(doc);

            expectSuccess(result);
            expect(result.result).toEqual(doc);
        });

        it('should handle creation errors', async () => {
            const mockModel = createMockModel({
                create: vi.fn().mockRejectedValue(new Error('Duplicate key')),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.createOne({ name: 'test' });

            expect(result.success).toBe(false);
        });
    });

    describe('createMany', () => {
        it('should create multiple documents', async () => {
            const docs = [{ name: 'a' }, { name: 'b' }];
            const mockModel = createMockModel({
                insertMany: vi.fn().mockResolvedValue(docs),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.createMany(docs);

            expectSuccess(result);
            expect(result.result).toEqual(docs);
        });
    });

    describe('updateOne', () => {
        it('should return updated document on success', async () => {
            const updatedDoc = { _id: '1', name: 'updated' };
            const mockModel = createMockModel({
                findOneAndUpdate: vi.fn(() => createMockQuery(updatedDoc)),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.updateOne({ _id: '1' }, { name: 'updated' });

            expectSuccess(result);
            expect(result.result).toEqual(updatedDoc);
        });

        it('should return not found when document does not exist', async () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);
            const result = await controller.updateOne({ _id: 'nonexistent' }, { name: 'updated' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('TestModel not found');
        });
    });

    describe('updateMany', () => {
        it('should return update result', async () => {
            const updateResult = { modifiedCount: 5 };
            const mockModel = createMockModel({
                updateMany: vi.fn(() => createMockQuery(updateResult)),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.updateMany({}, { name: 'bulk' });

            expectSuccess(result);
            expect(result.result).toEqual(updateResult);
        });
    });

    describe('deleteOne', () => {
        it('should return deleted document on success', async () => {
            const deletedDoc = { _id: '1', name: 'deleted' };
            const mockModel = createMockModel({
                findOneAndDelete: vi.fn(() => createMockQuery(deletedDoc)),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.deleteOne({ _id: '1' });

            expectSuccess(result);
            expect(result.result).toEqual(deletedDoc);
        });

        it('should return not found when no document to delete', async () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);
            const result = await controller.deleteOne({ _id: 'nonexistent' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('TestModel not found');
        });
    });

    describe('deleteMany', () => {
        it('should return delete result on success', async () => {
            const deleteResult = { deletedCount: 3 };
            const mockModel = createMockModel({
                deleteMany: vi.fn(() => createMockQuery(deleteResult)),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.deleteMany({ isDel: true });

            expectSuccess(result);
            expect(result.result).toEqual(deleteResult);
        });

        it('should return not found when no documents deleted', async () => {
            const mockModel = createMockModel({
                deleteMany: vi.fn(() => createMockQuery({ deletedCount: 0 })),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.deleteMany({ isDel: true });

            expect(result.success).toBe(false);
            expect(result.message).toContain('documents not found');
        });
    });

    describe('findPaging', () => {
        it('should return paginated results', async () => {
            const paginateResult = {
                docs: [{ name: 'test' }],
                totalDocs: 1,
                limit: 10,
                page: 1,
            };
            const mockModel = createMockModel({
                paginate: vi.fn().mockResolvedValue(paginateResult),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.findPaging({}, { limit: 10, page: 1 });

            expectSuccess(result);
            expect(result.result?.docs).toEqual(paginateResult.docs);
        });
    });

    describe('aggregate', () => {
        it('should return aggregation results', async () => {
            const aggResult = [{ _id: 'group1', count: 5 }];
            const mockModel = createMockModel({
                aggregate: vi.fn().mockResolvedValue(aggResult),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);

            expectSuccess(result);
            expect(result.result).toEqual(aggResult);
        });
    });

    describe('distinct', () => {
        it('should return distinct values', async () => {
            const distinctResult = ['a', 'b', 'c'];
            const mockModel = createMockModel({
                distinct: vi.fn().mockResolvedValue(distinctResult),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.distinct('name');

            expectSuccess(result);
            expect(result.result).toEqual(distinctResult);
        });

        it('should handle errors gracefully', async () => {
            const mockModel = createMockModel({
                distinct: vi.fn().mockRejectedValue(new Error('DB error')),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.distinct('name');

            expect(result.success).toBe(false);
        });

        it('should normalize nested filters to dot notation', async () => {
            const mockDistinct = vi.fn().mockResolvedValue([]);
            const mockModel = createMockModel({
                distinct: mockDistinct,
            });

            const controller = new MongooseController(mockModel);
            await controller.distinct('name', { location: { countryId: '240' } } as any);

            // normalizeMongoFilter should flatten { location: { countryId: '240' } }
            // into { 'location.countryId': '240' }
            expect(mockDistinct).toHaveBeenCalledWith(
                'name',
                { 'location.countryId': '240' },
                {},
            );
        });
    });

    describe('createUniqueSlug', () => {
        it('should return base slug when available', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue(null),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.createUniqueSlug({
                slug: 'Hello World',
                field: 'slug',
                isObject: false,
            });

            expect(result).toBe('hello-world');
        });

        it('should append incremental number when slug exists', async () => {
            const mockExists = vi.fn().mockResolvedValue({ _id: '1' });
            const findQuery = createMockQuery([
                { slug: 'hello-world-1' },
            ]);
            const mockModel = createMockModel({
                exists: mockExists,
                find: vi.fn(() => findQuery),
            });
            const controller = new MongooseController(mockModel);

            const result = await controller.createUniqueSlug({
                slug: 'hello-world',
                field: 'slug',
                isObject: false,
            });

            expect(result).toBe('hello-world-2');
            expect(mockExists).toHaveBeenCalledTimes(1);
        });

        it('should throw for empty slug', async () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);

            await expect(controller.createUniqueSlug({
                slug: '',
                field: 'slug',
                isObject: false,
            })).rejects.toThrow('Invalid slug provided');
        });
    });

    describe('createSlugQuery', () => {
        it('should create simple query for non-object slugs', () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);

            const query = controller.createSlugQuery({
                slug: 'test-slug',
                field: 'slug',
                isObject: false,
            });

            expect(query.$or).toContainEqual({ slug: 'test-slug' });
        });

        it('should create object query for object slugs', () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);

            const query = controller.createSlugQuery({
                slug: 'test-slug',
                field: 'en',
                isObject: true,
            });

            expect(query.$or).toContainEqual({ 'slug.en': 'test-slug' });
        });

        it('should include history check when haveHistory is true', () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);

            const query = controller.createSlugQuery({
                slug: 'test-slug',
                field: 'slug',
                isObject: false,
                haveHistory: true,
            });

            expect(query.$or).toHaveLength(2);
            expect(query.$or).toContainEqual({ slugHistory: 'test-slug' });
        });
    });

    describe('createShortId', () => {
        it('should return available short ID', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue(null),
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.createShortId('507f1f77bcf86cd799439011');

            expectSuccess(result);
            expect(typeof result.result).toBe('string');
        });

        it('should fail when all short IDs taken', async () => {
            // Generate the same shortIds that createShortId would generate
            const mockFind = vi.fn(() => createMockQuery(
                Array.from({ length: 10 }, (_, i) => ({ shortId: `shortid_${i}` })),
            ));
            const mockModel = createMockModel({
                find: mockFind,
            });

            // Override the find mock to return docs matching ALL generated shortIds
            (mockModel as any).find = vi.fn(() => {
                const query = createMockQuery([]);
                // When find is called with { shortId: { $in: [...] } },
                // return all shortIds as existing
                query.exec = vi.fn(async () => {
                    const callArgs = (mockModel as any).find.mock.calls[0]?.[0];
                    const shortIds = callArgs?.shortId?.$in ?? [];
                    return shortIds.map((s: string) => ({ shortId: s }));
                });
                query.then = vi.fn((resolve: (v: unknown) => void) => {
                    return query.exec().then(resolve);
                });
                return query;
            });

            const controller = new MongooseController(mockModel);
            const result = await controller.createShortId('507f1f77bcf86cd799439011');

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to create a unique shortId');
        });
    });

    describe('findAll (branch coverage)', () => {
        it('should apply default limit when options.limit is not set', async () => {
            const query = createMockQuery([]);
            const mockModel = createMockModel({ find: vi.fn(() => query) });
            const controller = new MongooseController(mockModel);
            await controller.findAll();
            expect(query.limit).toHaveBeenCalledWith(1_000);
        });

        it('should not apply default limit when options.limit is set', async () => {
            const query = createMockQuery([]);
            const mockModel = createMockModel({ find: vi.fn(() => query) });
            const controller = new MongooseController(mockModel);
            await controller.findAll({}, {}, { limit: 5 } as any);
            expect(query.limit).not.toHaveBeenCalledWith(1_000);
        });

        it('should call populate when populate is provided', async () => {
            const query = createMockQuery([]);
            const mockModel = createMockModel({ find: vi.fn(() => query) });
            const controller = new MongooseController(mockModel);
            await controller.findAll({}, {}, {}, 'author');
            expect(query.populate).toHaveBeenCalled();
        });
    });

    describe('findOne (branch coverage)', () => {
        it('should call populate when provided', async () => {
            const query = createMockQuery({ name: 'test', toObject: () => ({ name: 'test' }) });
            const mockModel = createMockModel({ findOne: vi.fn(() => query) });
            const controller = new MongooseController(mockModel);
            const result = await controller.findOne({}, {}, {}, 'author');
            expect(query.populate).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    describe('findPaging (branch coverage)', () => {
        it('should filter populate options when provided', async () => {
            const mockModel = createMockModel({
                paginate: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.findPaging({}, { populate: 'author' } as any);
            expect(result.success).toBe(true);
        });
    });

    describe('findPagingAggregate (branch coverage)', () => {
        it('should filter populate options when provided', async () => {
            const mockModel = createMockModel({
                aggregatePaginate: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
                aggregate: vi.fn().mockReturnValue([]),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.findPagingAggregate([{ $match: {} }], { populate: 'author' } as any);
            expect(result.success).toBe(true);
        });
    });

    describe('getDynamicVirtuals (branch coverage)', () => {
        it('should read from _virtualConfigs when available', async () => {
            const mockModel = createMockModel({
                _virtualConfigs: [{ name: 'ref', options: { ref: () => 'Model' } }],
            });
            const controller = new MongooseController(mockModel);
            // Test indirectly through findOne
            const query = createMockQuery({ name: 'test', toObject: () => ({ name: 'test' }) });
            (mockModel as any).findOne = vi.fn(() => query);
            const result = await controller.findOne();
            expect(result.success).toBe(true);
        });

        it('should use schema statics when _virtualConfigs has no dynamic refs', async () => {
            const mockModel = createMockModel({
                _virtualConfigs: [{ name: 'staticRef', options: { ref: 'StaticModel' } }],
            });
            const controller = new MongooseController(mockModel);
            const query = createMockQuery({ name: 'test', toObject: () => ({ name: 'test' }) });
            (mockModel as any).findOne = vi.fn(() => query);
            const result = await controller.findOne();
            expect(result.success).toBe(true);
        });
    });

    describe('createSlug (branch coverage)', () => {
        it('should create slug for object field value', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue(null),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.createSlug({
                field: 'title',
                from: { title: { en: 'Hello World', tr: 'Merhaba Dünya' } } as any,
            });
            expect(result.success).toBe(true);
        });

        it('should create slug for simple string field', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue(null),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.createSlug({
                field: 'name',
                from: { name: 'Hello World' } as any,
            });
            expect(result.success).toBe(true);
        });
    });

    describe('checkSlug (branch coverage)', () => {
        it('should check slug existence for object field', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue(null),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.checkSlug({
                slug: 'hello',
                field: 'title',
                from: { title: { en: 'Hello', tr: 'Merhaba' } } as any,
            });
            expectSuccess(result);
            expect(result.result).toBe(false);
        });

        it('should return true when object slug exists', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue({ _id: '1' }),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.checkSlug({
                slug: 'hello',
                field: 'title',
                from: { title: { en: 'Hello' } } as any,
            });
            expectSuccess(result);
            expect(result.result).toBe(true);
        });

        it('should check slug existence for simple string', async () => {
            const mockModel = createMockModel({
                exists: vi.fn().mockResolvedValue(null),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.checkSlug({
                slug: 'hello-world',
                field: 'slug',
                from: { slug: 'Hello World' } as any,
            });
            expectSuccess(result);
            expect(result.result).toBe(false);
        });
    });

    describe('deleteMany (branch coverage)', () => {
        it('should return not found when no documents deleted', async () => {
            const mockModel = createMockModel({
                deleteMany: vi.fn(() => createMockQuery({ deletedCount: 0 })),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.deleteMany({ isDel: true } as any);
            expect(result.success).toBe(false);
            expect(result.message).toContain('documents not found');
        });

        it('should return success when documents were deleted', async () => {
            const mockModel = createMockModel({
                deleteMany: vi.fn(() => createMockQuery({ deletedCount: 3 })),
            });
            const controller = new MongooseController(mockModel);
            const result = await controller.deleteMany({ isDel: true } as any);
            expect(result.success).toBe(true);
        });
    });

    describe('createSlugQuery (branch coverage)', () => {
        it('should include history for object slugs with haveHistory', () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);
            const query = controller.createSlugQuery({
                slug: 'test',
                field: 'en',
                isObject: true,
                haveHistory: true,
            });
            expect(query.$or).toHaveLength(2);
        });

        it('should apply filter to query', () => {
            const mockModel = createMockModel();
            const controller = new MongooseController(mockModel);
            const query = controller.createSlugQuery({
                slug: 'test',
                field: 'slug',
                isObject: false,
                filter: { isDel: false } as any,
            });
            expect(query['isDel']).toBe(false);
        });
    });
});
