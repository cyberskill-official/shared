import fs from 'node:fs/promises';
import path from 'node:path';

import { getEnv } from '#config/env/index.js';

import { createTtlEnvelope, isExpiredEnvelope, isTtlEnvelope } from '../../util/storage/storage-envelope.js';
import { catchError, log } from '../log/index.js';
import { STORAGE_KEY_EXTENSION } from './storage.constant.js';

const MAX_KEY_LENGTH = 200;

interface NodeFsDriverState {
    baseDir: string;
}

export interface I_StorageDriver {
    init: (options?: unknown) => Promise<void>;
    clear: () => Promise<void>;
    getItem: <T>(key: string) => Promise<T | null>;
    keys: () => Promise<string[]>;
    removeItem: (key: string) => Promise<void>;
    setItem: <T>(key: string, value: T) => Promise<T>;
}

const nodeFsDriverState: NodeFsDriverState = {
    baseDir: '',
};

/**
 * Encodes a storage key into a filename-safe string.
 * Validates key length before encoding to prevent OS filename limits.
 *
 * @throws {RangeError} When key exceeds maximum length.
 */
function encodeKey(key: string): string {
    if (key.length > MAX_KEY_LENGTH) {
        throw new RangeError(`Storage key exceeds maximum length of ${MAX_KEY_LENGTH} characters`);
    }
    return `${encodeURIComponent(key)}${STORAGE_KEY_EXTENSION}`;
}

/**
 * Decodes a filename-safe key back to the original storage key.
 */
function decodeKey(fileName: string): string {
    return decodeURIComponent(fileName.slice(0, -STORAGE_KEY_EXTENSION.length));
}

/**
 * Maps a storage key to an absolute file path inside the storage directory.
 */
function getFilePath(key: string, baseDir: string): string {
    return path.join(baseDir, encodeKey(key));
}

/**
 * Filesystem-backed storage driver that stores JSON-encoded values on disk.
 * Directly implements all storage operations without any external dependencies.
 */
const fsDriver: I_StorageDriver = {
    /** Ensures the storage directory exists. */
    async init(baseDir?: unknown) {
        try {
            if (typeof baseDir === 'string' && baseDir.length > 0) {
                nodeFsDriverState.baseDir = baseDir;
            }
            else {
                nodeFsDriverState.baseDir = getEnv().CYBERSKILL_STORAGE_DIRECTORY;
            }

            await fs.mkdir(nodeFsDriverState.baseDir, { recursive: true });
        }
        catch (error: unknown) {
            log.error('[Storage:init]', error);
            throw error;
        }
    },
    /** Deletes all stored entries atomically by swapping to a fresh directory. */
    async clear() {
        const { baseDir } = nodeFsDriverState;

        if (!baseDir) {
            return;
        }

        // Atomic swap: create a fresh temp dir, rename old→trash, rename fresh→baseDir, remove trash
        const trashDir = `${baseDir}.trash.${Date.now()}`;
        const freshDir = `${baseDir}.fresh.${Date.now()}`;

        try {
            await fs.mkdir(freshDir, { recursive: true });
            // Try atomic rename swap
            try {
                await fs.rename(baseDir, trashDir);
            }
            catch {
                // baseDir might not exist yet; no-op
            }
            await fs.rename(freshDir, baseDir);
            // Clean up trash in the background (non-blocking)
            fs.rm(trashDir, { recursive: true, force: true }).catch(() => { });
        }
        catch {
            // Fallback: non-atomic clear (e.g., cross-device rename)
            await fs.rm(baseDir, { recursive: true, force: true });
            await fs.mkdir(baseDir, { recursive: true });
            // Clean up any leftover temp dirs
            fs.rm(freshDir, { recursive: true, force: true }).catch(() => { });
            fs.rm(trashDir, { recursive: true, force: true }).catch(() => { });
        }
    },
    /** Reads and parses a stored value; returns null when the file is missing. */
    async getItem<T>(key: string): Promise<T | null> {
        const { baseDir } = nodeFsDriverState;
        const filePath = getFilePath(key, baseDir);

        try {
            const content = await fs.readFile(filePath, 'utf8');

            return JSON.parse(content) as T;
        }
        catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    },
    /** Lists all stored keys. */
    async keys(): Promise<string[]> {
        const { baseDir } = nodeFsDriverState;

        try {
            const files = await fs.readdir(baseDir);

            return files
                .filter(file => file.endsWith(STORAGE_KEY_EXTENSION))
                .map(decodeKey);
        }
        catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    },
    /** Removes a stored value for the given key. */
    async removeItem(key: string): Promise<void> {
        const { baseDir } = nodeFsDriverState;
        const filePath = getFilePath(key, baseDir);

        await fs.rm(filePath, { force: true });
    },
    /** Stores a value as JSON on disk. */
    async setItem<T>(key: string, value: T): Promise<T> {
        const { baseDir } = nodeFsDriverState;
        const filePath = getFilePath(key, baseDir);

        await fs.mkdir(baseDir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(value), 'utf8');

        return value;
    },
};

let initPromise: Promise<void> | null = null;
let activeDriver: I_StorageDriver = fsDriver;

/**
 * Initializes the storage driver (singleton, idempotent).
 */
async function ensureDriverReady(): Promise<I_StorageDriver> {
    if (initPromise) {
        await initPromise;
        return activeDriver;
    }

    initPromise = activeDriver.init().catch((error) => {
        initPromise = null;
        throw error;
    });

    await initPromise;

    return activeDriver;
}

/**
 * Persistent storage utility object for data persistence across application sessions.
 * Uses a filesystem-backed driver that stores JSON-encoded values on disk,
 * with automatic initialization and error handling.
 */
export const storage = {
    /**
     * Initializes the utility with a custom storage driver instead of the default filesystem driver.
     * This allows swapping to Redis, Memory, or cloud-based drivers.
     * Must optionally be called before the first read/write operation.
     *
     * @param driver - The custom storage driver object that adheres to I_StorageDriver.
     */
    async initDriver(driver: I_StorageDriver): Promise<void> {
        activeDriver = driver;
        initPromise = null;
        await ensureDriverReady();
    },
    /**
     * Retrieves a value from persistent storage by key.
     * This method fetches data that was previously stored using the set method.
     * Returns null if the key doesn't exist or if an error occurs.
     *
     * @param key - The unique identifier for the stored value.
     * @returns A promise that resolves to the stored value or null if not found.
     */
    async get<T = unknown>(key: string): Promise<T | null> {
        try {
            const driver = await ensureDriverReady();
            const result = await driver.getItem<unknown>(key);

            if (result === null) {
                return null;
            }

            if (isTtlEnvelope<T>(result)) {
                if (isExpiredEnvelope(result)) {
                    driver.removeItem(key).catch(() => { });

                    return null;
                }

                return result.value;
            }

            return result as T;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: null });
        }
    },
    /**
     * Stores a value in persistent storage with a unique key.
     * This method saves data that can be retrieved later using the get method.
     * The data is automatically serialized and stored in the configured storage directory.
     *
     * @param key - The unique identifier for the value to store.
     * @param value - The data to store (will be automatically serialized).
     * @param options - Optional settings, such as `ttlMs` for setting an expiration on the key.
     * @param options.ttlMs - The time-to-live in milliseconds.
     * @returns A promise that resolves when the storage operation is complete.
     */
    async set<T = unknown>(key: string, value: T, options?: { ttlMs?: number }): Promise<void> {
        try {
            const driver = await ensureDriverReady();

            let payloadToStore: unknown = value;

            if (options?.ttlMs) {
                payloadToStore = createTtlEnvelope(value, options.ttlMs);
            }

            await driver.setItem(key, payloadToStore);
        }
        catch (error: unknown) {
            catchError(error);
            throw error;
        }
    },
    /**
     * Removes a value from persistent storage by key.
     * This method permanently deletes the stored data associated with the specified key.
     *
     * @param key - The unique identifier of the value to remove.
     * @returns A promise that resolves when the removal operation is complete.
     */
    async remove(key: string): Promise<void> {
        try {
            const driver = await ensureDriverReady();

            await driver.removeItem(key);
        }
        catch (error: unknown) {
            catchError(error);
        }
    },
    /**
     * Checks if a key exists in persistent storage.
     * This method efficiently checks for key existence and respects TTL parsing.
     * Returns false if the key exists but has expired.
     *
     * @param key - The unique identifier to check.
     * @returns A promise that resolves to true if the key exists and has not expired.
     * @since 3.13.0
     */
    async has(key: string): Promise<boolean> {
        try {
            const driver = await ensureDriverReady();
            const result = await driver.getItem<unknown>(key);

            if (result === null) {
                return false;
            }

            if (isTtlEnvelope<unknown>(result)) {
                if (isExpiredEnvelope(result)) {
                    driver.removeItem(key).catch(() => { });

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
     * Clears all entries from storage atomically.
     * @returns A promise that resolves when the clearing operation is complete.
     */
    async clear(): Promise<void> {
        try {
            const driver = await ensureDriverReady();
            await driver.clear();
        }
        catch (error: unknown) {
            catchError(error);
        }
    },
    /**
     * Retrieves all storage keys.
     * This method returns an array of all keys that currently have stored values.
     * Returns an empty array if no keys exist or if an error occurs.
     *
     * @returns A promise that resolves to an array of storage keys.
     */
    async keys(): Promise<string[]> {
        try {
            const driver = await ensureDriverReady();
            const keys = await driver.keys();

            if (!Array.isArray(keys)) {
                log.warn(`[Storage:keys] Invalid keys response:`, keys);
                return [];
            }

            return keys;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: [] });
        }
    },
    /**
     * Gets a human-readable log link for a storage key.
     * This method provides a formatted string that shows the storage directory path
     * and the key name for debugging and manual inspection purposes.
     *
     * @param key - The storage key to generate a log link for.
     * @returns A promise that resolves to a formatted log link string or null if an error occurs.
     */
    async getLogLink(key: string): Promise<string | null> {
        try {
            const storagePath = path.join(getEnv().CYBERSKILL_STORAGE_DIRECTORY, encodeKey(key));

            return `${storagePath} (key: ${key})`;
        }
        catch (error: unknown) {
            return catchError(error, { returnValue: null });
        }
    },
    /**
     * Returns the number of stored keys.
     * Expired TTL entries are NOT pre-cleaned; use this for approximate counts
     * or monitoring, not as a precise non-expired count.
     *
     * @returns A promise that resolves to the number of stored keys.
     * @since 3.19.0
     */
    async size(): Promise<number> {
        const allKeys = await this.keys();

        return allKeys.length;
    },
    /**
     * Retrieves a value from persistent storage, or creates and stores it if it doesn't exist.
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

/**
 * Resets all module-level singleton state used by the storage module.
 * Intended for use in tests to ensure isolation between test cases.
 * Do NOT call this in production code.
 * @since 3.13.0
 */
export function resetStorageForTesting(): void {
    initPromise = null;
    activeDriver = fsDriver;
    nodeFsDriverState.baseDir = '';
}
