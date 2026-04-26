import { describe, expect, it, vi } from 'vitest';

import { getTranslationsNextIntl } from './next-intl.server.js';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn().mockImplementation(async (namespace?: string) => {
        return (key: string) => `translated-${namespace ? `${namespace}.` : ''}${key}`;
    }),
}));

describe('getTranslationsNextIntl', () => {
    it('should be defined', () => {
        expect(getTranslationsNextIntl).toBeDefined();
    });

    it('should return a translation function via promise', async () => {
        const t = await getTranslationsNextIntl();
        expect(t('hello')).toBe('translated-hello');
    });

    it('should handle namespace configuration', async () => {
        const t = await getTranslationsNextIntl('common');
        expect(t('hello')).toBe('translated-common.hello');
    });
});
