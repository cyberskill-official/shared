import process from 'node:process';

/**
 * Environment variable that, when set to the string `'true'`, disables MongoDB migrations on
 * this host. Intended for follower/read-replica origins in a geo-distributed deployment that
 * must never run migrations — only the migration owner should apply them.
 */
export const ENV_MONGO_MIGRATE_DISABLED = 'MONGO_MIGRATE_DISABLED';

/**
 * Environment variable that, when set to the string `'true'`, overrides
 * {@link ENV_MONGO_MIGRATE_DISABLED} and allows migrations to run anyway on this host.
 * Intended as a deliberate, explicit escape hatch — never set it as a default.
 */
export const ENV_FORCE_MIGRATIONS = 'FORCE_MIGRATIONS';

/**
 * Result of {@link checkMongoMigrateGuard} when migrations are allowed to proceed.
 */
interface I_MongoMigrateGuardAllowed {
    blocked: false;
}

/**
 * Result of {@link checkMongoMigrateGuard} when migrations must not run on this host.
 */
interface I_MongoMigrateGuardBlocked {
    blocked: true;
    message: string;
}

export type T_MongoMigrateGuardResult = I_MongoMigrateGuardAllowed | I_MongoMigrateGuardBlocked;

/**
 * Determines whether MongoDB migrations must be blocked on this host.
 *
 * This is a pure function over an env-like record so it can be unit tested without mutating
 * `process.env` — the CLI calls it with no arguments to check the real `process.env`.
 *
 * @remarks
 * Migrations are blocked when {@link ENV_MONGO_MIGRATE_DISABLED} is the string `'true'`,
 * unless {@link ENV_FORCE_MIGRATIONS} is also the string `'true'`, in which case the disable
 * flag is explicitly overridden and migrations are allowed to proceed.
 *
 * @param env - Environment variables to check. Defaults to `process.env`.
 * @returns `{ blocked: true, message }` when migrations must not run on this host, with a
 * human-readable explanation; `{ blocked: false }` when migrations are allowed to proceed.
 */
export function checkMongoMigrateGuard(
    env: Record<string, string | undefined> = process.env,
): T_MongoMigrateGuardResult {
    const isDisabled = env[ENV_MONGO_MIGRATE_DISABLED] === 'true';
    const isForced = env[ENV_FORCE_MIGRATIONS] === 'true';

    if (isDisabled && !isForced) {
        return {
            blocked: true,
            message: `MongoDB migrations are disabled on this host (${ENV_MONGO_MIGRATE_DISABLED}=true). This host is not the migration owner. Set ${ENV_FORCE_MIGRATIONS}=true to override.`,
        };
    }

    return { blocked: false };
}
