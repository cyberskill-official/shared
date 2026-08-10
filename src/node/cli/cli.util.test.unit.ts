/**
 * @vitest-environment node
 */

import process from 'node:process';
import { describe, expect, it } from 'vitest';

import { checkMongoMigrateGuard, ENV_FORCE_MIGRATIONS, ENV_MONGO_MIGRATE_DISABLED } from './cli.util.js';

describe('checkMongoMigrateGuard', () => {
    it('should block when MONGO_MIGRATE_DISABLED is true and FORCE_MIGRATIONS is unset', () => {
        const result = checkMongoMigrateGuard({ [ENV_MONGO_MIGRATE_DISABLED]: 'true' });

        expect(result.blocked).toBe(true);
        expect(result).toMatchObject({
            blocked: true,
            message: expect.stringContaining('MongoDB migrations are disabled on this host'),
        });
    });

    it('should include both env var names in the blocked message', () => {
        const result = checkMongoMigrateGuard({ [ENV_MONGO_MIGRATE_DISABLED]: 'true' });

        expect(result.blocked).toBe(true);
        if (result.blocked) {
            expect(result.message).toContain('MONGO_MIGRATE_DISABLED=true');
            expect(result.message).toContain('FORCE_MIGRATIONS=true');
        }
    });

    it('should block when FORCE_MIGRATIONS is set to a non-"true" value', () => {
        const result = checkMongoMigrateGuard({
            [ENV_MONGO_MIGRATE_DISABLED]: 'true',
            [ENV_FORCE_MIGRATIONS]: 'yes',
        });

        expect(result.blocked).toBe(true);
    });

    it('should block when MONGO_MIGRATE_DISABLED is set to a truthy-looking but non-"true" value', () => {
        // Only the exact string 'true' should disable — anything else (e.g. '1') must not.
        const result = checkMongoMigrateGuard({ [ENV_MONGO_MIGRATE_DISABLED]: '1' });

        expect(result.blocked).toBe(false);
    });

    it('should allow migrations when MONGO_MIGRATE_DISABLED is true and FORCE_MIGRATIONS is true', () => {
        const result = checkMongoMigrateGuard({
            [ENV_MONGO_MIGRATE_DISABLED]: 'true',
            [ENV_FORCE_MIGRATIONS]: 'true',
        });

        expect(result).toEqual({ blocked: false });
    });

    it('should allow migrations when MONGO_MIGRATE_DISABLED is unset', () => {
        expect(checkMongoMigrateGuard({})).toEqual({ blocked: false });
    });

    it('should allow migrations when MONGO_MIGRATE_DISABLED is "false"', () => {
        expect(checkMongoMigrateGuard({ [ENV_MONGO_MIGRATE_DISABLED]: 'false' })).toEqual({ blocked: false });
    });

    it('should allow migrations when FORCE_MIGRATIONS is true but MONGO_MIGRATE_DISABLED is unset', () => {
        expect(checkMongoMigrateGuard({ [ENV_FORCE_MIGRATIONS]: 'true' })).toEqual({ blocked: false });
    });

    it('should default to checking process.env when called with no arguments', () => {
        const originalDisabled = process.env[ENV_MONGO_MIGRATE_DISABLED];
        const originalForce = process.env[ENV_FORCE_MIGRATIONS];

        try {
            process.env[ENV_MONGO_MIGRATE_DISABLED] = 'true';
            delete process.env[ENV_FORCE_MIGRATIONS];

            expect(checkMongoMigrateGuard().blocked).toBe(true);

            process.env[ENV_FORCE_MIGRATIONS] = 'true';

            expect(checkMongoMigrateGuard()).toEqual({ blocked: false });
        }
        finally {
            if (originalDisabled === undefined) {
                delete process.env[ENV_MONGO_MIGRATE_DISABLED];
            }
            else {
                process.env[ENV_MONGO_MIGRATE_DISABLED] = originalDisabled;
            }

            if (originalForce === undefined) {
                delete process.env[ENV_FORCE_MIGRATIONS];
            }
            else {
                process.env[ENV_FORCE_MIGRATIONS] = originalForce;
            }
        }
    });
});
