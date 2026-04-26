import type { I_Return } from '#typescript/index.js';

import type { C_Collection, C_Db, C_Document, T_BulkWriteOperation, T_BulkWriteResult, T_DeleteResult, T_Filter, T_OptionalUnlessRequiredId, T_UpdateResult, T_WithId } from './mongo.type.js';

import { catchError, log } from '../log/index.js';
import { MONGO_MAX_TIME_MS } from './mongo.constant.js';
import { wrapError, wrapNotFound } from './mongo.controller.helpers.js';
import { mongo } from './mongo.util.js';

/**
 * MongoDB native driver controller for direct database operations.
 * This class provides a simplified interface for MongoDB operations using the native driver,
 * with automatic generic field generation and standardized response formatting.
 *
 * @see I_MongoController for the shared polymorphic interface (use via type assertion when needed).
 */
export class MongoController<D extends Partial<C_Document>> {
    private collection: C_Collection<D>;
    private defaultLimit: number;
    private collectionName: string;

    /**
     * Creates a new MongoDB controller instance.
     *
     * @param db - The MongoDB database instance.
     * @param collectionName - The name of the collection to operate on.
     * @param options - Optional configuration for the controller.
     * @param options.defaultLimit - Maximum documents returned by findAll when no limit is specified (default: 1,000).
     */
    constructor(db: C_Db, collectionName: string, options?: { defaultLimit?: number }) {
        this.collection = db.collection<D>(collectionName);
        this.collectionName = collectionName;
        this.defaultLimit = options?.defaultLimit ?? 1_000;
    }

    /**
     * Creates a single document in the collection.
     * This method adds generic fields (id, isDel, timestamps) to the document before insertion.
     *
     * @param document - The document to create, with or without generic fields.
     * @returns A promise that resolves to a standardized response with the created document.
     */
    async createOne(document: D | Partial<D>): Promise<I_Return<D | Partial<D>>> {
        try {
            const finalDocument = {
                ...mongo.createGenericFields(),
                ...document,
            };

            const result = await this.collection.insertOne(finalDocument as unknown as T_OptionalUnlessRequiredId<D>);

            if (!result.acknowledged) {
                return wrapError('Document creation failed');
            }

            return {
                success: true,
                message: 'Document created successfully',
                result: finalDocument,
            };
        }
        catch (error: unknown) {
            return catchError<(D | Partial<D>)>(error);
        }
    }

    /**
     * Creates multiple documents in the collection.
     * This method adds generic fields to each document before bulk insertion.
     *
     * @param documents - An array of documents to create.
     * @returns A promise that resolves to a standardized response with the created documents.
     */
    async createMany(documents: (D | Partial<D>)[]): Promise<I_Return<(D | Partial<D>)[]>> {
        try {
            const finalDocuments = documents.map(document => ({
                ...mongo.createGenericFields(),
                ...document,
            }));

            const result = await this.collection.insertMany(finalDocuments as unknown as T_OptionalUnlessRequiredId<D>[]);

            if (result.insertedCount === 0) {
                return wrapError('No documents were inserted');
            }

            return {
                success: true,
                message: `${result.insertedCount} documents created successfully`,
                result: finalDocuments,
            };
        }
        catch (error: unknown) {
            return catchError<(D | Partial<D>)[]>(error);
        }
    }

    /**
     * Finds a single document by filter criteria.
     *
     * @param filter - The filter criteria to find the document.
     * @returns A promise that resolves to a standardized response with the found document.
     */
    async findOne(filter: T_Filter<D>): Promise<I_Return<T_WithId<D>>> {
        try {
            const result = await this.collection.findOne(filter, { maxTimeMS: MONGO_MAX_TIME_MS });

            if (!result) {
                return wrapNotFound('Document');
            }

            return { success: true, message: 'Document found', result };
        }
        catch (error: unknown) {
            return catchError<T_WithId<D>>(error);
        }
    }

    /**
     * Finds all documents matching the filter criteria.
     *
     * @param filter - The filter criteria to find documents (defaults to empty object for all documents).
     * @returns A promise that resolves to a standardized response with the found documents.
     */
    async findAll(
        filter: T_Filter<D> = {},
        options?: { skip?: number; limit?: number },
    ): Promise<I_Return<T_WithId<D>[]>> {
        try {
            const limit = options?.limit ?? this.defaultLimit;
            let query = this.collection.find(filter).limit(limit).maxTimeMS(MONGO_MAX_TIME_MS);

            if (options?.skip) {
                query = query.skip(options.skip);
            }

            const result = await query.toArray();

            const truncated = result.length === limit;

            if (truncated) {
                log.warn(`[${this.collectionName}] findAll returned exactly ${limit} documents (the limit). Results may be truncated. Consider using pagination or setting an explicit limit.`);
            }

            return {
                success: true,
                message: 'Documents retrieved successfully',
                result,
                truncated,
            };
        }
        catch (error: unknown) {
            return catchError<T_WithId<D>[]>(error);
        }
    }

    /**
     * Counts documents matching the filter criteria.
     *
     * @param filter - The filter criteria to count documents (defaults to empty object for all documents).
     * @returns A promise that resolves to a standardized response with the document count.
     */
    async count(
        filter: T_Filter<D> = {},
    ): Promise<I_Return<number>> {
        try {
            const result = await this.collection.countDocuments(filter);

            return {
                success: true,
                message: `${result} documents counted successfully`,
                result,
            };
        }
        catch (error: unknown) {
            return catchError<number>(error);
        }
    }

    /**
     * Updates a single document matching the filter criteria.
     *
     * @param filter - The filter criteria to find the document to update.
     * @param update - The update data to apply to the document.
     * @returns A promise that resolves to a standardized response with the update result.
     */
    async updateOne(
        filter: T_Filter<D>,
        update: Partial<D>,
    ): Promise<I_Return<T_UpdateResult>> {
        try {
            const result = await this.collection.updateOne(filter, {
                $set: update,
            });

            if (result.matchedCount === 0) {
                return wrapNotFound('No documents matched the filter');
            }
            return {
                success: true,
                message: 'Document updated successfully',
                result,
            };
        }
        catch (error: unknown) {
            return catchError<T_UpdateResult>(error);
        }
    }

    /**
     * Updates multiple documents matching the filter criteria.
     *
     * @param filter - The filter criteria to find documents to update.
     * @param update - The update data to apply to the documents.
     * @returns A promise that resolves to a standardized response with the update result.
     */
    async updateMany(
        filter: T_Filter<D>,
        update: Partial<D>,
    ): Promise<I_Return<T_UpdateResult>> {
        try {
            const result = await this.collection.updateMany(filter, {
                $set: update,
            });

            if (result.matchedCount === 0) {
                return wrapNotFound('No documents matched the filter');
            }

            return {
                success: true,
                message: 'Documents updated successfully',
                result,
            };
        }
        catch (error: unknown) {
            return catchError<T_UpdateResult>(error);
        }
    }

    /**
     * Deletes a single document matching the filter criteria.
     *
     * @param filter - The filter criteria to find the document to delete.
     * @returns A promise that resolves to a standardized response with the delete result.
     */
    async deleteOne(
        filter: T_Filter<D>,
    ): Promise<I_Return<T_DeleteResult>> {
        try {
            const result = await this.collection.deleteOne(filter);

            if (result.deletedCount === 0) {
                return wrapNotFound('No documents matched the filter');
            }
            return {
                success: true,
                message: 'Document deleted successfully',
                result,
            };
        }
        catch (error: unknown) {
            return catchError<T_DeleteResult>(error);
        }
    }

    /**
     * Deletes multiple documents matching the filter criteria.
     *
     * @param filter - The filter criteria to find documents to delete.
     * @returns A promise that resolves to a standardized response with the delete result.
     */
    async deleteMany(
        filter: T_Filter<D>,
    ): Promise<I_Return<T_DeleteResult>> {
        try {
            const result = await this.collection.deleteMany(filter);

            if (result.deletedCount === 0) {
                return wrapNotFound('No documents matched the filter');
            }

            return {
                success: true,
                message: 'Documents deleted successfully',
                result,
            };
        }
        catch (error: unknown) {
            return catchError<T_DeleteResult>(error);
        }
    }

    /**
     * Executes multiple write operations in a single batch.
     * Use this for high-performance ingestion or batched updates.
     * Note: This method does NOT automatically add generic fields (id, timestamps)
     * to the documents. If required, inject these fields before invoking bulkWrite.
     *
     * @param operations - The array of bulk write operations.
     * @returns A promise that resolves to a standardized response with the bulk write result.
     */
    async bulkWrite(
        operations: T_BulkWriteOperation<D>[],
    ): Promise<I_Return<T_BulkWriteResult>> {
        try {
            if (!operations.length) {
                return wrapError('No bulk write operations provided');
            }

            const result = await this.collection.bulkWrite(operations);

            return {
                success: true,
                message: 'Bulk write executed successfully',
                result,
            };
        }
        catch (error: unknown) {
            return catchError<T_BulkWriteResult>(error);
        }
    }
}

/**
 * Factory function to create a native MongoController.
 * Use this method to construct controllers in migration scripts or services.
 *
 * @param db - The MongoDB database instance.
 * @param collectionName - The name of the collection.
 * @param options - Controller options.
 * @param options.defaultLimit - Optional default limit for pagination.
 * @returns A new MongoController instance for the given collection.
 * @since 3.13.0
 */
export function createMongoController<D extends Partial<C_Document>>(
    db: C_Db,
    collectionName: string,
    options?: { defaultLimit?: number },
): MongoController<D> {
    return new MongoController<D>(db, collectionName, options);
}
