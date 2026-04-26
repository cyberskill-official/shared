import type { I_Return } from '#typescript/index.js';

import { RESPONSE_STATUS } from '#constant/index.js';
import { isObject } from '#util/common/index.js';
import { normalizeMongoFilter } from '#util/index.js';
import { generateRandomString, generateShortId, generateSlug } from '#util/string/index.js';

import type { C_Document, I_DeleteOptionsExtended, I_DynamicVirtualConfig, I_ExtendedModel, I_Input_CheckSlug, I_Input_CreateSlug, I_Input_GenerateSlug, I_PaginateOptionsWithPopulate, I_UpdateOptionsExtended, T_AggregatePaginateResult, T_DeleteResult, T_Input_Populate, T_InsertManyOptions, T_PaginateResult, T_PipelineStage, T_PopulateOptions, T_ProjectionType, T_QueryFilter, T_QueryOptions, T_UpdateQuery, T_UpdateResult } from './mongo.type.js';

import { catchError, log } from '../log/index.js';
import { MONGO_MAX_TIME_MS, MONGO_SLUG_MAX_ATTEMPTS } from './mongo.constant.js';
import { wrapNotFound } from './mongo.controller.helpers.js';
import { filterDynamicVirtualsFromPopulate, populateDynamicVirtuals } from './mongo.dynamic-populate.js';
/**
 * Converts a Mongoose document to a plain object, handling the case where
 * the document may already be a plain object (e.g., from `.lean()`).
 *
 * @param doc - The document or plain object.
 * @returns The plain object representation.
 */
function toPlainObject<T>(doc: T): T {
    return (doc as T & { toObject?: () => T })?.toObject?.() ?? doc;
}

/** Internal shape of a single virtual config stored on the model. */
interface I_VirtualConfig {
    name: string;
    options?: { ref?: unknown };
}

/**
 * Mongoose controller for database operations with advanced features.
 * This class provides a comprehensive interface for Mongoose operations including
 * pagination, aggregation, slug generation, and short ID creation.
 */
export class MongooseController<T extends Partial<C_Document>> {
    private defaultLimit: number;
    private defaultProjection: T_ProjectionType<T>;

    /**
     * Creates a new Mongoose controller instance.
     *
     * @param model - The Mongoose model to operate on.
     * @param options - Optional configuration for the controller.
     * @param options.defaultLimit - Maximum documents returned by findAll when no limit is specified (default: 1,000).
     * @param options.defaultProjection - Default projection to apply to findOne and findAll queries.
     */
    constructor(private model: I_ExtendedModel<T>, options?: { defaultLimit?: number; defaultProjection?: T_ProjectionType<T> }) {
        this.defaultLimit = options?.defaultLimit ?? 1_000;
        this.defaultProjection = options?.defaultProjection ?? {};
    }

    /**
     * Gets the model name for logging and error messages.
     *
     * @returns The name of the model.
     */
    private getModelName(): string {
        return this.model.modelName;
    }

    /**
     * Gets the dynamic virtuals configuration from the model instance.
     *
     * @returns Array of dynamic virtual configurations or undefined if none exist.
     */
    private getDynamicVirtuals(): I_DynamicVirtualConfig<T>[] | undefined {
        const model = this.model as I_ExtendedModel<T> & { _virtualConfigs?: I_VirtualConfig[] };

        if (model._virtualConfigs) {
            const dynamicOnly = model._virtualConfigs.filter(
                v => typeof v.options?.ref === 'function',
            ) as unknown as I_DynamicVirtualConfig<T>[];

            if (dynamicOnly.length > 0) {
                return dynamicOnly;
            }
        }

        const schemaStatics = this.model.schema.statics as { [key: string]: unknown };

        return schemaStatics['_dynamicVirtuals'] as I_DynamicVirtualConfig<T>[] | undefined;
    }

    /**
     * Populates dynamic virtuals for a single document.
     *
     * @param result - The document to populate dynamic virtuals for.
     * @param populate - The populate options to determine which virtuals to populate.
     * @returns The document with dynamic virtuals populated.
     */
    private async populateDynamicVirtualsForDocument(result: T, populate?: T_Input_Populate): Promise<T> {
        const populated = await this.populateDynamic([result], populate);
        return populated[0] ?? result;
    }

    /**
     * Populates dynamic virtuals for an array of documents.
     *
     * @param results - The documents to populate dynamic virtuals for.
     * @param populate - The populate options to determine which virtuals to populate.
     * @returns The documents with dynamic virtuals populated.
     */
    private async populateDynamicVirtualsForDocuments(results: T[], populate?: T_Input_Populate): Promise<T[]> {
        return this.populateDynamic(results, populate);
    }

    /**
     * Internal helper that populates dynamic virtuals for an array of documents.
     * Shared implementation used by both single-document and multi-document methods.
     */
    private async populateDynamic(results: T[], populate?: T_Input_Populate): Promise<T[]> {
        const dynamicVirtuals = this.getDynamicVirtuals();

        if (dynamicVirtuals && dynamicVirtuals.length > 0 && results.length > 0) {
            return await populateDynamicVirtuals(this.model.base, results, dynamicVirtuals, populate, undefined, this.model) as T[];
        }

        return results;
    }

    /**
     * Finds a single document with optional population and projection.
     * Automatically handles dynamic virtual population if configured.
     *
     * @param filter - The filter criteria to find the document.
     * @param projection - The fields to include/exclude in the result.
     * @param options - Query options for the operation.
     * @param populate - Population configuration for related documents.
     * @returns A promise that resolves to a standardized response with the found document.
     */
    async findOne(
        filter: T_QueryFilter<T> = {},
        projection: T_ProjectionType<T> = {},
        options: T_QueryOptions<T> = {},
        populate?: T_Input_Populate,
    ): Promise<I_Return<T>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const appliedProjection = Object.keys(projection).length > 0 ? projection : Object.keys(this.defaultProjection).length > 0 ? this.defaultProjection : projection;
            const query = this.model.findOne(normalizedFilter, appliedProjection, options).maxTimeMS(MONGO_MAX_TIME_MS).lean();
            const dynamicVirtuals = this.getDynamicVirtuals();

            const regularPopulate = filterDynamicVirtualsFromPopulate(populate, dynamicVirtuals);

            if (regularPopulate) {
                query.populate(regularPopulate as T_PopulateOptions);
            }

            const result = await query.exec();

            if (!result) {
                return wrapNotFound(this.getModelName());
            }

            const finalResult = await this.populateDynamicVirtualsForDocument(result, populate);

            return { success: true, result: toPlainObject(finalResult) };
        }
        catch (error: unknown) {
            return catchError<T>(error);
        }
    }

    /**
     * Finds all documents with optional population and projection.
     * Automatically handles dynamic virtual population if configured.
     *
     * @param filter - The filter criteria to find documents.
     * @param projection - The fields to include/exclude in the result.
     * @param options - Query options for the operation.
     * @param populate - Population configuration for related documents.
     * @returns A promise that resolves to a standardized response with the found documents.
     */
    async findAll(
        filter: T_QueryFilter<T> = {},
        projection: T_ProjectionType<T> = {},
        options: T_QueryOptions<T> = {},
        populate?: T_Input_Populate,
    ): Promise<I_Return<T[]>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const appliedProjection = Object.keys(projection).length > 0 ? projection : Object.keys(this.defaultProjection).length > 0 ? this.defaultProjection : projection;
            const query = this.model.find(normalizedFilter, appliedProjection, options).maxTimeMS(MONGO_MAX_TIME_MS).lean();

            if (!options.limit) {
                query.limit(this.defaultLimit);
            }
            const dynamicVirtuals = this.getDynamicVirtuals();

            const regularPopulate = filterDynamicVirtualsFromPopulate(populate, dynamicVirtuals);

            if (regularPopulate) {
                query.populate(regularPopulate as T_PopulateOptions);
            }

            const result = await query.exec();

            const finalResult = await this.populateDynamicVirtualsForDocuments(result, populate);

            const truncated = finalResult.length === this.defaultLimit && !options.limit;

            if (truncated) {
                log.warn(`[${this.getModelName()}] findAll returned exactly ${this.defaultLimit} documents (the default limit). Results may be truncated. Consider using pagination or setting an explicit limit.`);
            }

            return { success: true, result: finalResult.map(item => toPlainObject(item)), truncated };
        }
        catch (error: unknown) {
            return catchError<T[]>(error);
        }
    }

    /**
     * Finds documents with pagination support.
     * Automatically handles dynamic virtual population if configured.
     *
     * @param filter - The filter criteria to find documents.
     * @param options - Pagination options including page, limit, and population.
     * @returns A promise that resolves to a standardized response with paginated results.
     */
    async findPaging(
        filter: T_QueryFilter<T> = {},
        options: I_PaginateOptionsWithPopulate = {},
    ): Promise<I_Return<T_PaginateResult<T>>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const dynamicVirtuals = this.getDynamicVirtuals();

            const filteredOptions = { ...options };

            if (options.populate) {
                filteredOptions.populate = filterDynamicVirtualsFromPopulate(options.populate, dynamicVirtuals);
            }

            const result = await this.model.paginate(normalizedFilter, filteredOptions);

            if (dynamicVirtuals && dynamicVirtuals.length > 0) {
                const populatedDocs = await this.populateDynamicVirtualsForDocuments(result.docs, options.populate);

                return { success: true, result: { ...result, docs: populatedDocs.map(item => toPlainObject(item)) } };
            }

            return { success: true, result: { ...result, docs: result.docs.map(item => toPlainObject(item)) } };
        }
        catch (error: unknown) {
            return catchError<T_PaginateResult<T>>(error);
        }
    }

    /**
     * Performs aggregation with pagination support.
     *
     * @param pipeline - The aggregation pipeline stages.
     * @param options - Pagination options for the aggregation result.
     * @returns A promise that resolves to a standardized response with paginated aggregation results.
     */
    async findPagingAggregate(
        pipeline: T_PipelineStage[],
        options: I_PaginateOptionsWithPopulate = {},
    ): Promise<I_Return<T_AggregatePaginateResult<T>>> {
        try {
            const dynamicVirtuals = this.getDynamicVirtuals();

            const filteredOptions = { ...options };

            if (options.populate) {
                filteredOptions.populate = filterDynamicVirtualsFromPopulate(options.populate, dynamicVirtuals);
            }

            const result = await this.model.aggregatePaginate(
                this.model.aggregate(pipeline),
                filteredOptions,
            );

            const finalDocs = await this.populateDynamicVirtualsForDocuments(result.docs, options.populate);

            return { success: true, result: { ...result, docs: finalDocs.map(item => toPlainObject(item)) } };
        }
        catch (error: unknown) {
            return catchError<T_AggregatePaginateResult<T>>(error);
        }
    }

    /**
     * Counts documents matching the filter criteria.
     *
     * @param filter - The filter criteria to count documents.
     * @returns A promise that resolves to a standardized response with the document count.
     */
    async count(filter: T_QueryFilter<T> = {}): Promise<I_Return<number>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const result = await this.model.countDocuments(normalizedFilter);

            return { success: true, result };
        }
        catch (error: unknown) {
            return catchError<number>(error);
        }
    }

    /**
     * Creates a single document.
     *
     * @param doc - The document to create.
     * @returns A promise that resolves to a standardized response with the created document.
     */
    async createOne(doc: T | Partial<T>): Promise<I_Return<T>> {
        try {
            const result = await this.model.create(doc as unknown as Parameters<typeof this.model.create>[0]);

            return { success: true, result: (result as T)?.toObject?.() ?? result };
        }
        catch (error: unknown) {
            return catchError<T>(error);
        }
    }

    /**
     * Creates multiple documents with bulk insertion.
     *
     * @param docs - An array of documents to create.
     * @param options - Options for the bulk insertion operation.
     * @returns A promise that resolves to a standardized response with the created documents.
     */
    async createMany(
        docs: (T | Partial<T>)[],
        options: T_InsertManyOptions = {},
    ): Promise<I_Return<T[]>> {
        try {
            const createdDocuments = await this.model.insertMany(docs, options);

            return { success: true, result: createdDocuments.map(item => item?.toObject?.() ?? item) as T[] };
        }
        catch (error: unknown) {
            return catchError<T[]>(error);
        }
    }

    /**
     * Updates a single document and returns the updated version.
     *
     * @param filter - The filter criteria to find the document to update.
     * @param update - The update data to apply.
     * @param options - Options for the update operation.
     * @returns A promise that resolves to a standardized response with the updated document.
     */
    async updateOne(
        filter: T_QueryFilter<T> = {},
        update: T_UpdateQuery<T> = {},
        options: I_UpdateOptionsExtended = {},
    ): Promise<I_Return<T>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const result = await this.model
                .findOneAndUpdate(normalizedFilter, update, {
                    new: true,
                    ...options,
                })
                .exec();

            if (!result) {
                return wrapNotFound(this.getModelName());
            }

            return { success: true, result: result?.toObject?.() ?? result };
        }
        catch (error: unknown) {
            return catchError<T>(error);
        }
    }

    /**
     * Updates multiple documents matching the filter criteria.
     *
     * @param filter - The filter criteria to find documents to update.
     * @param update - The update data to apply.
     * @param options - Options for the update operation.
     * @returns A promise that resolves to a standardized response with the update result.
     */
    async updateMany(
        filter: T_QueryFilter<T> = {},
        update: T_UpdateQuery<T> = {},
        options: I_UpdateOptionsExtended = {},
    ): Promise<I_Return<T_UpdateResult>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const result = await this.model
                .updateMany(normalizedFilter, update, options)
                .exec();

            return { success: true, result };
        }
        catch (error: unknown) {
            return catchError<T_UpdateResult>(error);
        }
    }

    /**
     * Deletes a single document and returns the deleted version.
     *
     * @param filter - The filter criteria to find the document to delete.
     * @param options - Options for the delete operation.
     * @returns A promise that resolves to a standardized response with the deleted document.
     */
    async deleteOne(
        filter: T_QueryFilter<T> = {},
        options: I_DeleteOptionsExtended = {},
    ): Promise<I_Return<T>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const result = await this.model
                .findOneAndDelete(normalizedFilter, options)
                .exec();

            if (!result) {
                return wrapNotFound(this.getModelName());
            }

            return { success: true, result: result?.toObject?.() ?? result };
        }
        catch (error: unknown) {
            return catchError<T>(error);
        }
    }

    /**
     * Deletes multiple documents matching the filter criteria.
     *
     * @param filter - The filter criteria to find documents to delete.
     * @param options - Options for the delete operation.
     * @returns A promise that resolves to a standardized response with the delete result.
     */
    async deleteMany(
        filter: T_QueryFilter<T> = {},
        options: I_DeleteOptionsExtended = {},
    ): Promise<I_Return<T_DeleteResult>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const result = await this.model.deleteMany(normalizedFilter, options).exec();

            if (result.deletedCount === 0) {
                return wrapNotFound('documents');
            }

            return { success: true, result };
        }
        catch (error: unknown) {
            return catchError<T_DeleteResult>(error);
        }
    }

    /**
     * Creates a unique short ID based on a given ID.
     * This method generates multiple short IDs with increasing lengths and finds the first available one.
     *
     * @param id - The base ID to generate short IDs from.
     * @param length - The initial length for short ID generation (default: 4).
     * @returns A promise that resolves to a standardized response with the unique short ID.
     */
    async createShortId(id: string, length = 4): Promise<I_Return<string>> {
        try {
            const maxRetries = 10;
            const shortIds = Array.from({ length: maxRetries }, (_, index) =>
                generateShortId(id, index + length));

            // Use a single $in query instead of 10 parallel exists() calls
            const existingDocs = await this.model
                .find({ shortId: { $in: shortIds } })
                .select('shortId')
                .lean();

            const existingShortIds = new Set(
                existingDocs.map((d: Record<string, unknown>) => d['shortId'] as string),
            );

            const availableShortId = shortIds.find(s => !existingShortIds.has(s));

            if (availableShortId) {
                return { success: true, result: availableShortId };
            }

            return {
                success: false,
                message: 'Failed to create a unique shortId',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            };
        }
        catch (error: unknown) {
            return catchError<string>(error);
        }
    }

    /**
     * Creates a query for slug existence checking.
     * This method generates a query that checks for slug existence in both current and historical slug fields.
     *
     * @param options - Configuration for slug query generation including slug, field, and filter.
     * @param options.slug - The slug string to check for existence.
     * @param options.field - The field name for object-based slug checking.
     * @param options.isObject - Whether the slug is stored as an object with nested fields.
     * @param options.haveHistory - Whether to check historical slug fields for existence.
     * @param options.filter - Additional filter conditions to apply to the query.
     * @returns A MongoDB query object for checking slug existence.
     */
    createSlugQuery({ slug, field, isObject, haveHistory = false, filter }: I_Input_GenerateSlug<T>) {
        const baseFilter = { ...(filter ?? {}) };

        return isObject
            ? {
                    ...baseFilter,
                    $or: [
                        { [`slug.${field}`]: slug },
                        ...(haveHistory ? [{ slugHistory: { $elemMatch: { [`slug.${field}`]: slug } } }] : []),
                    ],
                }
            : {
                    ...baseFilter,
                    $or: [
                        { slug },
                        ...(haveHistory ? [{ slugHistory: slug }] : []),
                    ],
                };
    }

    /**
     * Creates a unique slug based on a given string.
     * This method generates multiple slug variations and finds the first available one.
     *
     * @param options - Configuration for slug generation including slug, field, and filter.
     * @param options.slug - The base slug string to make unique.
     * @param options.field - The field name for object-based slug checking.
     * @param options.isObject - Whether the slug is stored as an object with nested fields.
     * @param options.haveHistory - Whether to check historical slug fields for uniqueness.
     * @param options.filter - Additional filter conditions to apply when checking slug existence.
     * @returns A promise that resolves to a unique slug string.
     */
    async createUniqueSlug({ slug, field, isObject, haveHistory, filter }: I_Input_GenerateSlug<T>): Promise<string> {
        if (!slug || typeof slug !== 'string') {
            throw new Error('Invalid slug provided: must be a non-empty string');
        }

        const baseSlug = generateSlug(slug);

        const baseExists = await this.model.exists(
            this.createSlugQuery({ slug: baseSlug, field, isObject, haveHistory, filter }),
        );

        if (!baseExists) {
            return baseSlug;
        }

        // Batch query: check all slug variations in a single database call instead of N+1 sequential queries
        const variants = Array.from(
            { length: MONGO_SLUG_MAX_ATTEMPTS },
            (_, i) => `${baseSlug}-${i + 1}`,
        );

        const slugQueries = variants.map(s =>
            this.createSlugQuery({ slug: s, field, isObject, haveHistory, filter }),
        );

        const slugField = isObject ? `slug.${field as string}` : 'slug';
        const existingDocs = await this.model
            .find({ $or: slugQueries.map(q => q.$or).flat() })
            .select(slugField)
            .lean();

        const existingSlugs = new Set(
            existingDocs.map((d: Record<string, unknown>) => {
                if (isObject) {
                    const slug = d['slug'] as Record<string, unknown> | undefined;
                    return slug?.[field as string];
                }
                return d['slug'];
            }),
        );

        const available = variants.find(s => !existingSlugs.has(s));

        if (available) {
            return available;
        }

        const timestamp = Date.now();
        const randomSuffix = generateRandomString(6);

        return `${baseSlug}-${timestamp}-${randomSuffix}`;
    }

    /**
     * Creates a slug for a document field.
     * This method handles both simple string fields and object fields with nested slug generation.
     *
     * @param options - Configuration for slug creation including field, source document, and filter.
     * @param options.field - The field name to create a slug for.
     * @param options.from - The source document containing the field value.
     * @param options.haveHistory - Whether to check historical slug fields for uniqueness.
     * @param options.filter - Additional filter conditions to apply when checking slug existence.
     * @returns A promise that resolves to a standardized response with the created slug(s).
     */
    async createSlug<R = string>({ field, from, filter, haveHistory }: I_Input_CreateSlug<T>): Promise<I_Return<R>> {
        try {
            const fieldValue = from[field as keyof T];
            const isObjectValue = isObject(fieldValue);

            if (isObjectValue) {
                const uniqueSlug = Object.fromEntries(
                    await Promise.all(
                        Object.entries(fieldValue).map(async ([key, value]) => {
                            const uniqueSlugForKey = await this.createUniqueSlug({
                                slug: value as string,
                                field: key,
                                isObject: true,
                                haveHistory,
                                filter,
                            });
                            return [key, uniqueSlugForKey];
                        }),
                    ),
                );

                return { success: true, result: uniqueSlug as R };
            }

            const uniqueSlug = await this.createUniqueSlug({
                slug: fieldValue as string,
                field,
                isObject: false,
                haveHistory,
                filter,
            });

            return { success: true, result: uniqueSlug as R };
        }
        catch (error: unknown) {
            return catchError<R>(error);
        }
    }

    /**
     * Checks if a slug already exists in the collection.
     * This method verifies slug existence in both current and historical slug fields.
     *
     * @param options - Configuration for slug checking including slug, field, source document, and filter.
     * @param options.slug - The slug string to check for existence.
     * @param options.field - The field name for object-based slug checking.
     * @param options.from - The source document containing the field value.
     * @param options.haveHistory - Whether to check historical slug fields for existence.
     * @param options.filter - Additional filter conditions to apply to the query.
     * @returns A promise that resolves to a standardized response indicating whether the slug exists.
     */
    async checkSlug({ slug, field, from, filter, haveHistory }: I_Input_CheckSlug<T>): Promise<I_Return<boolean>> {
        try {
            const fieldValue = from[field as keyof T];
            const isObjectValue = isObject(fieldValue);

            if (isObjectValue) {
                const values = Object.values(fieldValue);
                const nestedSlugs = values.map(value => generateSlug(value as string));

                // Batch: combine all slug queries into a single $or query instead of N individual exists() calls
                const allOrConditions = nestedSlugs.flatMap((nestedSlug) => {
                    const q = this.createSlugQuery({
                        slug: nestedSlug,
                        field,
                        isObject: true,
                        haveHistory,
                        filter,
                    });
                    return q.$or;
                });

                const exists = await this.model.exists({ ...filter, $or: allOrConditions });

                return { success: true, result: exists !== null };
            }

            const baseSlug = generateSlug(slug);
            const exists = await this.model.exists(this.createSlugQuery({
                slug: baseSlug,
                field,
                isObject: false,
                filter,
            }));

            return { success: true, result: exists !== null };
        }
        catch (error: unknown) {
            return catchError<boolean>(error);
        }
    }

    /**
     * Performs aggregation operations on the collection.
     *
     * @param pipeline - The aggregation pipeline stages to execute.
     * @returns A promise that resolves to a standardized response with the aggregation results.
     */
    async aggregate(pipeline: T_PipelineStage[]): Promise<I_Return<T[]>> {
        try {
            const result = await this.model.aggregate<T>(pipeline);

            return { success: true, result };
        }
        catch (error: unknown) {
            return catchError<T[]>(error);
        }
    }

    /**
     * Retrieves distinct values for the specified key from the collection.
     *
     * @param key - The field for which to return distinct values.
     * @param filter - The filter query to apply (optional).
     * @param options - Additional options for the distinct operation (optional).
     * @returns A promise that resolves to a standardized response with the array of distinct values.
     */
    async distinct(
        key: string,
        filter: T_QueryFilter<T> = {},
        options: T_QueryOptions<T> = {},
    ): Promise<I_Return<unknown[]>> {
        try {
            const normalizedFilter = normalizeMongoFilter(filter);
            const result = await this.model.distinct(key, normalizedFilter, options);

            return { success: true, result };
        }
        catch (error: unknown) {
            return catchError<unknown[]>(error);
        }
    }
}
