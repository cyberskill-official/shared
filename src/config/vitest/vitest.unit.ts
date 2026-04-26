import type { UserConfig } from 'vite';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { deepMerge } from '#util/object/index.js';

/**
 * Creates a Vitest configuration for unit testing with React support.
 * This function generates a Vitest configuration specifically designed for unit testing
 * React components and JavaScript/TypeScript modules. It includes JSDOM environment
 * for DOM simulation and comprehensive testing setup.
 *
 * The configuration includes:
 * - React SWC plugin for fast React compilation
 * - JSDOM environment for DOM simulation
 * - Global test functions availability
 * - Forked processes pool for parallel test execution across CPU cores
 * - Unit test file pattern matching
 * - Setup files for testing library configuration
 * - Configurable options merging
 *
 * @param options - Additional Vite configuration options to merge with the unit test config.
 * @returns A Vitest configuration object optimized for unit testing with React and DOM support.
 */
export function vitestUnit(options: UserConfig) {
    const config = {
        plugins: [react()],
        test: {
            globals: true,
            environment: 'jsdom',
            pool: 'forks',
            include: ['**/*.test.unit.?(c|m)[jt]s?(x)'],
            setupFiles: [`${import.meta.dirname}/vitest.unit.setup.js`],
            coverage: {
                provider: 'istanbul',
                reporter: ['text', 'lcov'],
                reportsDirectory: './coverage',
                thresholds: {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
            },
        },
    };

    return defineConfig(deepMerge<UserConfig>(config, options));
}

export default vitestUnit({});
