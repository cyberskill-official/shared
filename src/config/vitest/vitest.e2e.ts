import type { UserConfig } from 'vite';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { deepMerge } from '../../util/object/index.js';

/**
 * Creates a Vitest configuration for end-to-end testing with browser automation.
 * This function generates a Vitest configuration specifically designed for E2E testing
 * using Playwright with multiple browser instances. It includes React support and
 * browser automation capabilities for comprehensive end-to-end testing.
 *
 * The configuration includes:
 * - React SWC plugin for fast React compilation
 * - Browser automation with Playwright provider
 * - Multiple browser instances (Chromium, Firefox, WebKit)
 * - E2E test file pattern matching
 * - Configurable options merging
 *
 * @param options - Additional Vite configuration options to merge with the E2E config.
 * @returns A Vitest configuration object optimized for end-to-end testing with browser automation.
 */
export function vitestE2E(options: UserConfig) {
    const config = {
        plugins: [react()],
        test: {
            include: ['**/*.test.e2e.?(c|m)[jt]s?(x)'],
        },
    };

    return defineConfig(deepMerge<UserConfig>(config, options));
}

export default vitestE2E({});
