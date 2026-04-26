/**
 * Set of keys that can trigger prototype mutation when used as property names
 * during object traversal. Only `__proto__` is included because it is the sole
 * key that actually mutates the prototype chain when assigned as an own property
 * (via the Object.prototype `__proto__` setter). Keys like `constructor` and
 * `prototype` are legitimate data-field names on plain objects and must NOT be
 * blocked, as doing so would silently drop valid data.
 */
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__']);

/**
 * MongoDB operators that execute arbitrary server-side JavaScript or perform
 * unexpected writes/reads. These MUST be rejected in user-supplied filters to
 * prevent NoSQL injection (CWE-943) and unauthorized data access.
 *
 * - `$where`       — evaluates a JavaScript expression for each document
 * - `$function`    — runs a user-defined JavaScript function
 * - `$accumulator` — runs a JavaScript accumulator in aggregation pipelines
 * - `$merge`       — writes query results to a different collection
 * - `$out`         — replaces an entire collection with query results
 * - `$lookup`      — performs cross-collection joins (data exfiltration risk in user filters)
 *
 * @security Blocking these operators is a critical defense-in-depth measure.
 *           If your aggregation pipeline legitimately needs `$lookup` or `$merge`,
 *           build the pipeline server-side — do not pass these through user-facing filters.
 */
const DANGEROUS_MONGO_OPERATORS = new Set(['$where', '$function', '$accumulator', '$merge', '$out', '$lookup']);

/**
 * Check if a string is a valid JSON string.
 * This function attempts to parse the string as JSON and returns true if successful,
 * false if the string is not valid JSON.
 *
 * @param str - The string to check for valid JSON format.
 * @returns True if the string is a valid JSON string, false otherwise.
 */
export function isJSON(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    }
    catch {
        /* Intentionally empty — invalid JSON returns false */
        return false;
    }
}

/**
 * Gets a nested value from an object using a path array.
 * This function traverses the object following the provided path and returns
 * the value at the specified location, or undefined if the path doesn't exist.
 *
 * @param obj - The object to get the value from.
 * @param path - An array of keys representing the path to the desired value.
 * @returns The value at the specified path, or undefined if the path doesn't exist.
 */
export function getNestedValue<T>(obj: T, path: (string | number)[]): unknown {
    // Optimization: Loop is faster than reduce and allows early exit
    let current: unknown = obj;
    const len = path.length;

    for (let i = 0; i < len; i++) {
        // Optimization: Early return if current value is null/undefined or not an object
        // This avoids unnecessary key lookups and type checks
        if (current == null || typeof current !== 'object') {
            return undefined;
        }

        const key = path[i];

        if (key !== undefined && key in (current as Record<string | number, unknown>)) {
            current = (current as Record<string | number, unknown>)[key];
        }
        else {
            return undefined;
        }
    }

    return current;
}

/**
 * Recursively sets a value at a nested path within an object, creating intermediate objects as needed.
 *
 * @param obj - The source object.
 * @param path - Array of keys forming the path.
 * @param value - The value to set.
 * @param index - Current recursion depth.
 * @returns A new object with the value set at the specified path.
 */
function setNestedValueHelper<T>(obj: T, path: (string | number)[], value: unknown, index: number): T {
    if (index >= path.length)
        return obj;

    const head = path[index];

    if (typeof head === 'string' && PROTOTYPE_POLLUTION_KEYS.has(head)) {
        return obj;
    }

    if (index === path.length - 1) {
        return {
            ...(obj as Record<string | number, unknown>),
            [head as string | number]: value,
        } as T;
    }

    const current = (obj as Record<string | number, unknown>)[head as string | number];

    return {
        ...(obj as Record<string | number, unknown>),
        [head as string | number | symbol]: setNestedValueHelper(
            typeof current === 'object' && current !== null
                ? (current as object)
                : {},
            path,
            value,
            index + 1,
        ),
    } as T;
}

/**
 * Sets a nested value in an object using a path array.
 * This function creates the path if it doesn't exist and sets the value at the specified location.
 * The function returns a new object with the updated value, maintaining immutability.
 *
 * @param obj - The object to set the value in.
 * @param path - An array of keys representing the path to the desired location.
 * @param value - The value to set at the specified path.
 * @returns A new object with the updated value at the specified path.
 */
export function setNestedValue<T>(obj: T, path: (string | number)[], value: unknown): T {
    if (path.length === 0)
        return obj;

    return setNestedValueHelper(obj, path, value, 0);
}

/**
 * Deep clones an object or array.
 * This function creates a deep copy of the input, recursively cloning objects and arrays.
 * Primitive values, dates, and other non-plain objects are returned as is (or cloned if supported).
 *
 * @remarks
 * **Non-POJO objects are NOT cloned.** Objects with custom prototypes (e.g., Mongoose ObjectId,
 * class instances, Map, Set, Buffer) are returned **by reference** to preserve driver
 * compatibility. Mutations to these nested references will affect the original.
 * If you need full deep cloning of complex types, use `structuredClone()` or a dedicated library.
 *
 * @param obj - The object to clone.
 * @returns A deep copy of the object (with non-POJO objects returned by reference).
 */
export function deepClone<T>(obj: T): T {
    return deepCloneInternal(obj, new WeakMap<object, unknown>());
}

/**
 * Internal recursive implementation of deepClone with shared-reference and circular-reference handling.
 *
 * Uses a WeakMap to track already-cloned objects. This correctly handles:
 * - **Shared references**: The same object appearing in multiple places returns
 *   the same clone (preserving the shared-reference topology).
 * - **Circular references**: Detected because the object is added to the map
 *   before* its children are recursed into; a back-edge will find itself in
 *   the map and return the (partially constructed) clone rather than recursing
 *   infinitely.
 *
 * @param obj - The value to clone.
 * @param seen - A WeakMap mapping original objects to their clones.
 * @returns A deep copy of the value.
 */
function deepCloneInternal<T>(obj: T, seen: WeakMap<object, unknown>): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Return the already-cloned copy for shared (or circular) references
    if (seen.has(obj as object)) {
        return seen.get(obj as object) as T;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags) as unknown as T;
    }

    if (Array.isArray(obj)) {
        // Optimization: `new Array(len)` + `for` loop is ~10-15% faster than `Array.map` or `Array.from`
        // for large arrays since it avoids callback overhead and pre-allocates memory.
        const len = obj.length;
        // eslint-disable-next-line unicorn/no-new-array -- Pre-allocating array size for performance
        const arr = new Array(len);
        // Register before recursing to handle circular references within arrays
        seen.set(obj as object, arr);

        for (let i = 0; i < len; i++) {
            arr[i] = deepCloneInternal(obj[i], seen);
        }

        return arr as unknown as T;
    }

    // Handle Mongoose ObjectId and other custom classes by returning reference.
    // structuredClone is not used here because it silently corrupts nested non-POJO
    // types (e.g., ObjectId → plain object) and Date instances in jsdom environments.
    const proto = Object.getPrototypeOf(obj);

    if (proto !== Object.prototype && proto !== null) {
        return obj;
    }

    const result = {} as Record<string, unknown>;
    // Register before recursing to handle circular references within objects
    seen.set(obj as object, result);

    for (const key in obj) {
        if (PROTOTYPE_POLLUTION_KEYS.has(key))
            continue;
        if (Object.hasOwn(obj, key)) {
            result[key] = deepCloneInternal((obj as Record<string, unknown>)[key], seen);
        }
    }

    return result as T;
}

/**
 * Deep merges multiple objects into a single object.
 * @param args - The objects to merge. Can be empty, in which case returns an empty object.
 * @returns The merged object.
 */
export function deepMerge<T = Record<string, unknown>>(
    ...args: (object | null | undefined)[]
): T;

/**
 * Deep merges multiple arrays into a single array.
 * @param args - The arrays to merge. Can be empty, in which case returns an empty array.
 * @returns The merged array.
 */
export function deepMerge<T = unknown[]>(
    ...args: (unknown[] | null | undefined)[]
): T;

/**
 * Implementation of deepMerge function.
 * @param args - The objects or arrays to merge.
 * @returns The merged result.
 */
export function deepMerge<T = Record<string, unknown> | unknown[]>(
    ...args: (object | unknown[] | null | undefined)[]
): T {
    const MAX_DEPTH = 20;

    /** Recursively merges an array of objects with depth and circular-reference tracking. */
    function mergeRecursive(
        validArgs: object[],
        depth: number,
        seen: WeakSet<object>,
    ): unknown {
        // Depth guard
        if (depth > MAX_DEPTH) {
            throw new Error(`deepMerge: Maximum depth of ${MAX_DEPTH} exceeded. Possible circular reference or excessively nested objects.`);
        }

        // Handle empty arguments
        if (validArgs.length === 0) {
            return {};
        }

        // If only one argument, return it directly
        if (validArgs.length === 1) {
            return validArgs[0];
        }

        // Check if all arguments are arrays
        if (validArgs.every(Array.isArray)) {
            return (validArgs as unknown[][]).flat();
        }

        // Check if all arguments are objects (but not arrays)
        if (validArgs.every(arg => typeof arg === 'object' && arg !== null && !Array.isArray(arg))) {
            const result = {} as Record<string, unknown>;

            for (const arg of validArgs) {
                // Circular reference protection (per-arg scope prevents false
                // positives when the same object appears in multiple branches)
                if (seen.has(arg)) {
                    throw new Error('deepMerge: Circular reference detected.');
                }

                const obj = arg as Record<string, unknown>;

                for (const key in obj) {
                    if (PROTOTYPE_POLLUTION_KEYS.has(key))
                        continue;
                    if (Object.hasOwn(obj, key)) {
                        const value = obj[key];

                        if (Object.hasOwn(result, key)) {
                            const existingValue = result[key];

                            if (
                                typeof value === 'object' && value !== null
                                && typeof existingValue === 'object' && existingValue !== null
                            ) {
                                if (Array.isArray(value) && Array.isArray(existingValue)) {
                                    result[key] = [...existingValue, ...value];
                                }
                                else if (!Array.isArray(value) && !Array.isArray(existingValue)) {
                                    result[key] = mergeRecursive(
                                        [existingValue as Record<string, unknown>, value as Record<string, unknown>],
                                        depth + 1,
                                        seen,
                                    );
                                }
                                else {
                                    // One is array, other is object — overwrite
                                    result[key] = value;
                                }
                            }
                            else {
                                result[key] = value;
                            }
                        }
                        else {
                            result[key] = value;
                        }
                    }
                }
            }

            return result;
        }

        // Check if all arguments are primitive values
        if (validArgs.every(arg => typeof arg !== 'object' || arg === null)) {
            throw new Error(
                'deepMerge: Cannot merge primitive values. All arguments must be objects or arrays.',
            );
        }

        // Mixed types error
        const hasArrays = validArgs.some(Array.isArray);
        const hasObjects = validArgs.some(arg =>
            typeof arg === 'object' && arg !== null && !Array.isArray(arg),
        );

        if (hasArrays && hasObjects) {
            throw new Error(
                'deepMerge: Cannot mix arrays and objects. All arguments must be either arrays or objects.',
            );
        }

        // Fallback for unexpected cases
        throw new Error(
            'deepMerge: Invalid arguments provided. All arguments must be objects or arrays of the same type.',
        );
    }

    // Filter out null/undefined
    const validArgs = args.filter((arg): arg is object => arg !== null && arg !== undefined);

    return mergeRecursive(validArgs, 0, new WeakSet<object>()) as T;
}

/**
 * Normalizes MongoDB filters to support both dot notation strings and nested objects.
 * This function converts nested object filters to dot notation format while preserving
 * MongoDB operators to ensure consistent behavior across different filter input formats.
 *
 * @param filter - The filter object to normalize.
 * @returns A normalized filter object with nested objects converted to dot notation,
 *          while preserving MongoDB operators as nested objects.
 *
 * @example
 * ```typescript
 * // Both of these will work the same way:
 * normalizeMongoFilter({ "location.countryId": "240" })
 * normalizeMongoFilter({ location: { countryId: "240" } })
 * // Both return: { "location.countryId": "240" }
 *
 * // MongoDB operators are preserved:
 * normalizeMongoFilter({ id: { $in: ["240", "59"] } })
 * // Returns: { id: { $in: ["240", "59"] } }
 * ```
 */
export function normalizeMongoFilter<T extends Record<string, unknown>>(filter: T): T {
    if (!filter || typeof filter !== 'object') {
        return filter;
    }

    let isFlat = true;

    for (const key in filter) {
        if (!Object.hasOwn(filter, key)) {
            continue;
        }
        const value = filter[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            isFlat = false;
            break;
        }
    }

    if (isFlat) {
        return filter;
    }

    const normalized: Record<string, unknown> = {};
    const MAX_DEPTH = 10;

    /**
     * Recursively flattens nested objects into dot-notation keys, preserving MongoDB operators.
     */
    function flatten(current: Record<string, unknown>, prefix: string, depth: number) {
        if (depth > MAX_DEPTH) {
            throw new Error(`normalizeMongoFilter: Maximum depth of ${MAX_DEPTH} exceeded. Possible circular reference or excessively nested filter.`);
        }

        for (const key in current) {
            if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
                continue;
            }
            if (!Object.hasOwn(current, key)) {
                continue;
            }
            const value = current[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Fast-path POJO check: `.constructor` is safe even on null-prototype objects
                // (returns undefined, so the === Object check simply fails and falls through
                // to the getPrototypeOf check which correctly identifies it as a POJO).
                const isPojo = (value as object).constructor === Object
                    || Object.getPrototypeOf(value) === null;

                if (!isPojo) {
                    normalized[newKey] = value;
                    continue;
                }

                // Check for Mongo operator
                let hasMongoOperator = false;

                for (const subKey in value as Record<string, unknown>) {
                    if (Object.hasOwn(value, subKey) && subKey.startsWith('$')) {
                        hasMongoOperator = true;
                        break;
                    }
                }

                if (hasMongoOperator) {
                    // Security: Block operators that execute arbitrary JS inside MongoDB (CWE-943)
                    for (const subKey in value as Record<string, unknown>) {
                        if (Object.hasOwn(value, subKey) && DANGEROUS_MONGO_OPERATORS.has(subKey)) {
                            throw new Error(`normalizeMongoFilter: Dangerous operator "${subKey}" is not allowed. This operator can execute arbitrary JavaScript on the server.`);
                        }
                    }

                    normalized[newKey] = value;
                }
                else {
                    flatten(value as Record<string, unknown>, newKey, depth + 1);
                }
            }
            else {
                normalized[newKey] = value;
            }
        }
    }

    flatten(filter, '', 0);

    return normalized as T;
}

/**
 * Creates a new object with only the specified keys from the source object.
 * Non-existent keys are silently ignored.
 *
 * @param obj - The source object to pick keys from.
 * @param keys - An array of keys to include in the result.
 * @returns A new object containing only the specified keys and their values.
 *
 * @example
 * ```typescript
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']); // { a: 1, c: 3 }
 * ```
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: readonly K[],
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    const keySet = new Set<K>(keys);

    for (const key of keySet) {
        if (Object.hasOwn(obj, key as string)) {
            result[key] = obj[key];
        }
    }

    return result;
}

/**
 * Creates a new object without the specified keys from the source object.
 *
 * @param obj - The source object to omit keys from.
 * @param keys - An array of keys to exclude from the result.
 * @returns A new object without the specified keys.
 *
 * @example
 * ```typescript
 * omit({ a: 1, b: 2, c: 3 }, ['b']); // { a: 1, c: 3 }
 * ```
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: readonly K[],
): Omit<T, K> {
    const result = {} as Record<string, unknown>;
    const keySet = new Set<string>(keys as unknown as string[]);

    for (const key in obj) {
        if (Object.hasOwn(obj, key) && !keySet.has(key)) {
            result[key] = obj[key];
        }
    }

    return result as Omit<T, K>;
}
