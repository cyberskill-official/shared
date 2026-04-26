import fsExtra from 'fs-extra';

import { getEnv } from '#config/env/index.js';

import type { I_PackageInput, I_PackageJson } from '../package/index.js';

import { E_CommandType, formatCommand, rawCommand } from '../command/index.js';
import { E_PackageType, setupPackages } from '../package/index.js';
import { join, resolveWorkingPath } from './path.util.js';

export const WORKING_DIRECTORY = getEnv().CWD;
export const CYBERSKILL_PACKAGE_NAME = '@cyberskill/shared';
export const NODE_MODULES = 'node_modules';
export const BUILD_DIRECTORY = 'dist';
export const PUBLIC_DIRECTORY = 'public';
export const PACKAGE_JSON = 'package.json';
export const PACKAGE_LOCK_JSON = 'package-lock.json';
export const TSCONFIG_JSON = 'tsconfig.json';
export const GIT_IGNORE = '.gitignore';
export const SIMPLE_GIT_HOOK_JSON = '.simple-git-hooks.json';
export const PNPM_LOCK_YAML = 'pnpm-lock.yaml';
export const GIT_HOOK = '.git/hooks/';
export const GIT_COMMIT_EDITMSG = '.git/COMMIT_EDITMSG';
export const GIT_EXCLUDE = '.git/info/exclude';
export const MIGRATE_MONGO_CONFIG = '.migrate-mongo.config.js';
let _cyberskillDir: string | null = null;

/**
 * Resets the cached directory path. For testing only.
 */
export function resetCyberskillDirCacheForTesting(): void {
    _cyberskillDir = null;
}

/**
 * Lazily computes the CyberSkill directory path.
 * Reads package.json on first access to determine whether this is the shared package itself
 * or a consumer project, avoiding filesystem reads at module load time.
 */
export function getCyberskillDirectory(): string {
    if (_cyberskillDir !== null) {
        return _cyberskillDir;
    }

    try {
        const packageJson = fsExtra.readJsonSync(resolveWorkingPath(PACKAGE_JSON)) as I_PackageJson;

        _cyberskillDir = packageJson.name === CYBERSKILL_PACKAGE_NAME
            ? join(WORKING_DIRECTORY, BUILD_DIRECTORY)
            : join(WORKING_DIRECTORY, NODE_MODULES, CYBERSKILL_PACKAGE_NAME, BUILD_DIRECTORY);
    }
    catch {
        /* Intentionally empty — fallback to node_modules path when package.json is unreadable */
        _cyberskillDir = join(WORKING_DIRECTORY, NODE_MODULES, CYBERSKILL_PACKAGE_NAME, BUILD_DIRECTORY);
    }

    return _cyberskillDir;
}

/** @deprecated Use `getCyberskillDirectory()` instead. Kept for backward compatibility. */
export const CYBERSKILL_DIRECTORY = getCyberskillDirectory();
export const CYBERSKILL_CLI = 'cyberskill';
export const CYBERSKILL_CLI_PATH = 'src/node/cli/index.ts';
export const ESLINT_PACKAGE_NAME = 'eslint';
export const ESLINT_CLI = 'eslint';
export const VITEST_PACKAGE_NAME = 'vitest';
export const VITEST_CLI = 'vitest';
export const COMMIT_LINT_PACKAGE_NAME = '@commitlint/cli';
export const COMMIT_LINT_CONVENTIONAL_CONFIG_PACKAGE_NAME = '@commitlint/config-conventional';
export const COMMIT_LINT_CLI = 'commitlint';
export const LINT_STAGED_PACKAGE_NAME = 'lint-staged';
export const LINT_STAGED_CLI = 'lint-staged';
export const TSC_PACKAGE_NAME = 'typescript';
export const TSC_CLI = 'tsc';
export const TSX_CLI = 'tsx';
export const GIT_CLI = 'git';
export const PNPM_CLI = 'pnpm';
export const PNPM_EXEC_CLI = 'pnpm exec';
export const SIMPLE_GIT_HOOKS_PACKAGE_NAME = 'simple-git-hooks';
export const SIMPLE_GIT_HOOK_CLI = 'simple-git-hooks';
export const ESLINT_INSPECT_PACKAGE_NAME = '@eslint/config-inspector';
export const ESLINT_INSPECT_CLI = 'eslint-config-inspector';
export const NODE_MODULES_INSPECT_PACKAGE_NAME = 'node-modules-inspector';
export const NODE_MODULES_INSPECT_CLI = 'node-modules-inspector';
export const MIGRATE_MONGO_PACKAGE_NAME = 'migrate-mongo';
export const MIGRATE_MONGO_CLI = './node_modules/migrate-mongo/bin/migrate-mongo';
export const STORYBOOK_PACKAGE_NAME = 'storybook';
export const STORYBOOK_CLI = 'storybook';
export const AG_KIT_PACKAGE_NAME = '@vudovn/ag-kit';
export const DOT_AGENT = '.agent';

export const PATH = {
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get CYBERSKILL_DIRECTORY() { return getCyberskillDirectory(); },
    WORKING_DIRECTORY,
    PUBLIC_DIRECTORY: resolveWorkingPath(PUBLIC_DIRECTORY),
    TS_CONFIG: resolveWorkingPath(TSCONFIG_JSON),
    GIT_IGNORE: resolveWorkingPath(GIT_IGNORE),
    GIT_HOOK: resolveWorkingPath(GIT_HOOK),
    GIT_COMMIT_MSG: resolveWorkingPath(GIT_COMMIT_EDITMSG),
    GIT_EXCLUDE: resolveWorkingPath(GIT_EXCLUDE),
    SIMPLE_GIT_HOOKS_JSON: resolveWorkingPath(SIMPLE_GIT_HOOK_JSON),
    PACKAGE_JSON: resolveWorkingPath(PACKAGE_JSON),
    PACKAGE_LOCK_JSON: resolveWorkingPath(PACKAGE_LOCK_JSON),
    PNPM_LOCK_YAML: resolveWorkingPath(PNPM_LOCK_YAML),
    NODE_MODULES: resolveWorkingPath(NODE_MODULES),
    MIGRATE_MONGO_CONFIG: resolveWorkingPath(MIGRATE_MONGO_CONFIG),
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get LINT_STAGED_CONFIG() { return resolveWorkingPath(`${getCyberskillDirectory()}/config/lint-staged/index.js`); },
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get COMMITLINT_CONFIG() { return resolveWorkingPath(`${getCyberskillDirectory()}/config/commitlint/index.js`); },
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get VITEST_UNIT_CONFIG() { return resolveWorkingPath(`${getCyberskillDirectory()}/config/vitest/vitest.unit.js`); },
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get VITEST_E2E_CONFIG() { return resolveWorkingPath(`${getCyberskillDirectory()}/config/vitest/vitest.e2e.js`); },
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get STORYBOOK_MAIN_CONFIG() { return resolveWorkingPath(`${getCyberskillDirectory()}/config/storybook/storybook.main.js`); },
    /** Lazily resolved — defers `getCyberskillDirectory()` until first property access. */
    get STORYBOOK_PREVIEW_CONFIG() { return resolveWorkingPath(`${getCyberskillDirectory()}/config/storybook/storybook.preview.js`); },
    DOT_AGENT: resolveWorkingPath(DOT_AGENT),
};

/**
 * Creates Git hooks configuration based on whether this is the current project.
 * This function generates a configuration object for Git hooks that includes
 * pre-commit and commit-msg hooks, with an optional pre-push hook for the current project.
 *
 * @returns A Git hooks configuration object with appropriate commands for each hook.
 */
export function createGitHooksConfig() {
    return {
        'pre-commit': LINT_STAGED_CLI,
        'commit-msg': COMMIT_LINT_CLI,
        'pre-push': rawCommand(`${GIT_CLI} pull && ${PNPM_CLI} run --if-present test`),
    };
}

/**
 * Builds a command function based on the specified type and configuration.
 * This function creates a command executor that handles different command types
 * including CLI commands and string commands. It manages package dependencies
 * and formats commands appropriately for execution.
 *
 * The function supports:
 * - CLI commands that require package installation
 * - String commands that are executed directly
 * - Automatic package dependency management
 * - Command formatting and validation
 *
 * @param config - Configuration object containing type, packages, and command properties.
 * @param config.type - The type of command to build (CLI or STRING).
 * @param config.packages - Optional array of packages required for CLI commands.
 * @param config.command - The command string to execute.
 * @returns A function that returns a promise resolving to the formatted command string.
 * @throws {Error} When an unsupported command type is provided.
 */
function buildCommand({ type, packages, command }: { type: E_CommandType; packages?: I_PackageInput[]; command: string }): () => Promise<string> {
    const uniquePackages = packages?.reduce((acc: I_PackageInput[], pkg) => {
        if (!acc.some(existingPkg => existingPkg.name === pkg.name)) {
            acc.push(pkg);
        }
        return acc;
    }, []);

    return async () => {
        switch (type) {
            case E_CommandType.CLI: {
                if (uniquePackages?.length) {
                    await setupPackages(uniquePackages, {
                        install: true,
                    });
                }

                return formatCommand(rawCommand(`${PNPM_EXEC_CLI} ${command}`)) as string;
            }
            case E_CommandType.STRING: {
                return formatCommand(rawCommand(command)) as string;
            }
            default: {
                throw new Error('Unsupported command type');
            }
        }
    };
}

const RE_MIGRATE_NAME = /^[\w-]+$/;

export const command = {
    simpleGitHooks: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: SIMPLE_GIT_HOOKS_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },

        ],
        command: SIMPLE_GIT_HOOK_CLI,
    }),
    eslintInspect: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name:
                    ESLINT_INSPECT_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },

        ],
        command: ESLINT_INSPECT_CLI,
    }),
    nodeModulesInspect: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: NODE_MODULES_INSPECT_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },

        ],
        command: NODE_MODULES_INSPECT_CLI,
    }),
    eslintCheck: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: ESLINT_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },

        ],
        command: `${ESLINT_CLI} ${PATH.WORKING_DIRECTORY} --cache --cache-location node_modules/.cache/eslint/`,
    }),
    eslintFix: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: ESLINT_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },

        ],
        command: `${ESLINT_CLI} ${PATH.WORKING_DIRECTORY} --fix --cache --cache-location node_modules/.cache/eslint/`,
    }),
    typescriptCheck: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: TSC_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },

        ],
        command: `${TSC_CLI} -p ${PATH.TS_CONFIG} --noEmit --incremental`,
    }),
    testUnit: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: VITEST_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        command: `${VITEST_CLI} --config ${PATH.VITEST_UNIT_CONFIG}`,
    }),
    testE2e: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: VITEST_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        command: `${VITEST_CLI} --config ${PATH.VITEST_E2E_CONFIG}`,
    }),
    mongoMigrateCreate: (migrateName: string) => {
        if (!RE_MIGRATE_NAME.test(migrateName)) {
            throw new Error('Migration name must only contain alphanumeric characters, underscores, and hyphens.');
        }

        return buildCommand({
            type: E_CommandType.CLI,
            packages: [
                {
                    name: TSX_CLI,
                    type: E_PackageType.DEPENDENCY,
                },
                {
                    name: MIGRATE_MONGO_PACKAGE_NAME,
                    type: E_PackageType.DEPENDENCY,
                },
            ],
            command: `${TSX_CLI} ${MIGRATE_MONGO_CLI} create ${migrateName} -f ${PATH.MIGRATE_MONGO_CONFIG}`,
        })();
    },
    mongoMigrateUp: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: TSX_CLI,
                type: E_PackageType.DEPENDENCY,
            },
            {
                name: MIGRATE_MONGO_PACKAGE_NAME,
                type: E_PackageType.DEPENDENCY,
            },
        ],
        command: `${TSX_CLI} ${MIGRATE_MONGO_CLI} up -f ${PATH.MIGRATE_MONGO_CONFIG}`,
    }),
    mongoMigrateDown: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: TSX_CLI,
                type: E_PackageType.DEPENDENCY,
            },
            {
                name: MIGRATE_MONGO_PACKAGE_NAME,
                type: E_PackageType.DEPENDENCY,
            },
        ],
        command: `${TSX_CLI} ${MIGRATE_MONGO_CLI} down -f ${PATH.MIGRATE_MONGO_CONFIG}`,
    }),
    commitLint: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: COMMIT_LINT_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
            {
                name: COMMIT_LINT_CONVENTIONAL_CONFIG_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        command: `${COMMIT_LINT_CLI} --edit ${PATH.GIT_COMMIT_MSG} --config ${PATH.COMMITLINT_CONFIG}`,
    }),
    lintStaged: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: LINT_STAGED_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        command: `${LINT_STAGED_CLI} --config ${PATH.LINT_STAGED_CONFIG}`,
    }),
    configureGitHook: buildCommand({
        type: E_CommandType.STRING,
        command: `${GIT_CLI} config core.hooksPath ${PATH.GIT_HOOK}`,
    }),
    build: buildCommand({
        type: E_CommandType.STRING,
        command: `vite build`,
    }),
    pnpmInstallStandard: buildCommand({
        type: E_CommandType.STRING,
        command: `${PNPM_CLI} install --ignore-scripts`,
    }),
    pnpmInstallLegacy: buildCommand({
        type: E_CommandType.STRING,
        command: `${PNPM_CLI} install --ignore-scripts --legacy-peer-deps`,
    }),
    pnpmInstallForce: buildCommand({
        type: E_CommandType.STRING,
        command: `${PNPM_CLI} install --ignore-scripts --force`,
    }),
    pnpmPruneStore: buildCommand({
        type: E_CommandType.STRING,
        command: `${PNPM_CLI} store prune`,
    }),
    pnpmCleanCache: buildCommand({
        type: E_CommandType.STRING,
        command: `${PNPM_CLI} cache delete`,
    }),
    storybookDev: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: STORYBOOK_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        command: `${STORYBOOK_CLI} dev`,
    }),
    storybookBuild: buildCommand({
        type: E_CommandType.CLI,
        packages: [
            {
                name: STORYBOOK_PACKAGE_NAME,
                type: E_PackageType.DEV_DEPENDENCY,
            },
        ],
        command: `${STORYBOOK_CLI} build`,
    }),
};
