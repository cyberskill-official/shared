import antfu from '@antfu/eslint-config';

import type { T_Object } from '#typescript/index.js';

import { vitestE2E, vitestUnit } from '#config/vitest/index.js';
import { deepMerge } from '#util/index.js';

import type { T_ConfigHandler, T_ConfigType } from './config.type.js';

import { E_ConfigType } from './config.type.js';
import eslintBaseConfig from './eslint/index.js';

/**
 * Handles ESLint configuration merging and processing.
 * This function merges the base ESLint configuration with additional configs
 * and applies the Antfu ESLint preset with specific styling and formatting rules.
 * It processes ignores separately and applies them as a final configuration layer.
 *
 * The function configures:
 * - Stylistic rules (semicolons, indentation, quotes)
 * - Formatters for CSS, HTML, and Markdown
 * - React support
 * - Custom ignore patterns
 *
 * @param config - Additional ESLint configuration objects to merge with the base config.
 * @returns A processed ESLint configuration object ready for use.
 */
const handleESLint: T_ConfigHandler = (...config) => {
    const mergedConfig = deepMerge(
        ...(Array.isArray(eslintBaseConfig) ? eslintBaseConfig : [eslintBaseConfig]),
        ...config,
    );

    const { ignores, ...restConfig } = mergedConfig;

    return antfu(
        {
            stylistic: {
                semi: true,
                indent: 4,
            },
            formatters: true,
            yaml: false,
            markdown: false,
            react: true,
        },
        restConfig,
        ...(Array.isArray(ignores) ? [{ ignores }] : []),
    ) as unknown as T_Object;
};

/**
 * Configuration handlers for different config types.
 * This object maps configuration types to their respective handler functions,
 * providing a centralized way to process different types of configurations
 * with appropriate merging and processing logic.
 */
const configHandlers: Record<E_ConfigType, T_ConfigHandler> = {
    [E_ConfigType.ESLINT]: config => handleESLint(config),
    [E_ConfigType.COMMITLINT]: config => deepMerge(config),
    [E_ConfigType.LINT_STAGED]: config => deepMerge(config),
    [E_ConfigType.VITEST_REACT_UNIT]: config => vitestUnit(config) as T_Object,
    [E_ConfigType.VITEST_REACT_E2E]: config => vitestE2E(config) as T_Object,
};

/**
 * Merges configurations based on the specified type.
 * This function provides a unified interface for merging different types of
 * configurations using their respective handlers. It supports ESLint, commitlint,
 * lint-staged, and Vitest configurations with appropriate processing for each type.
 *
 * The function automatically:
 * - Selects the appropriate handler for the config type
 * - Merges multiple configuration objects
 * - Handles empty configuration arrays gracefully
 * - Provides error handling for unknown config types
 *
 * @param type - The type of configuration to merge (ESLint, commitlint, lint-staged, or Vitest).
 * @param config - Configuration objects to merge, can be empty for default handling.
 * @returns A merged configuration object processed according to the specified type.
 * @throws {Error} When an unknown configuration type is provided.
 */
export function mergeConfigs(type: T_ConfigType, ...config: T_Object[]) {
    const handler = configHandlers[type];

    if (!handler) {
        throw new Error(`Unknown config type: ${type}`);
    }

    if (!config || config.length === 0) {
        return handler({});
    }

    return handler(...config);
}
