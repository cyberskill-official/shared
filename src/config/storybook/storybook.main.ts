import type { StorybookConfig } from '@storybook/react-vite';

import { deepMerge } from '../../util/object/index.js';

/**
 * Creates a Storybook main configuration for React projects using Vite.
 * This function generates a Storybook configuration specifically designed for React applications
 * with Vite as the build tool. It includes essential addons and framework settings.
 *
 * The configuration includes:
 * - React Vite framework integration
 * - Essential Storybook addons (docs, controls, actions, viewport, backgrounds)
 * - Story file pattern matching
 * - Vite configuration support
 * - Configurable options merging
 *
 * @param options - Additional Storybook configuration options to merge with the base config.
 * @returns A Storybook configuration object optimized for React with Vite.
 */
export function storybookMain(options?: Partial<StorybookConfig>): StorybookConfig {
    const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)'],
        addons: [
            '@storybook/addon-essentials',
            '@storybook/addon-interactions',
            '@storybook/addon-links',
        ],
        framework: {
            name: '@storybook/react-vite',
            options: {},
        },
    };

    return deepMerge(config, options) as StorybookConfig;
}
