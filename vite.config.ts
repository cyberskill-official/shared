import { glob } from 'glob';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Sync read is intentional — Vite config runs once at build/dev time, not in hot-path
const pkg = JSON.parse(fs.readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8'));

const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
];

const externalDeps = new Set(allDeps);
const builtinModulesSet = new Set(builtinModules);
const nodeBuiltinModulesSet = new Set(builtinModules.map(m => `node:${m}`));
// Pre-computed Set of "dep/" prefixes for O(1) sub-module resolution
const externalDepPrefixes = new Set(allDeps.map(dep => `${dep}/`));

/**
 * Determines if a module should be treated as external during bundling.
 * This function checks if a module ID should be excluded from the bundle
 * based on whether it's a built-in Node.js module, a dependency, or a
 * sub-module of a dependency.
 *
 * The function checks:
 * - Built-in Node.js modules (both with and without 'node:' prefix)
 * - Direct dependencies from package.json
 * - Sub-modules of dependencies (e.g., 'lodash/get')
 *
 * @param id - The module ID to check for external status.
 * @returns True if the module should be treated as external, false otherwise.
 */
function isExternal(id: string) {
    if (builtinModulesSet.has(id) || nodeBuiltinModulesSet.has(id)) {
        return true;
    }
    if (externalDeps.has(id)) {
        return true;
    }
    // O(1) sub-module check: extract "package/" or "@scope/package/" prefix and test Set membership
    const slashIndex = id.indexOf('/');

    if (slashIndex === -1) {
        return false;
    }

    const prefix = id.startsWith('@')
        ? id.slice(0, id.indexOf('/', slashIndex + 1) + 1 || id.length)
        : id.slice(0, slashIndex + 1);

    return externalDepPrefixes.has(prefix);
}

/**
 * Generates entry points for the library build by scanning source files.
 * This configuration scans for index files and React Server Components (RSC) files
 * in the src directory, excluding type definition files. It creates entry points
 * that map to the file structure for proper library exports.
 *
 * The entry points include:
 * - All index.{ts,tsx} files in subdirectories
 * - All .rsc.ts files (React Server Components)
 * - Excludes type definition files (*.type.ts, *.d.ts)
 *
 * Entry names are derived from the file path relative to src/.
 */
const RE_SRC_PREFIX = /^.*\/src\//;
const RE_TS_EXT = /\.(ts|tsx)$/;

const entryPoints = glob.sync(['src/**/index.{ts,tsx}', 'src/**/*.rsc.ts', 'src/**/*.server.ts', 'src/config/vitest/vitest.*.ts'], {
    ignore: ['src/**/*.type.ts', 'src/**/*.d.ts', 'src/**/*.test.*.ts', 'src/**/*.test.*.tsx'],
    absolute: true,
}).reduce<Record<string, string>>((entries, file) => {
    const normalizedFile = file.replace(/\\/g, '/');
    const entryName = normalizedFile.replace(RE_SRC_PREFIX, '').replace(RE_TS_EXT, '');

    if (process.env.FILTER && !normalizedFile.includes(process.env.FILTER)) {
        return entries;
    }

    entries[entryName] = normalizedFile;

    return entries;
}, {});

export default defineConfig({
    optimizeDeps: {
        include: ['mongoose', 'mongodb'],
    },
    resolve: {
        alias: {
            '#public': resolve(import.meta.dirname, 'public'),
            '#config': resolve(import.meta.dirname, 'src/config'),
            '#constant': resolve(import.meta.dirname, 'src/constant'),
            '#node': resolve(import.meta.dirname, 'src/node'),
            '#react': resolve(import.meta.dirname, 'src/react'),
            '#style': resolve(import.meta.dirname, 'src/style'),
            '#typescript': resolve(import.meta.dirname, 'src/typescript'),
            '#util': resolve(import.meta.dirname, 'src/util'),
        },
    },
    build: {
        lib: {
            name: '@cyberskill/shared',
            cssFileName: 'style',
            entry: entryPoints,
            formats: ['es'],
        },
        rollupOptions: {
            external: isExternal,
            output: {
                preserveModules: true,
                preserveModulesRoot: 'src',
                exports: 'named',
            },
            treeshake: {
                moduleSideEffects: id => id.includes('jest-dom') || id.includes('setup'),
                propertyReadSideEffects: false,
                unknownGlobalSideEffects: false,
            },
        },
        sourcemap: true,
        copyPublicDir: false,
        cssCodeSplit: false,
        target: 'es2022',
    },
    plugins: [
        dts({
            logLevel: 'error',
            entryRoot: 'src',
            exclude: ['src/**/*.test.*.ts', 'src/**/*.test.*.tsx'],
            compilerOptions: {
                rootDir: resolve(import.meta.dirname, 'src'),
                declaration: true,
                declarationMap: false,
                emitDeclarationOnly: true,
            },
        }),
    ],
    esbuild: {
        target: 'es2022',
        treeShaking: true,
        legalComments: 'none',
    },
});
