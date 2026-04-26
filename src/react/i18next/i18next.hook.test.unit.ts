import { describe, expect, it, vi } from 'vitest';

import { useTranslateI18next } from './i18next.hook.js';

vi.mock('react-i18next', () => ({
    useTranslation: vi.fn(() => ({ t: (key: string) => key, i18n: {} })),
}));

describe('useTranslateI18next', () => {
    it('should be a function (re-export of useTranslation)', () => {
        expect(typeof useTranslateI18next).toBe('function');
    });

    it('should return translation object when called', () => {
        const result = useTranslateI18next() as any;
        expect(result).toHaveProperty('t');
        expect(result.t('key')).toBe('key');
    });
});
