import dotenvx from '@dotenvx/dotenvx';
import { cleanEnv, makeValidator, str } from 'envalid';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { E_Environment } from '#typescript/index.js';

import type { I_Environment } from './env.type.js';

import { CYBERSKILL_STORAGE_DIRECTORY } from './env.constant.js';

/**
 * Flag to track whether environment file has been loaded.
 * This variable prevents multiple loading of environment files during
 * the application lifecycle, ensuring environment variables are only
 * loaded once per session.
 */
let isEnvFileLoaded = false;

/**
 * Cached environment object to avoid redundant validation on every getEnv() call.
 * Reset via resetEnvForTesting() in test environments.
 */
let _cachedEnv: I_Environment | null = null;

/**
 * Custom validator for debug environment variable.
 * This validator accepts boolean values directly and converts string values
 * to true, providing flexible debug configuration options. It handles
 * both explicit boolean settings and string-based flags.
 *
 * @param input - The input value to validate (boolean or string).
 * @returns True if the input is a valid debug setting, false otherwise.
 */
const debugValidator = makeValidator((input) => {
    if (typeof input === 'boolean') {
        return input;
    }
    if (typeof input === 'string') {
        return true;
    }

    return false;
});

/**
 * Loads environment variables from .env files.
 * This function loads environment variables from .env files using dotenvx,
 * but only in non-production environments. It includes a safety mechanism
 * to prevent multiple loading of the same environment file.
 *
 * The function:
 * - Checks if the current environment is not production
 * - Loads environment variables from .env files
 * - Prevents duplicate loading with a flag mechanism
 * - Uses dotenvx for enhanced environment file support
 */
export function loadEnvFile() {
    if (process.env['NODE_ENV'] !== E_Environment.PRODUCTION && !isEnvFileLoaded) {
        dotenvx.config();
        isEnvFileLoaded = true;
    }
}

/**
 * Retrieves and validates the application environment configuration.
 * This function loads environment variables, validates them using envalid,
 * and returns a typed environment object with default values for missing
 * variables. It ensures all required environment variables are present
 * and properly typed.
 *
 * The function validates:
 * - CWD: Current working directory (defaults to process.cwd())
 * - DEBUG: Debug mode flag (defaults to false)
 * - CYBERSKILL_STORAGE_DIRECTORY: Storage directory path (defaults to user home directory)
 *
 * @returns A validated environment object with all required configuration values.
 */
export function getEnv(): I_Environment {
    if (_cachedEnv) {
        return _cachedEnv;
    }

    loadEnvFile();

    const cleanedEnv = cleanEnv(process.env, {
        CWD: str({ default: process.cwd() }),
        DEBUG: debugValidator({ default: false }),
        CYBERSKILL_STORAGE_DIRECTORY: str({ default: path.join(os.homedir(), CYBERSKILL_STORAGE_DIRECTORY) }),
    });

    const env = {
        CWD: cleanedEnv.CWD,
        DEBUG: cleanedEnv.DEBUG,
        CYBERSKILL_STORAGE_DIRECTORY: cleanedEnv.CYBERSKILL_STORAGE_DIRECTORY,
    };

    _cachedEnv = env;

    return env;
}

/**
 * Resets the cached environment object. For testing only.
 * Call this to force `getEnv()` to re-read and re-validate `process.env`.
 */
export function resetEnvForTesting(): void {
    _cachedEnv = null;
    isEnvFileLoaded = false;
}
