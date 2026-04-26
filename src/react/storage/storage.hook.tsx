import { useCallback, useEffect, useState } from 'react';

import type { I_Serializer } from '#util/serializer/index.js';

import { serializer as defaultSerializer } from '#util/serializer/index.js';

import { catchError } from '../log/index.js';
import { storage } from './storage.util.js';

/**
 * React hook that provides persistent storage functionality with automatic serialization.
 * This hook manages state that persists across browser sessions using localStorage,
 * with automatic serialization/deserialization of complex data types. It provides
 * a React-friendly interface for storage operations with proper error handling.
 *
 * Features:
 * - Automatic data serialization and deserialization
 * - Persistent storage across browser sessions
 * - Initial value handling and fallback
 * - Error handling with graceful degradation
 * - Automatic storage synchronization
 * - Support for complex data types via custom serializers
 *
 * @param key - The unique storage key for the data.
 * @param initialValue - Optional initial value to use if no stored value exists.
 * @param serializer - Optional custom serializer for complex data types (defaults to JSON serializer).
 * @returns An object containing the current value, set function, and remove function.
 */
export function useStorage<T>(
    key: string,
    initialValue?: T,
    serializer: I_Serializer<T> = defaultSerializer as I_Serializer<T>,
) {
    const [value, setValue] = useState<T | undefined>(initialValue);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadValue = async () => {
            try {
                const valueFound = await storage.get<string>(key);

                if (isMounted) {
                    if (valueFound !== null) {
                        const parsedValue = serializer.deserialize(valueFound);
                        setValue(parsedValue);
                    }
                    else if (initialValue !== undefined) {
                        const serialized = serializer.serialize(initialValue);
                        await storage.set(key, serialized);
                        setValue(initialValue);
                    }
                    else {
                        setValue(undefined);
                    }
                }
            }
            catch (error: unknown) {
                catchError(error);

                if (isMounted) {
                    setValue(initialValue);
                }
            }
            finally {
                if (isMounted)
                    setIsLoaded(true);
            }
        };

        loadValue();

        return () => {
            isMounted = false;
            setIsLoaded(false);
        };
    }, [key, initialValue, serializer]);

    useEffect(() => {
        if (!isLoaded)
            return;

        const saveValue = async () => {
            try {
                if (value !== undefined) {
                    const serialized = serializer.serialize(value);
                    await storage.set(key, serialized);
                }
            }
            catch (error: unknown) {
                catchError(error);
            }
        };

        saveValue();
    }, [value, key, serializer, isLoaded]);

    const set = useCallback(
        (newValue: T | ((val: T | undefined) => T)) => {
            setValue((prev) => {
                if (typeof newValue === 'function') {
                    return (newValue as (val: T | undefined) => T)(prev);
                }
                return newValue;
            });
        },
        [],
    );

    const remove = useCallback(async () => {
        try {
            await storage.remove(key);
            setValue(undefined);
        }
        catch (error: unknown) {
            catchError(error);
        }
    }, [key]);

    return { value, set, remove };
}
