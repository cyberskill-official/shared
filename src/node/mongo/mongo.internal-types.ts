/**
 * Internal type definitions for the mongo module.
 * These types are NOT part of the public API and are used for internal
 * type safety across mongo utility and controller files.
 */

/**
 * Represents a Mongoose Model-like object that has a schema with virtuals and paths.
 * Used instead of `any` when traversing model references internally.
 */
export interface I_ModelWithSchema {
    modelName?: string;
    schema?: I_SchemaLike;
    _virtualConfigs?: I_InternalVirtualConfig[];
}

/**
 * Schema-like structure for internal traversal.
 */
export interface I_SchemaLike {
    virtuals?: Record<string, I_SchemaVirtual>;
    paths?: Record<string, { schema?: I_SchemaLike; instance?: string; [key: string]: unknown }>;
    statics?: Record<string, unknown>;
}

/**
 * A virtual field definition within a schema.
 */
export interface I_SchemaVirtual {
    options?: {
        ref?: string | ((doc: unknown) => string | undefined);
        localField?: string;
        foreignField?: string;
        count?: boolean;
        justOne?: boolean;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

/**
 * Internal shape of a virtual config stored on the model (via _virtualConfigs or _dynamicVirtuals statics).
 */
export interface I_InternalVirtualConfig {
    name: string;
    options?: {
        ref?: string | ((doc: unknown) => string | undefined);
        [key: string]: unknown;
    };
}

/**
 * Resolves a `ref` value (which can be a string or a function) to a model name string.
 * This is a central helper that replaces the 9 duplicated ref-resolution blocks
 * throughout the mongo module.
 *
 * @param ref - The ref value, either a string or a function that returns a string.
 * @param doc - The document to pass to the ref function (if ref is a function).
 * @returns The resolved model name string, or undefined if resolution fails.
 */
export function resolveRef(
    ref: string | ((doc: unknown) => string | undefined) | undefined,
    doc?: unknown,
): string | undefined {
    if (!ref) {
        return undefined;
    }

    if (typeof ref === 'function') {
        return ref(doc);
    }

    if (typeof ref === 'string') {
        return ref;
    }

    return undefined;
}

/**
 * Retrieves the dynamic virtual configurations from a model's _virtualConfigs
 * or schema.statics._dynamicVirtuals.
 *
 * @param model - The model to search for dynamic virtuals.
 * @returns An array of internal virtual configs, or an empty array if none found.
 */
export function getDynamicVirtualConfigs(model: I_ModelWithSchema | undefined): I_InternalVirtualConfig[] {
    if (!model) {
        return [];
    }

    const virtualConfigs = model._virtualConfigs;
    if (virtualConfigs && virtualConfigs.length > 0) {
        return virtualConfigs;
    }

    const statics = model.schema?.statics;
    if (statics) {
        const dynamicVirtuals = statics['_dynamicVirtuals'] as I_InternalVirtualConfig[] | undefined;

        if (dynamicVirtuals && dynamicVirtuals.length > 0) {
            return dynamicVirtuals;
        }
    }

    return [];
}

/**
 * Recursively searches a schema's virtuals (including nested path schemas)
 * for a virtual with the given field name and returns the resolved model name.
 *
 * This function was previously duplicated twice (verbatim) inside
 * `populateNestedFieldOnParent` in `mongo.populate.ts`.
 *
 * @param schemaToSearch - The schema to search.
 * @param fieldName - The virtual field name to look for.
 * @param document - The document context for resolving function refs.
 * @returns The resolved model name, or undefined.
 */
export function searchVirtualsInSchema(
    schemaToSearch: I_SchemaLike | undefined,
    fieldName: string,
    document: Record<string, unknown>,
): string | undefined {
    if (!schemaToSearch || !schemaToSearch.virtuals) {
        return undefined;
    }

    const virtuals = schemaToSearch.virtuals;

    for (const virtualName of Object.keys(virtuals)) {
        if (virtualName === fieldName) {
            const virtual = virtuals[virtualName];
            if (virtual?.options?.ref) {
                const refResult = resolveRef(virtual.options.ref, document);
                if (refResult && typeof refResult === 'string') {
                    return refResult;
                }
            }
        }
    }

    if (schemaToSearch.paths) {
        for (const pathName of Object.keys(schemaToSearch.paths)) {
            const pathSchema = schemaToSearch.paths[pathName];

            if (pathSchema?.schema) {
                const nestedResult = searchVirtualsInSchema(pathSchema.schema, fieldName, document);

                if (nestedResult) {
                    return nestedResult;
                }
            }
        }
    }

    return undefined;
}
