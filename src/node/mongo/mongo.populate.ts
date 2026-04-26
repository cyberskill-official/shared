import type mongooseRaw from 'mongoose';

import type { I_ModelWithSchema } from './mongo.internal-types.js';
import type { I_DynamicVirtualConfig, T_Input_Populate } from './mongo.type.js';

import { getDynamicVirtualConfigs, resolveRef, searchVirtualsInSchema } from './mongo.internal-types.js';
import { convertEnumToModelName } from './mongo.util.js';

/**
 * Recursively applies nested populate options to populated documents.
 * This function handles cases where a populated field needs further population.
 *
 * @template T - The document type
 * @param mongoose - The Mongoose instance
 * @param documents - The documents to apply nested populations to
 * @param populateOptions - The populate options to apply
 * @param virtualConfigs - Optional virtual configurations for model inference
 * @param currentModel - The current model context (which model's schema to search for virtuals)
 * @returns Promise with documents that have nested populations applied
 */
export async function applyNestedPopulate<T extends object>(
    mongoose: typeof mongooseRaw,
    documents: T[],
    populateOptions: T_Input_Populate,
    virtualConfigs?: I_DynamicVirtualConfig<unknown, string>[],
    currentModel?: I_ModelWithSchema,
): Promise<T[]> {
    if (!documents.length || !populateOptions) {
        return documents;
    }

    const populateArray = Array.isArray(populateOptions) ? populateOptions : [populateOptions];

    for (const populateOption of populateArray) {
        if (typeof populateOption === 'string') {
            await applyStringPopulate(mongoose, documents, populateOption, virtualConfigs, currentModel);
        }
        else if (populateOption && typeof populateOption === 'object') {
            const popObj = populateOption as { path?: string; populate?: T_Input_Populate; [key: string]: unknown };

            await applyObjectPopulate(mongoose, documents, popObj, virtualConfigs, currentModel);
        }
    }

    return documents;
}

/**
 * Resolves the next child model from virtual/dynamic configurations on the current model.
 * Consolidates the repeated _virtualConfigs / schema.virtuals / _dynamicVirtuals lookup.
 *
 * @param mongoose - The Mongoose instance
 * @param currentModel - The model whose schema to search
 * @param fieldName - The field name to look up
 * @param document - The document context for function refs
 * @returns The resolved child model, or the original currentModel if not resolved
 */
function resolveChildModel(
    mongoose: typeof mongooseRaw,
    currentModel: I_ModelWithSchema | undefined,
    fieldName: string,
    document: Record<string, unknown>,
): I_ModelWithSchema | undefined {
    if (!currentModel) {
        return undefined;
    }

    // 1. Try schema virtuals
    if (currentModel.schema?.virtuals) {
        const virtual = currentModel.schema.virtuals[fieldName];
        if (virtual?.options?.ref) {
            const refResult = resolveRef(virtual.options.ref, document);
            if (refResult) {
                const modelName = convertEnumToModelName(refResult);
                if (mongoose.models[modelName]) {
                    return mongoose.models[modelName] as unknown as I_ModelWithSchema;
                }
            }
        }
    }

    // 2. Try dynamic virtual configs (_virtualConfigs / _dynamicVirtuals)
    const dynamicVirtuals = getDynamicVirtualConfigs(currentModel);
    const dyn = dynamicVirtuals.find(v => v.name === fieldName);

    if (dyn?.options?.ref) {
        const refResult = resolveRef(dyn.options.ref, document);
        if (refResult) {
            const modelName = convertEnumToModelName(refResult);
            if (mongoose.models[modelName]) {
                return mongoose.models[modelName] as unknown as I_ModelWithSchema;
            }
        }
    }

    return currentModel;
}

/**
 * Applies string-based populate options (e.g., "field.subfield") to documents.
 *
 * @template T - The document type
 * @param mongoose - The Mongoose instance
 * @param documents - The documents to populate
 * @param populatePath - The populate path string
 * @param virtualConfigs - Optional virtual configurations for model inference
 * @param currentModel - The current model context (which model's schema to search for virtuals)
 */
async function applyStringPopulate<T extends object>(
    mongoose: typeof mongooseRaw,
    documents: T[],
    populatePath: string,
    virtualConfigs?: I_DynamicVirtualConfig<unknown, string>[],
    currentModel?: I_ModelWithSchema,
): Promise<void> {
    const pathParts = populatePath.split('.');

    if (pathParts.length < 2) {
        for (const doc of documents) {
            const docObj = doc as { [key: string]: unknown };

            await populateNestedFieldOnParent(mongoose, docObj, populatePath, virtualConfigs, undefined, currentModel);
        }

        return;
    }

    const mainField = pathParts[0];

    if (!mainField || mainField.trim() === '') {
        return;
    }

    const nestedPath = pathParts.slice(1).join('.');

    for (const doc of documents) {
        const docObj = doc as { [key: string]: unknown };
        const mainValue = docObj[mainField];

        if (mainValue && typeof mainValue === 'object') {
            const nextModelForChildren = resolveChildModel(mongoose, currentModel, mainField, docObj);

            if (Array.isArray(mainValue)) {
                for (const item of mainValue) {
                    if (item && typeof item === 'object') {
                        await populateNestedFieldOnParent(mongoose, item as { [key: string]: unknown }, nestedPath, virtualConfigs, mainField, nextModelForChildren);
                    }
                }
            }
            else if (mainValue && typeof mainValue === 'object') {
                await populateNestedFieldOnParent(mongoose, mainValue as { [key: string]: unknown }, nestedPath, virtualConfigs, mainField, nextModelForChildren);
            }
        }
    }
}

/**
 * Applies object-based populate options with nested populate to documents.
 *
 * @template T - The document type
 * @param mongoose - The Mongoose instance
 * @param documents - The documents to populate
 * @param populateOption - The populate option object
 * @param populateOption.path - The path to populate
 * @param populateOption.populate - The nested populate options
 * @param virtualConfigs - Optional virtual configurations for model inference
 * @param currentModel - The current model context (which model's schema to search for virtuals)
 */
async function applyObjectPopulate<T extends object>(
    mongoose: typeof mongooseRaw,
    documents: T[],
    populateOption: { path?: string; populate?: T_Input_Populate; [key: string]: unknown },
    virtualConfigs?: I_DynamicVirtualConfig<unknown, string>[],
    currentModel?: I_ModelWithSchema,
): Promise<void> {
    const { path, populate: nestedPopulate } = populateOption;

    if (!path) {
        return;
    }

    if (!nestedPopulate) {
        await applyStringPopulate(mongoose, documents, path, virtualConfigs, currentModel);

        return;
    }

    const pathString = path;

    for (const doc of documents) {
        const docObj = doc as { [key: string]: unknown };
        const fieldValue = docObj[pathString];

        let nextModelForChildren: I_ModelWithSchema | undefined = currentModel;

        // Try resolving from schema virtuals
        if (currentModel?.schema?.virtuals) {
            const virtual = currentModel.schema.virtuals[pathString];

            if (virtual?.options?.ref) {
                const refResult = resolveRef(virtual.options.ref, docObj);
                if (refResult) {
                    const modelName = convertEnumToModelName(refResult);
                    if (mongoose.models[modelName]) {
                        nextModelForChildren = mongoose.models[modelName] as unknown as I_ModelWithSchema;
                    }
                }
            }
        }
        if (!nextModelForChildren && typeof fieldValue === 'object' && fieldValue && 'entityType' in (fieldValue as object)) {
            const maybeModel = convertEnumToModelName(String((fieldValue as { [k: string]: unknown })['entityType']));

            if (mongoose.models[maybeModel]) {
                nextModelForChildren = mongoose.models[maybeModel] as unknown as I_ModelWithSchema;
            }
        }

        if (fieldValue && typeof fieldValue === 'object') {
            if (Array.isArray(fieldValue)) {
                for (const item of fieldValue) {
                    if (item && typeof item === 'object') {
                        await applyNestedPopulate(mongoose, [item as { [key: string]: unknown }], nestedPopulate, virtualConfigs, nextModelForChildren);
                    }
                }
            }
            else if (fieldValue && typeof fieldValue === 'object') {
                await applyNestedPopulate(mongoose, [fieldValue as { [key: string]: unknown }], nestedPopulate, virtualConfigs, nextModelForChildren);
            }
        }
    }
}

/**
 * Resolves the target model for a given populate path by following the path step by step.
 * This function traverses the schema hierarchy to find the correct model for population.
 *
 * @param mongoose - The Mongoose instance
 * @param startModel - The starting model (usually the model containing the document)
 * @param path - The populate path to resolve (e.g., "entity.partner1.gallery")
 * @param document - The document being populated (for dynamic virtual resolution)
 * @returns The resolved model name or undefined if not found
 */
function resolveModelFromPath(
    mongoose: typeof mongooseRaw,
    startModel: I_ModelWithSchema,
    path: string,
    document: { [key: string]: unknown },
): string | undefined {
    if (!path || !startModel || !startModel.schema) {
        return undefined;
    }

    const pathParts = path.split('.');
    let currentSchema = startModel.schema;

    for (let i = 0; i < pathParts.length; i++) {
        const pathPart = pathParts[i];

        if (currentSchema?.virtuals && pathPart) {
            const virtual = currentSchema.virtuals[pathPart];
            if (virtual?.options?.ref) {
                const refResult = resolveRef(virtual.options.ref, document);

                if (refResult && typeof refResult === 'string') {
                    if (i === pathParts.length - 1) {
                        return refResult;
                    }

                    const nextModel = mongoose.models[refResult];

                    if (nextModel && (nextModel as unknown as I_ModelWithSchema).schema) {
                        currentSchema = (nextModel as unknown as I_ModelWithSchema).schema!;
                        continue;
                    }
                }
            }
        }

        if (currentSchema?.paths && pathPart) {
            const pathSchema = currentSchema.paths[pathPart];

            if (pathSchema?.schema) {
                currentSchema = pathSchema.schema;
                continue;
            }
        }

        return undefined;
    }

    return undefined;
}

/**
 * Attempts to find a model whose schema contains the given field
 * either as a direct path or a virtual. Searches only at the root level
 * of each model schema.
 */
function findModelBySchemaField(
    mongoose: typeof mongooseRaw,
    fieldName: string,
): I_ModelWithSchema | undefined {
    if (!fieldName) {
        return undefined;
    }
    for (const modelName of Object.keys(mongoose.models)) {
        const Model = mongoose.models[modelName] as unknown as I_ModelWithSchema;
        const schema = Model?.schema;

        if (!schema) {
            continue;
        }
        if ((schema.paths && schema.paths[fieldName]) || (schema.virtuals && schema.virtuals[fieldName])) {
            return Model;
        }
    }

    return undefined;
}

/**
 * Finds a start model whose root schema contains the first segment of the path
 * as either a direct path or a virtual. Useful to jump into the correct model
 * when the current model context is misaligned (e.g., 'partner1.*' should start from User).
 */
function findStartModelByFirstSegment(
    mongoose: typeof mongooseRaw,
    fullPath: string,
): I_ModelWithSchema | undefined {
    const first = (fullPath || '').split('.')[0] || '';

    if (!first) {
        return undefined;
    }
    for (const modelName of Object.keys(mongoose.models)) {
        const Model = mongoose.models[modelName] as unknown as I_ModelWithSchema;
        const schema = Model?.schema;

        if (!schema) {
            continue;
        }
        if ((schema.paths && schema.paths[first]) || (schema.virtuals && schema.virtuals[first])) {
            return Model;
        }
    }

    return undefined;
}

/**
 * Populates a nested field on the parent object by finding the referenced document and applying populate options.
 *
 * @param mongoose - The Mongoose instance
 * @param document - The document containing the field to populate
 * @param nestedPath - The nested populate path
 * @param virtualConfigs - Optional virtual configurations for model inference
 * @param pathPrefix - The parent path prefix (if nested within another populated field)
 * @param currentModel - The current model context (which model's schema to search for virtuals)
 */
async function populateNestedFieldOnParent(
    mongoose: typeof mongooseRaw,
    document: { [key: string]: unknown },
    nestedPath: string,
    virtualConfigs?: I_DynamicVirtualConfig<unknown, string>[],
    pathPrefix?: string,
    currentModel?: I_ModelWithSchema,
): Promise<void> {
    let modelName = document['__t'];

    if (!modelName) {
        if (currentModel) {
            const fullPath = pathPrefix ? `${pathPrefix}.${nestedPath}` : nestedPath;

            const firstSegment = (fullPath || '').split('.')[0] || '';
            let startModel: I_ModelWithSchema = currentModel;
            const hasFirstOnCurrent = Boolean(
                (startModel?.schema?.paths && startModel.schema.paths[firstSegment])
                || (startModel?.schema?.virtuals && startModel.schema.virtuals[firstSegment]),
            );

            if (!hasFirstOnCurrent) {
                const betterStart = findStartModelByFirstSegment(mongoose, fullPath);

                if (betterStart) {
                    startModel = betterStart;
                }
            }

            const resolvedFromPath = resolveModelFromPath(mongoose, startModel, fullPath, document);

            if (resolvedFromPath) {
                modelName = resolvedFromPath;
            }
            else {
                const lastSegment = (fullPath.includes('.') ? fullPath.split('.').pop() : fullPath) || '';

                if (lastSegment) {
                    const candidateModel = findModelBySchemaField(mongoose, lastSegment);

                    if (candidateModel) {
                        const rerun = resolveModelFromPath(mongoose, candidateModel, fullPath, document);

                        if (rerun) {
                            modelName = rerun;
                        }
                    }
                }
            }
        }

        if (virtualConfigs && virtualConfigs.length > 0) {
            const fieldName = nestedPath.split('.').pop() || '';
            const matchingVirtual = virtualConfigs.find(v => v.name === fieldName);

            if (matchingVirtual?.options.ref) {
                const refResult = resolveRef(matchingVirtual.options.ref as string | ((doc: unknown) => string | undefined), document);

                if (refResult && typeof refResult === 'string') {
                    modelName = refResult;
                }
            }
        }

        if (!modelName) {
            for (const [key, value] of Object.entries(document as Record<string, unknown>)) {
                if (key === 'entityType' && typeof value === 'string') {
                    modelName = value;
                    break;
                }
            }

            if (modelName && mongoose.models[modelName as string]) {
                const Model = mongoose.models[modelName as string] as unknown as I_ModelWithSchema;

                if (Model?.schema) {
                    const fieldName = nestedPath.split('.').pop() || '';
                    const foundModelName = searchVirtualsInSchema(Model.schema, fieldName, document);
                    if (foundModelName) {
                        modelName = foundModelName;
                    }
                }
            }
        }

        if (!modelName) {
            const fieldName = nestedPath.split('.').pop() || '';

            if (currentModel?.schema) {
                const foundModelName = searchVirtualsInSchema(currentModel.schema, fieldName, document);
                if (foundModelName) {
                    modelName = foundModelName;
                }
            }

            if (!modelName) {
                if (currentModel) {
                    const resolvedModel = resolveModelFromPath(mongoose, currentModel, nestedPath, document);

                    if (resolvedModel) {
                        modelName = resolvedModel;
                    }
                }
            }

            if (!modelName && virtualConfigs && virtualConfigs.length > 0) {
                const matchingVirtual = virtualConfigs.find(v => v.name === fieldName);

                if (matchingVirtual?.options.ref) {
                    const refResult = resolveRef(matchingVirtual.options.ref as string | ((doc: unknown) => string | undefined), document);

                    if (refResult && typeof refResult === 'string') {
                        modelName = refResult;
                    }
                }
            }
        }

        if (!modelName) {
            const fieldName = nestedPath.split('.').pop() || '';
            const candidate = fieldName ? fieldName.charAt(0).toUpperCase() + fieldName.slice(1) : '';

            if (candidate && mongoose.models[candidate]) {
                modelName = candidate;
            }
        }
    }

    const Model = mongoose.models[modelName as string];

    if (!Model) {
        return;
    }

    const fieldIdKey = `${nestedPath}Id`;
    const fieldIdsKey = `${nestedPath}Ids`;

    const docIds = document[fieldIdKey] || document[fieldIdsKey] || document[nestedPath];

    if (!docIds) {
        return;
    }

    const idsArray = Array.isArray(docIds) ? docIds : [docIds];

    const populatedDocs = await Model.find({ id: { $in: idsArray } }).lean();

    if (populatedDocs.length > 0) {
        if (Array.isArray(docIds)) {
            document[nestedPath] = populatedDocs;
        }
        else {
            document[nestedPath] = populatedDocs[0];
        }
    }
}
