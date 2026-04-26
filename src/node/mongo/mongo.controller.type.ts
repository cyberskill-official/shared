import type { I_Return } from '#typescript/index.js';

import type { T_DeleteResult, T_UpdateResult, T_WithId } from './mongo.type.js';

/**
 * Shared controller interface for MongoDB operations.
 * Both `MongooseController` and `MongoController` implement this interface,
 * enabling polymorphic usage and dependency injection.
 *
 * ## Choosing a Controller
 * - **`MongooseController`** — Use when you need Mongoose features: schema validation,
 *   middleware hooks, virtual fields, population, pagination plugins, or slug generation.
 * - **`MongoController`** — Use for simple CRUD without Mongoose overhead. Ideal for
 *   lightweight services, migrations, or seed scripts using the native MongoDB driver.
 *
 * @example
 * ```typescript
 * // Dependency injection using the shared interface
 * class UserService {
 *   constructor(private db: I_MongoController<User>) {}
 *   async getUser(id: string) { return this.db.findOne({ id }); }
 * }
 * ```
 *
 * @template T - The document type for the collection.
 */
export interface I_MongoController<T> {
    /**
     * Creates a single document in the collection.
     *
     * @param document - The document to create.
     * @returns A standardized response with the created document.
     */
    createOne: (document: T | Partial<T>) => Promise<I_Return<T | Partial<T>>>;

    /**
     * Creates multiple documents in the collection.
     *
     * @param documents - The documents to create.
     * @returns A standardized response with the created documents.
     */
    createMany: (documents: (T | Partial<T>)[]) => Promise<I_Return<(T | Partial<T>)[]>>;

    /**
     * Finds a single document matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @returns A standardized response with the found document.
     */
    findOne: (filter?: unknown) => Promise<I_Return<T | T_WithId<T>>>;

    /**
     * Finds all documents matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @returns A standardized response with the found documents.
     */
    findAll: (filter?: unknown) => Promise<I_Return<T[] | T_WithId<T>[]>>;

    /**
     * Counts documents matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @returns A standardized response with the document count.
     */
    count: (filter?: unknown) => Promise<I_Return<number>>;

    /**
     * Updates a single document matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @param update - The update data.
     * @returns A standardized response with the update result.
     */
    updateOne: (filter: unknown, update: unknown) => Promise<I_Return<T_UpdateResult>>;

    /**
     * Updates multiple documents matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @param update - The update data.
     * @returns A standardized response with the update result.
     */
    updateMany: (filter: unknown, update: unknown) => Promise<I_Return<T_UpdateResult>>;

    /**
     * Deletes a single document matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @returns A standardized response with the delete result.
     */
    deleteOne: (filter: unknown) => Promise<I_Return<T_DeleteResult>>;

    /**
     * Deletes multiple documents matching the filter criteria.
     *
     * @param filter - The filter criteria.
     * @returns A standardized response with the delete result.
     */
    deleteMany: (filter: unknown) => Promise<I_Return<T_DeleteResult>>;
}
