import type mongooseRaw from 'mongoose';

import { deepClone } from '#util/index.js';

import type { I_ModelWithSchema } from './mongo.internal-types.js';
import type { I_DynamicVirtualConfig, I_DynamicVirtualOptions, T_Input_Populate } from './mongo.type.js';

import { catchError } from '../log/index.js';
import { applyNestedPopulate } from './mongo.populate.js';
import { convertEnumToModelName } from './mongo.util.js';

/**
 * Filters out dynamic virtuals from populate options to prevent Mongoose from trying to populate them.
 * This function creates a new populate configuration that only includes regular virtuals.
 *
 * @template T - The document type
 * @param populate - The original populate options
 * @param dynamicVirtuals - Array of dynamic virtual configurations
 * @returns Filtered populate options excluding dynamic virtuals
 */
export function filterDynamicVirtualsFromPopulate<T>(
    populate: T_Input_Populate | undefined,
    dynamicVirtuals: I_DynamicVirtualConfig<T>[] | undefined,
): T_Input_Populate | undefined {
    if (!populate || !dynamicVirtuals || dynamicVirtuals.length === 0) {
        return populate;
    }

    const dynamicVirtualNames = new Set(dynamicVirtuals.map(v => v.name));

    if (Array.isArray(populate)) {
        const filtered = populate.filter((p) => {
            if (typeof p === 'string') {
                return ![...dynamicVirtualNames].some(virtualName =>
                    p === virtualName || p.startsWith(`${virtualName}.`),
                );
            }

            if (typeof p === 'object' && p !== null) {
                const popObj = p as { path?: string; populate?: string };
                const path = popObj.path || popObj.populate || '';

                return ![...dynamicVirtualNames].some(virtualName =>
                    path === virtualName || path.startsWith(`${virtualName}.`),
                );
            }

            return true;
        });

        return filtered.length > 0 ? (filtered as T_Input_Populate) : undefined;
    }

    if (typeof populate === 'string') {
        return [...dynamicVirtualNames].some(virtualName =>
            populate === virtualName || populate.startsWith(`${virtualName}.`),
        )
            ? undefined
            : populate;
    }

    if (typeof populate === 'object' && populate !== null) {
        const popObj = populate as { path?: string; populate?: string };
        const path = popObj.path || popObj.populate || '';

        return [...dynamicVirtualNames].some(virtualName =>
            path === virtualName || path.startsWith(`${virtualName}.`),
        )
            ? undefined
            : populate;
    }

    return populate;
}

/**
 * Groups documents by the resolved model name for a dynamic virtual field.
 * Used to batch population queries for dynamic virtuals.
 *
 * @template T - The document type
 * @template R - The model name type (usually string or enum)
 * @param {T[]} documents - The array of documents to process
 * @param {string} virtualName - The name of the dynamic virtual field
 * @param {I_DynamicVirtualOptions<T, R>} virtualOptions - The dynamic virtual options (must include a ref function)
 * @returns {Array<{ model: string; docs: T[] }>} An array of groups, each with a model name and the docs for that model
 */
export function remapDynamicPopulate<T, R extends string = string>(
    documents: T[],
    virtualName: string,
    virtualOptions: I_DynamicVirtualOptions<T, R>,
): Array<{ model: string; docs: T[] }> {
    if (!documents.length || !virtualName || !virtualOptions?.ref) {
        return [];
    }

    const modelGroups = new Map<string, T[]>();
    documents.forEach((doc) => {
        try {
            const modelName = virtualOptions.ref(doc);

            if (modelName === undefined || modelName === null) {
                return;
            }

            const modelNameString = typeof modelName === 'string' ? modelName : String(modelName);

            if (modelNameString && modelNameString.trim() !== '') {
                const convertedModelName = convertEnumToModelName(modelNameString);

                if (!modelGroups.has(convertedModelName)) {
                    modelGroups.set(convertedModelName, []);
                }

                modelGroups.get(convertedModelName)!.push(doc);
            }
        }
        catch (error: unknown) {
            catchError(new Error(`Dynamic ref function failed for virtual "${virtualName}": ${error instanceof Error ? error.message : String(error)}`));
        }
    });

    return Array.from(modelGroups.entries(), ([model, docs]) => ({ model, docs }));
}

/**
 * Type guard to check if an object is a Mongoose Document (has toObject method).
 * @param obj - The object to check
 * @returns True if obj has a toObject function
 */
export function isMongooseDoc(obj: unknown): obj is { toObject: () => { [key: string]: unknown } } {
    return obj !== null && typeof obj === 'object' && 'toObject' in obj && typeof (obj as { toObject: unknown }).toObject === 'function';
}

/**
 * Optimized batch population for dynamic virtuals.
 *
 * - Groups documents by model and batches queries for each model.
 * - Populates all dynamic virtuals in parallel for maximum performance.
 * - Uses direct assignment for plain objects and skips already populated fields.
 * - Supports optional projection for population queries.
 * - Only populates virtuals that are explicitly requested in populate options.
 * - Reminder: Ensure indexes exist on foreignField in referenced collections for best performance.
 *
 * @template T - The document type (must be an object)
 * @template R - The model name type (usually string or enum)
 * @param {typeof mongooseRaw} mongoose - The Mongoose instance
 * @param {T[]} documents - The array of documents to populate
 * @param {I_DynamicVirtualConfig<T, R>[]} virtualConfigs - The dynamic virtual configurations to process
 * @param {T_Input_Populate} [populate] - Population options to determine which virtuals to populate
 * @param {Record<string, 0 | 1>} [projection] - Optional projection for population queries
 * @returns {Promise<object[]>} The array of documents with dynamic virtuals populated
 */
export async function populateDynamicVirtuals<T extends object, R extends string = string>(
    mongoose: typeof mongooseRaw,
    documents: T[],
    virtualConfigs: I_DynamicVirtualConfig<T, R>[],
    populate?: T_Input_Populate,
    projection?: Record<string, 0 | 1>,
    startModel?: I_ModelWithSchema,
): Promise<T[]> {
    if (!documents.length || !virtualConfigs.length) {
        return documents;
    }

    if (!populate) {
        return documents;
    }

    const requestedVirtuals = virtualConfigs.filter((config) => {
        if (Array.isArray(populate)) {
            return populate.length > 0 && populate.some((p) => {
                if (typeof p === 'string') {
                    return p === config.name || p.startsWith(`${config.name}.`);
                }
                if (p && typeof p === 'object') {
                    const popObj = p as { path?: string; populate?: string };
                    const path = popObj.path || popObj.populate || '';

                    return path === config.name || path.startsWith(`${config.name}.`);
                }

                return false;
            });
        }

        if (typeof populate === 'string') {
            return populate === config.name || populate.startsWith(`${config.name}.`);
        }

        if (typeof populate === 'object' && populate !== null) {
            const popObj = populate as { path?: string; populate?: string };
            const path = popObj.path || popObj.populate || '';

            return (path === config.name) || path.startsWith(`${config.name}.`);
        }

        return false;
    });

    if (requestedVirtuals.length === 0) {
        return documents;
    }

    // toObject() already creates plain copies for Mongoose docs; deepClone the
    // plain array to avoid mutating the caller's objects.
    const plainDocuments = documents.map(doc => isMongooseDoc(doc) ? doc.toObject() : doc);
    const clonedDocuments = deepClone(plainDocuments) as T[];

    clonedDocuments.forEach((doc) => {
        requestedVirtuals.forEach(({ name, options }) => {
            if (!(name in doc)) {
                (doc as { [key: string]: unknown })[name as string] = options.count ? 0 : (options.justOne ? null : []);
            }
        });
    });

    const modelProcessingMap = new Map<string, {
        virtuals: I_DynamicVirtualConfig<T, R>[];
        localValueSets: Map<string, Set<string>>;
        docsByLocalValue: Map<string, number[]>;
    }>();

    for (const virtualConfig of requestedVirtuals) {
        const { name, options } = virtualConfig;
        const populateGroups = remapDynamicPopulate(clonedDocuments, name, options);

        for (const group of populateGroups) {
            if (!modelProcessingMap.has(group.model)) {
                modelProcessingMap.set(group.model, {
                    virtuals: [],
                    localValueSets: new Map(),
                    docsByLocalValue: new Map(),
                });
            }

            const processing = modelProcessingMap.get(group.model)!;

            if (!processing.virtuals.some(v => v.name === name)) {
                processing.virtuals.push(virtualConfig);
                processing.localValueSets.set(name as string, new Set());
            }

            const localValueSet = processing.localValueSets.get(name as string)!;
            group.docs.forEach((doc) => {
                const localVal = (doc as { [key: string]: unknown })[options.localField];

                if (localVal != null) {
                    const strVal = String(localVal);
                    localValueSet.add(strVal);

                    let idx = -1;

                    const docWithKeys = doc as { [key: string]: unknown };

                    if (docWithKeys['id'] !== undefined) {
                        idx = clonedDocuments.findIndex((d) => {
                            const dWithKeys = d as { [key: string]: unknown };

                            return dWithKeys['id'] === docWithKeys['id'];
                        });
                    }
                    else if (docWithKeys['_id'] !== undefined) {
                        idx = clonedDocuments.findIndex((d) => {
                            const dWithKeys = d as { [key: string]: unknown };

                            return dWithKeys['_id']?.toString?.() === docWithKeys['_id']?.toString?.();
                        });
                    }

                    if (idx !== -1) {
                        if (!processing.docsByLocalValue.has(strVal)) {
                            processing.docsByLocalValue.set(strVal, []);
                        }
                        processing.docsByLocalValue.get(strVal)!.push(idx);
                    }
                }
            });
        }
    }

    await Promise.all(Array.from(modelProcessingMap.entries(), async ([modelName, processing]) => {
        const Model = mongoose.models[modelName];

        if (!Model) {
            return;
        }

        const allLocalValues = new Set<string>();
        processing.localValueSets.forEach((localValueSet) => {
            localValueSet.forEach(val => allLocalValues.add(val));
        });

        if (allLocalValues.size === 0) {
            return;
        }

        const foreignFields = [...new Set(processing.virtuals.map(v => v.options.foreignField))];
        const localValuesArray = [...allLocalValues];
        let query;

        if (foreignFields.length === 1) {
            query = { [String(foreignFields[0])]: { $in: localValuesArray } };
        }
        else {
            query = { $or: foreignFields.map(field => ({ [field]: { $in: localValuesArray } })) };
        }

        const allPopulatedData = await Model.find(query, projection).lean();

        for (const virtualConfig of processing.virtuals) {
            const { name, options } = virtualConfig;
            const relevantData = allPopulatedData.filter((item) => {
                const foreignVal = (item)[options.foreignField];

                return foreignVal != null && allLocalValues.has(String(foreignVal));
            });

            if (options.count) {
                const countMap = new Map<string, number>();

                relevantData.forEach((item) => {
                    const key = (item)[options.foreignField]?.toString();

                    if (key) {
                        countMap.set(key, (countMap.get(key) || 0) + 1);
                    }
                });

                processing.localValueSets.get(name as string)!.forEach((localValue) => {
                    const docs = processing.docsByLocalValue.get(localValue) || [];
                    const count = countMap.get(localValue) || 0;

                    docs.forEach((idx) => {
                        const docToUpdate = clonedDocuments[idx] as { [key: string]: unknown };

                        if (docToUpdate[name] === undefined) {
                            docToUpdate[name] = count;
                        }
                    });
                });
            }
            else {
                const resultMap = new Map<string, T[]>();

                relevantData.forEach((item) => {
                    const key = (item)[options.foreignField]?.toString();

                    if (key) {
                        if (!resultMap.has(key)) {
                            resultMap.set(key, []);
                        }
                        resultMap.get(key)!.push(item);
                    }
                });

                processing.localValueSets.get(name as string)!.forEach((localVal) => {
                    const docs = processing.docsByLocalValue.get(localVal) || [];
                    const results = resultMap.get(localVal) || [];
                    const value = options.justOne ? (results[0] || null) : results;

                    docs.forEach((idx) => {
                        const docToUpdate = clonedDocuments[idx] as { [key: string]: unknown };
                        docToUpdate[name] = value;
                    });
                });
            }
        }
    }));

    if (populate) {
        const normalizePopulate = (pop: T_Input_Populate): T_Input_Populate => {
            const asArray = Array.isArray(pop) ? pop : [pop];
            const grouped = new Map<string, unknown[]>();
            const passthrough: unknown[] = [];

            for (const entry of asArray) {
                if (typeof entry === 'string') {
                    if (entry.includes('.')) {
                        const parts = entry.split('.');
                        const first = parts[0] || '';
                        const rest = parts.slice(1).join('.');

                        if (first) {
                            if (!grouped.has(first)) {
                                grouped.set(first, []);
                            }
                            if (rest) {
                                grouped.get(first)!.push(rest);
                            }
                        }
                    }
                    else {
                        passthrough.push(entry);
                    }
                }
                else if (entry && typeof entry === 'object') {
                    const obj = entry as { path?: string; populate?: T_Input_Populate };

                    if (obj.path && obj.path.includes('.')) {
                        const parts = obj.path.split('.');
                        const first = parts[0] || '';
                        const rest = parts.slice(1).join('.');

                        if (first) {
                            if (!grouped.has(first)) {
                                grouped.set(first, []);
                            }
                            if (rest) {
                                grouped.get(first)!.push(rest);
                            }
                            if (obj.populate) {
                                grouped.get(first)!.push(obj.populate);
                            }
                        }
                    }
                    else {
                        passthrough.push(entry);
                    }
                }
            }

            const normalized: unknown[] = [...passthrough];
            grouped.forEach((nested, root) => {
                const flat: unknown[] = [];

                for (const n of nested) {
                    if (typeof n === 'string') {
                        flat.push(n);
                    }
                    else if (n && typeof n === 'object') {
                        flat.push(n);
                    }
                }
                if (flat.length > 0) {
                    normalized.push({ path: root, populate: flat as unknown as T_Input_Populate });
                }
                else {
                    normalized.push(root);
                }
            });

            return normalized as unknown as T_Input_Populate;
        };

        const normalizedPopulate = normalizePopulate(populate);

        await applyNestedPopulate(mongoose, clonedDocuments, normalizedPopulate, virtualConfigs as I_DynamicVirtualConfig<unknown, string>[], startModel);
    }

    return clonedDocuments;
}
