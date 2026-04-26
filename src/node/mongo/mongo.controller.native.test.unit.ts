/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import type { I_ReturnSuccess } from '../../typescript/common.type.js';
import type { C_Db } from './mongo.type.js';

import { createMongoController, MongoController } from './mongo.controller.native.js';

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

/** Narrows I_Return to I_ReturnSuccess and asserts success. */
function expectSuccess<T>(result: { success: boolean }): asserts result is I_ReturnSuccess<T> {
    expect(result.success).toBe(true);
}

/**
 *
 */
function createMockCollection(overrides: Record<string, unknown> = {}) {
    return {
        insertOne: vi.fn().mockResolvedValue({ acknowledged: true, insertedId: '1' }),
        insertMany: vi.fn().mockResolvedValue({ insertedCount: 2 }),
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnThis(),
            maxTimeMS: vi.fn().mockReturnThis(),
            toArray: vi.fn().mockResolvedValue([]),
        }),
        countDocuments: vi.fn().mockResolvedValue(0),
        updateOne: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
        updateMany: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
        ...overrides,
    };
}

/**
 *
 */
function createMockDb(collectionOverrides: Record<string, unknown> = {}) {
    const coll = createMockCollection(collectionOverrides);
    return {
        db: { collection: vi.fn().mockReturnValue(coll) } as unknown as C_Db,
        collection: coll,
    };
}

describe('MongoController (Native)', () => {
    describe('createOne', () => {
        it('should create document with generic fields and return success', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.createOne({ name: 'test' } as any);

            expectSuccess(result);
            expect(result.result).toHaveProperty('id');
            expect(result.result).toHaveProperty('isDel', false);
            expect(result.result).toHaveProperty('createdAt');
            expect(result.result).toHaveProperty('updatedAt');
        });

        it('should return failure when insert not acknowledged', async () => {
            const { db } = createMockDb({
                insertOne: vi.fn().mockResolvedValue({ acknowledged: false }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.createOne({ name: 'test' } as any);

            expect(result.success).toBe(false);
            expect(result.message).toContain('creation failed');
        });

        it('should handle errors', async () => {
            const { db } = createMockDb({
                insertOne: vi.fn().mockRejectedValue(new Error('Connection lost')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.createOne({ name: 'test' } as any);

            expect(result.success).toBe(false);
        });
    });

    describe('createMany', () => {
        it('should create multiple documents with generic fields', async () => {
            const { db } = createMockDb({
                insertMany: vi.fn().mockResolvedValue({ insertedCount: 2 }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.createMany([{ name: 'a' }, { name: 'b' }] as any);

            expectSuccess(result);
            expect(result.result).toHaveLength(2);
            expect(result.result?.[0]).toHaveProperty('id');
        });

        it('should return failure when no documents inserted', async () => {
            const { db } = createMockDb({
                insertMany: vi.fn().mockResolvedValue({ insertedCount: 0 }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.createMany([{ name: 'a' }] as any);

            expect(result.success).toBe(false);
            expect(result.message).toContain('No documents were inserted');
        });

        it('should handle errors in createMany', async () => {
            const { db } = createMockDb({
                insertMany: vi.fn().mockRejectedValue(new Error('Connection lost')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.createMany([{ name: 'a' }] as any);

            expect(result.success).toBe(false);
        });
    });

    describe('findOne', () => {
        it('should return document on success', async () => {
            const doc = { _id: '1', name: 'found' };
            const { db } = createMockDb({
                findOne: vi.fn().mockResolvedValue(doc),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.findOne({ name: 'found' });

            expectSuccess(result);
            expect(result.result).toEqual(doc);
        });

        it('should return not found when document missing', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.findOne({ name: 'missing' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
            expect(result.code).toBe(404);
        });
    });

    describe('findAll', () => {
        it('should return all matching documents', async () => {
            const docs = [{ _id: '1', name: 'a' }, { _id: '2', name: 'b' }];
            const { db } = createMockDb({
                find: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnThis(),
                    maxTimeMS: vi.fn().mockReturnThis(),
                    toArray: vi.fn().mockResolvedValue(docs),
                }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.findAll();

            expectSuccess(result);
            expect(result.result).toEqual(docs);
        });
    });

    describe('count', () => {
        it('should return document count', async () => {
            const { db } = createMockDb({
                countDocuments: vi.fn().mockResolvedValue(42),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.count();

            expectSuccess(result);
            expect(result.result).toBe(42);
        });
    });

    describe('updateOne', () => {
        it('should return success when document matched', async () => {
            const { db } = createMockDb({
                updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.updateOne({ _id: '1' } as any, { name: 'updated' } as any);

            expect(result.success).toBe(true);
        });

        it('should return failure when no document matched', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.updateOne({ _id: 'nonexistent' } as any, { name: 'updated' } as any);

            expect(result.success).toBe(false);
            expect(result.message).toContain('No documents matched');
            expect(result.code).toBe(404);
        });

        it('should handle errors in updateOne', async () => {
            const { db } = createMockDb({
                updateOne: vi.fn().mockRejectedValue(new Error('Connection lost')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.updateOne({ _id: '1' } as any, { name: 'updated' } as any);

            expect(result.success).toBe(false);
        });
    });

    describe('updateMany', () => {
        it('should return success when documents matched', async () => {
            const { db } = createMockDb({
                updateMany: vi.fn().mockResolvedValue({ matchedCount: 3, modifiedCount: 3 }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.updateMany({}, { active: true } as any);

            expect(result.success).toBe(true);
        });

        it('should return failure when no documents matched', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.updateMany({ _id: 'none' } as any, { active: true } as any);

            expect(result.success).toBe(false);
            expect(result.code).toBe(404);
        });

        it('should handle errors in updateMany', async () => {
            const { db } = createMockDb({
                updateMany: vi.fn().mockRejectedValue(new Error('Connection lost')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.updateMany({}, { active: true } as any);

            expect(result.success).toBe(false);
        });
    });

    describe('deleteOne', () => {
        it('should return success when document deleted', async () => {
            const { db } = createMockDb({
                deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.deleteOne({ _id: '1' } as any);

            expect(result.success).toBe(true);
        });

        it('should return failure when no document deleted', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.deleteOne({ _id: 'nonexistent' } as any);

            expect(result.success).toBe(false);
            expect(result.code).toBe(404);
        });

        it('should handle errors in deleteOne', async () => {
            const { db } = createMockDb({
                deleteOne: vi.fn().mockRejectedValue(new Error('Connection lost')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.deleteOne({ _id: '1' } as any);

            expect(result.success).toBe(false);
        });
    });

    describe('deleteMany', () => {
        it('should return success when documents deleted', async () => {
            const { db } = createMockDb({
                deleteMany: vi.fn().mockResolvedValue({ deletedCount: 5 }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.deleteMany({ isDel: true });

            expect(result.success).toBe(true);
        });

        it('should return failure when no documents deleted', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.deleteMany({ isDel: true });

            expect(result.success).toBe(false);
            expect(result.code).toBe(404);
        });

        it('should handle errors in deleteMany', async () => {
            const { db } = createMockDb({
                deleteMany: vi.fn().mockRejectedValue(new Error('Connection lost')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.deleteMany({});

            expect(result.success).toBe(false);
        });
    });

    describe('bulkWrite', () => {
        it('should execute bulk write operations successfully', async () => {
            const { db } = createMockDb({
                bulkWrite: vi.fn().mockResolvedValue({
                    insertedCount: 2,
                    matchedCount: 0,
                    modifiedCount: 0,
                    deletedCount: 0,
                    upsertedCount: 0,
                }),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.bulkWrite([
                { insertOne: { document: { name: 'a' } } } as any,
                { insertOne: { document: { name: 'b' } } } as any,
            ]);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Bulk write executed');
        });

        it('should return error when no operations provided', async () => {
            const { db } = createMockDb();
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.bulkWrite([]);

            expect(result.success).toBe(false);
            expect(result.message).toContain('No bulk write operations');
        });

        it('should handle bulkWrite errors', async () => {
            const { db } = createMockDb({
                bulkWrite: vi.fn().mockRejectedValue(new Error('Write conflict')),
            });
            const controller = new MongoController(db, 'testCollection');

            const result = await controller.bulkWrite([
                { insertOne: { document: { name: 'a' } } } as any,
            ]);

            expect(result.success).toBe(false);
        });
    });

    describe('createMongoController', () => {
        it('should create and return a native MongoController instance', () => {
            const { db } = createMockDb();
            const controller = createMongoController(db, 'factoryCollection', { defaultLimit: 50 });

            expect(controller).toBeInstanceOf(MongoController);
            // Since db and collection properties are private, we just test if the returned instance is correct
            expect(controller).toHaveProperty('findAll');
            expect(controller).toHaveProperty('findOne');
        });
    });
});
