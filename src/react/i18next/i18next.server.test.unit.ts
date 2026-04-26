import globalI18nextInstance from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { getTranslationsI18next } from './i18next.server.js';

vi.mock('i18next', () => ({
    default: {
        getFixedT: vi.fn().mockImplementation((_lng, ns) => {
            return (key: string) => `global-mock-${ns ? `${ns}.` : ''}${key}`;
        }),
    },
}));

describe('getTranslationsI18next', () => {
    it('should be defined', () => {
        expect(getTranslationsI18next).toBeDefined();
    });

    it('should use global instance by default', () => {
        const t = getTranslationsI18next();
        expect(t('hello')).toBe('global-mock-hello');
        expect(globalI18nextInstance.getFixedT).toHaveBeenCalledWith(null, null);
    });

    it('should pass namespace to global instance', () => {
        const t = getTranslationsI18next('common');
        expect(t('hello')).toBe('global-mock-common.hello');
        expect(globalI18nextInstance.getFixedT).toHaveBeenCalledWith(null, 'common');
    });

    it('should use provided i18n instance', () => {
        const customI18n = {
            getFixedT: vi.fn().mockImplementation((_lng, ns) => {
                return (key: string) => `custom-mock-${ns ? `${ns}.` : ''}${key}`;
            }),
        } as any; // Cast as any for mock purposes

        const t = getTranslationsI18next('customNamespace', { i18n: customI18n });
        expect(t('hello')).toBe('custom-mock-customNamespace.hello');
        expect(customI18n.getFixedT).toHaveBeenCalledWith(null, 'customNamespace');
    });
});
