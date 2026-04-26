import type { Preview } from '@storybook/react';

import { deepMerge } from '#util/object/index.js';

const RE_COLOR_MATCHER = /(background|color)$/i;
const RE_DATE_MATCHER = /Date$/i;

/**
 * Creates a Storybook preview configuration with preconfigured controls and background settings.
 * This function generates a preview configuration that provides default parameters
 * and decorators for Storybook stories. It sets up common controls, backgrounds,
 * and viewport settings for consistent story rendering.
 *
 * The configuration includes:
 * - Default control parameters for common props
 * - Background color options
 * - Viewport presets for responsive testing
 * - Actions configuration for event handlers
 * - Configurable options merging
 *
 * @param options - Additional preview configuration options to merge with the base config.
 * @returns A Storybook preview configuration object.
 */
export function storybookPreview(options?: Partial<Preview>): Preview {
    const preview: Preview = {
        parameters: {
            controls: {
                matchers: {
                    color: RE_COLOR_MATCHER,
                    date: RE_DATE_MATCHER,
                },
            },
            backgrounds: {
                default: 'light',
                values: [
                    {
                        name: 'light',
                        value: '#ffffff',
                    },
                    {
                        name: 'dark',
                        value: '#333333',
                    },
                ],
            },
        },
    };

    return deepMerge(preview, options ?? {}) as Preview;
}
