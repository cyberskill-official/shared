/**
 * Environment variable key for MongoDB migration options.
 * This constant defines the environment variable name that can be used to configure
 * MongoDB migration settings and options for database schema management.
 */
export const MONGO_MIGRATE_OPTIONS = 'MONGO_MIGRATE_OPTIONS';

/**
 * Maximum number of attempts to generate a unique slug.
 * This constant defines the maximum number of attempts to generate a unique slug
 * before giving up and returning a fallback slug.
 */
export const MONGO_SLUG_MAX_ATTEMPTS = 100;

/**
 * Default maxTimeMS for MongoDB queries.
 * This constant defines the default maximum execution time for MongoDB queries.
 */
export const MONGO_MAX_TIME_MS = 30_000;
