import type migrate from 'migrate-mongo';
import type mongooseRaw from 'mongoose';

import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongoosePaginate from 'mongoose-paginate-v2';
import { randomUUID } from 'node:crypto';

import { getNestedValue, regexSearchMapper, setNestedValue } from '#util/index.js';
import { validate } from '#util/validate/index.js';

import type { MongoController } from './mongo.controller.js';
import type { C_Document, I_CreateModelOptions, I_CreateSchemaOptions, I_DynamicVirtualConfig, I_DynamicVirtualOptions, I_ExtendedModel, I_GenericDocument, I_MongooseModelMiddleware, T_Filter, T_MongoosePlugin, T_MongooseSchema, T_QueryFilter, T_VirtualOptions, T_WithId } from './mongo.type.js';

import { addGitIgnoreEntry, writeFileSync } from '../fs/index.js';
import { MIGRATE_MONGO_CONFIG, PATH } from '../path/index.js';
/**
 * Converts enum values to proper model names.
 * Handles common naming conventions like converting 'USER' to 'User'.
 *
 * @param enumValue - The enum value to convert
 * @returns The converted model name
 */
export function convertEnumToModelName(enumValue: string): string {
    if (enumValue === enumValue.toUpperCase()) {
        return enumValue.charAt(0).toUpperCase() + enumValue.slice(1).toLowerCase();
    }

    return enumValue;
}

/**
 * Interface for the MongoDB utility object to enable explicit type annotation.
 * Required to avoid TS7056 (inferred type exceeds maximum serialization length).
 */
interface I_MongoUtils {
    createGenericFields: () => I_GenericDocument;
    applyPlugins: <T>(schema: T_MongooseSchema<T>, plugins: Array<T_MongoosePlugin | false>) => void;
    applyMiddlewares: <T extends Partial<C_Document>>(schema: T_MongooseSchema<T>, middlewares: I_MongooseModelMiddleware<T>[]) => void;
    createGenericSchema: (mongoose: typeof mongooseRaw) => T_MongooseSchema<I_GenericDocument>;
    createSchema: <T, R extends string = string>(options: I_CreateSchemaOptions<T, R>) => T_MongooseSchema<T>;
    createModel: <T extends Partial<C_Document>, R extends string = string>(options: I_CreateModelOptions<T, R>) => I_ExtendedModel<T>;
    validator: {
        isRequired: <T>() => (this: T, value: unknown) => Promise<boolean>;
        isUnique: <T extends { constructor: { exists: (query: { [key: string]: unknown }) => Promise<unknown> } }>(fields: string[]) => (this: T, value: unknown) => Promise<boolean>;
        matchesRegex: (regexArray: RegExp[]) => (value: string) => Promise<boolean>;
    };
    migrate: {
        getModule: () => Promise<typeof migrate>;
        setConfig: (options: Partial<migrate.config.Config> & { moduleSystem?: 'commonjs' | 'esm' }) => void;
    };
    regexify: <T>(filter?: T_QueryFilter<T>, fields?: (keyof T | string)[]) => T_QueryFilter<T>;
    isDynamicVirtual: <T, R extends string>(options?: T_VirtualOptions<T, R>) => options is I_DynamicVirtualOptions<T, R>;
    fetchAllRecords: <T extends I_GenericDocument>(controller: MongoController<T>, filter?: T_Filter<T>, batchSize?: number) => Promise<T_WithId<T>[]>;
    getNewRecords: <T extends I_GenericDocument>(controller: MongoController<T>, recordsToCheck: T[], filterFn: (existingRecord: T_WithId<T>, newRecord: T) => boolean, filter?: T_Filter<T>) => Promise<T[]>;
    getExistingRecords: <T extends I_GenericDocument>(controller: MongoController<T>, recordsToCheck: T[], filterFn: (existingRecord: T_WithId<T>, newRecord: T) => boolean, filter?: T_Filter<T>) => Promise<T_WithId<T>[]>;
    health: (mongooseInstance: typeof mongooseRaw) => Record<string, unknown>;
}

/**
 * MongoDB utility object providing comprehensive database operations and utilities.
 * This object contains methods for creating generic fields, applying plugins and middlewares,
 * creating schemas and models, validation functions, migration utilities, and regex filtering.
 */
export const mongo: I_MongoUtils = {
    /**
     * Creates generic fields that are commonly used across MongoDB documents.
     * This function generates standard fields including a UUID, deletion flag, and timestamps
     * that can be applied to any document schema.
     *
     * @returns An object containing generic document fields (id, isDel, createdAt, updatedAt).
     */
    createGenericFields(): I_GenericDocument {
        return {
            id: randomUUID(),
            isDel: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    },
    /**
     * Applies plugins to a Mongoose schema.
     * This function filters out falsy plugins and applies the remaining valid plugins
     * to the provided schema.
     *
     * @param schema - The Mongoose schema to apply plugins to.
     * @param plugins - An array of plugin functions or false values to filter and apply.
     */
    applyPlugins<T>(schema: T_MongooseSchema<T>, plugins: Array<T_MongoosePlugin | false>) {
        plugins
            .filter((plugin): plugin is T_MongoosePlugin => typeof plugin === 'function')
            .forEach(plugin => schema.plugin(plugin));
    },
    /**
     * Applies middleware functions to a Mongoose schema.
     * This function configures pre and post middleware for specified methods on the schema.
     *
     * @param schema - The Mongoose schema to apply middleware to.
     * @param middlewares - An array of middleware configurations with method, pre, and post functions.
     */
    applyMiddlewares<T extends Partial<C_Document>>(
        schema: T_MongooseSchema<T>,
        middlewares: I_MongooseModelMiddleware<T>[],
    ) {
        middlewares.forEach(({ method, pre, post }) => {
            if (method && pre) {
                schema.pre(method as RegExp, pre);
            }

            if (method && post) {
                schema.post(method as RegExp, post);
            }
        });
    },
    /**
     * Creates a generic Mongoose schema with common fields.
     * This function creates a base schema with UUID field and deletion flag,
     * configured with automatic timestamps.
     *
     * @param mongoose - The Mongoose instance to create the schema with.
     * @returns A Mongoose schema with generic document fields.
     */
    createGenericSchema(mongoose: typeof mongooseRaw) {
        return new mongoose.Schema<I_GenericDocument>(
            {
                id: { type: String, default: () => randomUUID(), unique: true },
                isDel: { type: Boolean, default: false },
            },
            { timestamps: true },
        );
    },
    /**
     * Creates a Mongoose schema with optional virtual fields and generic fields.
     * This function creates a new Mongoose schema from the provided schema definition,
     * optionally adds virtual fields, and includes generic fields (unless standalone is true).
     *
     * @param options - Configuration options including mongoose instance, schema definition, virtuals, and standalone flag.
     * @param options.mongoose - The Mongoose instance to use for schema creation.
     * @param options.schema - The schema definition object.
     * @param options.virtuals - Optional array of virtual field configurations.
     * @param options.standalone - Whether to exclude generic fields (default: false).
     * @returns A configured Mongoose schema.
     */
    createSchema<T, R extends string = string>({
        mongoose,
        schema,
        virtuals = [],
        standalone = false,
    }: I_CreateSchemaOptions<T, R>): T_MongooseSchema<T> {
        const createdSchema = new mongoose.Schema<T>(schema, {
            toJSON: { virtuals: true }, // So `res.json()` and other `JSON.stringify()` functions include virtuals
            toObject: { virtuals: true }, // So `console.log()` and other functions that use `toObject()` include virtuals
        });

        virtuals.forEach(({ name, options, get }) => {
            if (mongo.isDynamicVirtual<T, R>(options)) {
                const schemaStatics = createdSchema.statics as Record<string, unknown>;

                if (!schemaStatics['_dynamicVirtuals']) {
                    schemaStatics['_dynamicVirtuals'] = [];
                }

                (schemaStatics['_dynamicVirtuals'] as I_DynamicVirtualConfig<T>[]).push({
                    name: name as string,
                    options,
                });

                const virtualInstance = createdSchema.virtual(name as string);

                if (get) {
                    virtualInstance.get(get);
                }
                else {
                    virtualInstance.get(function (this: T & { _populated?: { [key: string]: unknown } }) {
                        return this._populated?.[name as string] || (options?.count ? 0 : (options?.justOne ? null : []));
                    });
                }
            }
            else {
                const virtualInstance = createdSchema.virtual(name as string, options);

                if (get) {
                    virtualInstance.get(get);
                }
            }
        });

        if (!standalone) {
            createdSchema.add(mongo.createGenericSchema(mongoose));
        }

        return createdSchema;
    },
    /**
     * Creates a Mongoose model with plugins, middleware, and pagination support.
     * This function creates a model from a schema with optional pagination and aggregation plugins,
     * and applies any specified middleware. If a model with the same name already exists, it returns the existing model.
     *
     * @param options - Configuration options including mongoose instance, model name, schema, and feature flags.
     * @param options.mongoose - The Mongoose instance to use for model creation.
     * @param options.name - The name of the model to create.
     * @param options.schema - The schema definition for the model.
     * @param options.pagination - Whether to enable pagination plugin (default: false).
     * @param options.aggregate - Whether to enable aggregation pagination plugin (default: false).
     * @param options.virtuals - Optional array of virtual field configurations.
     * @param options.middlewares - Optional array of middleware configurations.
     * @returns A configured Mongoose model with extended functionality.
     * @throws {Error} When the model name is not provided.
     */
    createModel<T extends Partial<C_Document>, R extends string = string>({
        mongoose: currentMongooseInstance,
        name,
        schema,
        virtuals = [],
        pagination = true,
        aggregate = true,
        middlewares = [],
    }: I_CreateModelOptions<T, R>): I_ExtendedModel<T> {
        if (!name) {
            throw new Error('Model name is required.');
        }

        if (currentMongooseInstance.models[name]) {
            return currentMongooseInstance.models[name] as I_ExtendedModel<T>;
        }

        const createdSchema = mongo.createSchema({ mongoose: currentMongooseInstance, schema, virtuals });

        if (pagination || aggregate) {
            mongo.applyPlugins<T>(createdSchema, [
                pagination && mongoosePaginate,
                aggregate && aggregatePaginate,
            ]);
        }

        mongo.applyMiddlewares<T>(createdSchema, middlewares);

        const model = currentMongooseInstance.model<T>(name, createdSchema) as I_ExtendedModel<T>;

        if (virtuals.length > 0) {
            (model as I_ExtendedModel<T> & { _virtualConfigs: typeof virtuals })._virtualConfigs = virtuals;
        }

        return model;
    },
    /**
     * Validation utilities for Mongoose schemas.
     * This object provides common validation functions that can be used in Mongoose schema definitions.
     */
    validator: {
        /**
         * Creates a required field validator.
         * This function returns a validator that checks if a field value is not empty
         * using the validate.isEmpty utility.
         *
         * @returns A validation function that returns true if the field is not empty.
         */
        isRequired<T>(): (this: T, value: unknown) => Promise<boolean> {
            return async function (this: T, value: unknown): Promise<boolean> {
                return !validate.isEmpty(value);
            };
        },
        /**
         * Creates a unique field validator.
         * This function returns a validator that checks if a field value is unique
         * across the specified fields in the collection.
         *
         * @param fields - An array of field names to check for uniqueness.
         * @returns A validation function that returns true if the value is unique across the specified fields.
         * @throws {Error} When fields is not a non-empty array of strings.
         */
        isUnique<T extends { constructor: { exists: (query: { [key: string]: unknown }) => Promise<unknown> } }>(fields: string[]) {
            return async function (this: T, value: unknown): Promise<boolean> {
                if (!Array.isArray(fields) || fields.length === 0) {
                    throw new Error('Fields must be a non-empty array of strings.');
                }

                const query = { $or: fields.map(field => ({ [field]: { $eq: value } })) };
                const existingDocument = await this.constructor.exists(query);

                return !existingDocument;
            };
        },
        /**
         * Creates a regex pattern validator.
         * This function returns a validator that checks if a string value matches
         * all provided regular expressions.
         *
         * @param regexArray - An array of regular expressions to test against the value.
         * @returns A validation function that returns true if the value matches all regex patterns.
         * @throws {Error} When regexArray is not an array of valid RegExp objects.
         */
        matchesRegex(regexArray: RegExp[]): (value: string) => Promise<boolean> {
            return async (value: string): Promise<boolean> => {
                if (!Array.isArray(regexArray) || regexArray.some(r => !(r instanceof RegExp))) {
                    throw new Error('regexArray must be an array of valid RegExp objects.');
                }

                return regexArray.every(regex => regex.test(value));
            };
        },
    },
    /**
     * Migration utilities for MongoDB.
     * This object extends the migrate-mongo library with additional configuration utilities.
     */
    migrate: {
        /**
         * Lazily loads the migrate-mongo module to avoid eager import overhead.
         * Use this to access migrate-mongo methods (up, down, status, create) programmatically.
         *
         * @returns A promise resolving to the migrate-mongo module.
         */
        async getModule(): Promise<typeof migrate> {
            return (await import('migrate-mongo')).default;
        },
        /**
         * Sets the migration configuration and updates .gitignore.
         * This function creates a migration configuration file and ensures it's properly
         * excluded from version control.
         *
         * @param options - Migration configuration options to write to the config file.
         */
        setConfig: (options: Partial<migrate.config.Config> & { moduleSystem?: 'commonjs' | 'esm' }) => {
            const optionsJS = `// This file is automatically generated by the Cyberskill CLI.\nmodule.exports = ${JSON.stringify(options, null, 4)}`;

            writeFileSync(PATH.MIGRATE_MONGO_CONFIG, optionsJS);

            addGitIgnoreEntry(PATH.GIT_IGNORE, MIGRATE_MONGO_CONFIG);
        },
    },
    /**
     * Converts string values in a filter to regex patterns for case-insensitive search.
     * This function recursively processes a filter object and converts string values in specified fields
     * to MongoDB regex patterns that support accented character matching.
     *
     * @remarks
     * **Performance guard:** Input strings are capped at 200 characters to mitigate ReDoS risk.
     * The generated regex patterns include accented character alternation groups (e.g., `(a|à|á|...)`)
     * which can be polynomially complex for very long inputs. For production search on large collections,
     * consider using MongoDB `$text` search indexes instead of `$regex` for better performance.
     *
     * @param filter - The filter object to process.
     * @param fields - An array of field names to convert to regex patterns.
     * @returns A new filter object with string values converted to regex patterns.
     */
    regexify<T>(filter?: T_QueryFilter<T>, fields?: (keyof T | string)[]): T_QueryFilter<T> {
        if (!filter) {
            return {} as T_QueryFilter<T>;
        }

        let newFilter = { ...filter };

        if (!fields || fields.length === 0) {
            return newFilter;
        }

        /** \n         * @security ReDoS mitigation — accented character alternation groups (e.g., `(a|à|á|...)`)\n         * create patterns with polynomial matching complexity when combined with `.*` anchors.\n         * Capping at 100 characters bounds the worst-case regex complexity to an acceptable level.\n         * For longer search terms, consider using MongoDB `$text` search indexes.\n         */
        const MAX_REGEX_INPUT_LENGTH = 100;

        for (const field of fields) {
            const path = field.toString().split('.');
            const value = getNestedValue(newFilter, path);

            if (typeof value === 'string' && value.length > 0 && value.length <= MAX_REGEX_INPUT_LENGTH) {
                const regexValue = {
                    $regex: `.*${regexSearchMapper(value)}.*`,
                    $options: 'i',
                };

                newFilter = setNestedValue(newFilter, path, regexValue);
            }
        }

        return newFilter;
    },
    /**
     * Checks if a virtual options object has a dynamic ref function.
     *
     * @param options - The virtual options to check.
     * @returns True if the options contain a dynamic ref function.
     */
    isDynamicVirtual<T, R extends string = string>(options?: T_VirtualOptions<T, R>): options is I_DynamicVirtualOptions<T, R> {
        return Boolean(options && typeof options.ref === 'function');
    },

    /**
     * Fetches all records from a collection by paginating through results in batches.
     * Handles the offset-based pagination loop internally so callers don't need
     * to reimplement it.
     *
     * **Warning:** All matched documents are accumulated into memory before returning.
     * This helper is intended for bounded datasets only. Avoid using it on large or
     * unbounded collections to prevent excessive memory usage or OOM errors.
     *
     * @param controller - MongoController instance
     * @param filter - Optional filter to narrow the query
     * @param batchSize - Number of records per page (default: 1000)
     * @returns All records matching the filter
     * @throws {Error} When a page query fails
     * @since 3.17.0
     */
    async fetchAllRecords<T extends I_GenericDocument>(
        controller: MongoController<T>,
        filter: T_Filter<T> = {} as T_Filter<T>,
        batchSize = 1000,
    ): Promise<T_WithId<T>[]> {
        const allRecords: T_WithId<T>[] = [];
        let skip = 0;
        let isComplete = false;

        while (!isComplete) {
            const pageResult = await controller.findAll(filter, { skip, limit: batchSize });

            if (!pageResult.success) {
                throw new Error(`Failed to query records on skip ${skip}: ${pageResult.message}`);
            }

            allRecords.push(...pageResult.result);

            if (pageResult.truncated && pageResult.result.length === batchSize) {
                skip += batchSize;
            }
            else {
                isComplete = true;
            }
        }

        return allRecords;
    },

    /**
     * Generic utility function to get new records from the database
     * @param controller - MongoController instance
     * @param recordsToCheck - Array of records to check
     * @param filterFn - Function to determine if a record already exists
     * @param filter - Optional filter to narrow the query
     * @returns Array of records that don't exist in the database
     * @since 3.13.0
     */
    async getNewRecords<T extends I_GenericDocument>(
        controller: MongoController<T>,
        recordsToCheck: T[],
        filterFn: (existingRecord: T_WithId<T>, newRecord: T) => boolean,
        filter: T_Filter<T> = {} as T_Filter<T>,
    ): Promise<T[]> {
        const allExistingRecords = await mongo.fetchAllRecords(controller, filter);

        return recordsToCheck.filter(newRecord =>
            !allExistingRecords.some((existingRecord: T_WithId<T>) =>
                filterFn(existingRecord, newRecord),
            ),
        );
    },

    /**
     * Generic utility function to get existing records that match the filter criteria
     * @param controller - MongoController instance
     * @param recordsToCheck - Array of records to check
     * @param filterFn - Function to determine if a record exists
     * @param filter - Optional filter to narrow the query
     * @returns Array of existing records that match the filter criteria
     * @throws {Error} When the database query fails — prevents silent data inconsistency.
     * @since 3.13.0
     */
    async getExistingRecords<T extends I_GenericDocument>(
        controller: MongoController<T>,
        recordsToCheck: T[],
        filterFn: (existingRecord: T_WithId<T>, newRecord: T) => boolean,
        filter: T_Filter<T> = {} as T_Filter<T>,
    ): Promise<T_WithId<T>[]> {
        const allExistingRecords = await mongo.fetchAllRecords(controller, filter);

        return allExistingRecords.filter((existingRecord: T_WithId<T>) =>
            recordsToCheck.some((newRecord: T) =>
                filterFn(existingRecord, newRecord),
            ),
        );
    },

    /**
     * Retrieves health and connection pool statistics for the Mongoose connection.
     * This utility helps monitor database connection health and observability.
     *
     * @param mongooseInstance - The Mongoose instance to check.
     * @returns An object containing connection health statistics.
     */
    health(mongooseInstance: typeof mongooseRaw): Record<string, unknown> {
        const conn = mongooseInstance.connection;

        let pool: { totalConnections: number; availableConnections: number } | null = null;

        try {
            // Prefer the public getClient() API; fall back to the internal .client
            // property for older mongoose versions that do not expose getClient().
            const client = (conn as any).getClient?.() ?? (conn as any).client;

            if (client?.topology?.s?.servers && client.topology.s.servers instanceof Map) {
                let totalConnections = 0;
                let availableConnections = 0;

                client.topology.s.servers.forEach((server: any) => {
                    const serverPool = server.s?.pool;
                    if (serverPool) {
                        totalConnections += serverPool.totalConnectionCount ?? 0;
                        availableConnections += serverPool.availableConnectionCount ?? 0;
                    }
                });

                pool = { totalConnections, availableConnections };
            }
        }
        catch {
            // Pool metrics rely on driver internals that may change across upgrades
        }

        return {
            readyState: conn.readyState,
            host: conn.host,
            name: conn.name,
            models: Object.keys(mongooseInstance.models).length,
            pool,
            poolMetricsAvailable: pool !== null,
        };
    },
};

export { applyNestedPopulate } from './mongo.populate.js';
