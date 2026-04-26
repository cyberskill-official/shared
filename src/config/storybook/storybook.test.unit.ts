import { describe, expect, it } from 'vitest';

import { storybookMain } from './storybook.main.js';
import { storybookPreview } from './storybook.preview.js';

// ---------------------------------------------------------------------------
// storybookMain
// ---------------------------------------------------------------------------
describe('storybookMain', () => {
    it('should return default config with framework and addons', () => {
        const config = storybookMain();
        expect(config.framework).toBeDefined();
        expect(config.addons).toBeDefined();
        expect(config.stories).toBeDefined();
    });

    it('should include react-vite framework', () => {
        const config = storybookMain();
        expect(config.framework).toEqual({
            name: '@storybook/react-vite',
            options: {},
        });
    });

    it('should merge custom options', () => {
        const config = storybookMain({
            stories: ['../custom/**/*.stories.tsx'],
        });
        expect(config.stories).toContain('../custom/**/*.stories.tsx');
    });

    it('should include essential addons', () => {
        const config = storybookMain();
        expect(config.addons).toContain('@storybook/addon-essentials');
    });
});

// ---------------------------------------------------------------------------
// storybookPreview
// ---------------------------------------------------------------------------
describe('storybookPreview', () => {
    it('should return default preview config', () => {
        const preview = storybookPreview();
        expect(preview.parameters).toBeDefined();
    });

    it('should include controls matchers', () => {
        const preview = storybookPreview();
        expect(preview.parameters?.['controls']?.matchers).toBeDefined();
    });

    it('should include background options', () => {
        const preview = storybookPreview();
        expect(preview.parameters?.['backgrounds']?.values).toBeDefined();
        expect(preview.parameters?.['backgrounds']?.default).toBe('light');
    });

    it('should merge custom parameters', () => {
        const preview = storybookPreview({
            parameters: { docs: { enabled: true } },
        });
        expect((preview.parameters as any)?.docs?.enabled).toBe(true);
        // Should still have the defaults
        expect(preview.parameters?.['controls']).toBeDefined();
    });
});
