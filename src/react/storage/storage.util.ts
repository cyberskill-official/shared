import { createTtlEnvelope, isExpiredEnvelope, isTtlEnvelope } from '../../util/storage/storage-envelope.js';
import { catchError } from '../log/index.js';

/**
 * Browser storage utility object using native localStorage.
 * This object provides a unified interface for browser storage operations
 * with comprehensive error handling and type safety.
 * Values are stored as JSON strings for consistent serialization.
 */
export const storage = {
    /**
     * Retrieves a value from browser storage by key.
     * This method fetches data that was previously stored using the set method.
     * Returns null if the key doesn't exist or if an error occurs during retrieval.
     *
     * @param key - The unique identifier for the stored value.
     * @returns A promise that resolves to the stored value or null if not found.
     */
    async get<T = unknown>(key: string): Promise<T | null> {
        try {
            const raw = localStorage.getItem(key);

            if (raw === null) {
                return null;
            }

            const obj = JSON.parse(raw);

            if (isTtlEnvelope<T>(obj)) {
                if (isExpiredEnvelope(obj)) {
                    localStorage.removeItem(key);

                    return null;
                }

                return obj.value;
            }

            return obj as T;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: null });
        }
    },
    /**
     * Stores a value in browser storage with a unique key.
     * This method saves data that can be retrieved later using the get method.
     * The data is automatically serialized to JSON.
     *
     * @param key - The unique identifier for the value to store.
     * @param value - The data to store (will be automatically serialized to JSON).
     * @param options - Optional settings.
     * @param options.ttlMs - The time-to-live in milliseconds.
     * @returns A promise that resolves when the storage operation is complete.
     */
    async set<T = unknown>(key: string, value: T, options?: { ttlMs?: number }): Promise<void> {
        try {
            let payloadToStore: unknown = value;

            if (options?.ttlMs) {
                payloadToStore = createTtlEnvelope(value, options.ttlMs);
            }

            localStorage.setItem(key, JSON.stringify(payloadToStore));
        }
        catch (error: unknown) {
            catchError(error);
        }
    },
    /**
     * Removes a value from browser storage by key.
     * This method permanently deletes the stored data associated with the specified key.
     * If the key doesn't exist, the operation completes successfully without error.
     *
     * @param key - The unique identifier of the value to remove.
     * @returns A promise that resolves when the removal operation is complete.
     */
    async remove(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        }
        catch (error: unknown) {
            catchError(error);
        }
    },
    /**
     * Retrieves all storage keys.
     * This method returns an array of all keys that currently have stored values.
     * Returns an empty array if no keys exist or if an error occurs during retrieval.
     *
     * @returns A promise that resolves to an array of storage keys.
     */
    async keys(): Promise<string[]> {
        try {
            const keys: string[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);

                if (key !== null) {
                    keys.push(key);
                }
            }

            return keys;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: [] });
        }
    },
    /**
     * Checks if a key exists in browser storage.
     * This method efficiently checks for key existence without deserializing the value.
     * It also respects TTL — returns false if the key exists but has expired.
     *
     * @param key - The unique identifier to check.
     * @returns A promise that resolves to true if the key exists and has not expired.
     */
    async has(key: string): Promise<boolean> {
        try {
            const raw = localStorage.getItem(key);

            if (raw === null) {
                return false;
            }

            const obj = JSON.parse(raw);

            if (isTtlEnvelope<unknown>(obj)) {
                if (isExpiredEnvelope(obj)) {
                    localStorage.removeItem(key);

                    return false;
                }
            }

            return true;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: false });
        }
    },
    /**
     * Clears all values from browser storage.
     * This method permanently removes all stored data.
     *
     * @returns A promise that resolves when the clear operation is complete.
     */
    async clear(): Promise<void> {
        try {
            localStorage.clear();
        }
        catch (error: unknown) {
            catchError(error);
        }
    },
    /**
     * Returns the number of stored keys in browser storage.
     * This uses `localStorage.length` for O(1) performance.
     *
     * @returns A promise that resolves to the number of stored keys.
     * @since 3.19.0
     */
    async size(): Promise<number> {
        try {
            return localStorage.length;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: 0 });
        }
    },
    /**
     * Retrieves a value from browser storage, or creates and stores it if it doesn't exist.
     * This method combines check, creation, and storage into a single convenient operation.
     *
     * @param key - The unique identifier for the value.
     * @param factory - A function (sync or async) that generates the value if it's missing or expired.
     * @param options - Optional storage options.
     * @param options.ttlMs - The time-to-live in milliseconds.
     * @returns A promise that resolves to the retrieved or newly created value.
     */
    async getOrSet<T = unknown>(key: string, factory: () => T | Promise<T>, options?: { ttlMs?: number }): Promise<T> {
        let value = await this.get<T>(key);

        if (value === null) {
            value = await factory();
            await this.set(key, value, options);
        }

        return value;
    },
};
