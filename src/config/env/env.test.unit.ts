/**
 * @vitest-environment node
 */

import dotenvx from '@dotenvx/dotenvx';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CYBERSKILL_STORAGE_DIRECTORY } from './env.constant.js';
import { getEnv, loadEnvFile, resetEnvForTesting } from './env.util.js';

vi.mock('@dotenvx/dotenvx', () => ({
    default: { config: vi.fn() },
}));

describe('env', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        resetEnvForTesting();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('loadEnvFile', () => {
        it('should call dotenvx.config in non-production environment', () => {
            process.env['NODE_ENV'] = 'development';
            loadEnvFile();
            expect(dotenvx.config).toHaveBeenCalled();
        });

        it('should prevent multiple loads (idempotent)', () => {
            const callCountBefore = vi.mocked(dotenvx.config).mock.calls.length;
            loadEnvFile();
            loadEnvFile();
            loadEnvFile();

            const callsAfter = vi.mocked(dotenvx.config).mock.calls.length;
            expect(callsAfter - callCountBefore).toBeLessThanOrEqual(1);
        });
    });

    describe('getEnv', () => {
        it('should return environment object with default values', () => {
            const env = getEnv();

            expect(env).toHaveProperty('CWD');
            expect(env).toHaveProperty('DEBUG');
            expect(env).toHaveProperty('CYBERSKILL_STORAGE_DIRECTORY');
        });

        it('should default CWD to process.cwd()', () => {
            delete process.env['CWD'];
            const env = getEnv();
            expect(env.CWD).toBe(process.cwd());
        });

        it('should default DEBUG to false', () => {
            delete process.env['DEBUG'];
            const env = getEnv();
            expect(env.DEBUG).toBe(false);
        });

        it('should default CYBERSKILL_STORAGE_DIRECTORY to homedir path', () => {
            delete process.env['CYBERSKILL_STORAGE_DIRECTORY'];
            const env = getEnv();
            expect(env.CYBERSKILL_STORAGE_DIRECTORY).toBe(path.join(os.homedir(), CYBERSKILL_STORAGE_DIRECTORY));
        });

        it('should accept string DEBUG value as true', () => {
            process.env['DEBUG'] = 'true';
            const env = getEnv();
            expect(env.DEBUG).toBe(true);
        });

        it('should use custom CWD when provided', () => {
            process.env['CWD'] = '/custom/path';
            const env = getEnv();
            expect(env.CWD).toBe('/custom/path');
        });

        it('should use custom CYBERSKILL_STORAGE_DIRECTORY when provided', () => {
            process.env['CYBERSKILL_STORAGE_DIRECTORY'] = '/custom/storage';
            const env = getEnv();
            expect(env.CYBERSKILL_STORAGE_DIRECTORY).toBe('/custom/storage');
        });
    });

    describe('CYBERSKILL_STORAGE_DIRECTORY constant', () => {
        it('should be .cyberskill-storage', () => {
            expect(CYBERSKILL_STORAGE_DIRECTORY).toBe('.cyberskill-storage');
        });
    });
});
