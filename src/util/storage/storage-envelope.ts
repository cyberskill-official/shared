/**
 * Represents a wrapped storage value that includes Time-to-Live (TTL) expiration metadata.
 * @since 3.13.0
 */
export interface I_StorageEnvelope<T> {
    __isTtlEnvelope: true;
    expiresAt?: number;
    value: T;
}

/**
 * Checks whether an unknown storage payload is a valid TTL envelope.
 * @since 3.13.0
 */
export function isTtlEnvelope<T>(payload: unknown): payload is I_StorageEnvelope<T> {
    return (
        typeof payload === 'object'
        && payload !== null
        && '__isTtlEnvelope' in payload
    );
}

/**
 * Checks if a TTL envelope has expired based on its timestamp.
 * Returns true if the envelope has an expiration time and that time has passed.
 * @since 3.13.0
 */
export function isExpiredEnvelope<T>(envelope: I_StorageEnvelope<T>): boolean {
    return Boolean(envelope.expiresAt && Date.now() > envelope.expiresAt);
}

/**
 * Wraps a value in a TTL envelope with the specified expiration duration.
 * @since 3.13.0
 */
export function createTtlEnvelope<T>(value: T, ttlMs: number): I_StorageEnvelope<T> {
    return {
        __isTtlEnvelope: true,
        expiresAt: Date.now() + ttlMs,
        value,
    };
}
