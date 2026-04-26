import { describe, expect, it } from 'vitest';

import { NEXT_INTL_DEFAULT_LANGUAGE } from './next-intl.constant.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('NEXT_INTL_DEFAULT_LANGUAGE', () => {
    it('should have English as default language', () => {
        expect(NEXT_INTL_DEFAULT_LANGUAGE.label).toBe('English');
        expect(NEXT_INTL_DEFAULT_LANGUAGE.value).toBe('en');
    });

    it('should have a flag emoji', () => {
        expect(NEXT_INTL_DEFAULT_LANGUAGE.flag).toBe('🇺🇸');
    });

    it('should have number format configuration', () => {
        expect(NEXT_INTL_DEFAULT_LANGUAGE.numberFormat).toEqual({
            code: 'en-US',
            currency: 'USD',
        });
    });

    it('should have timezone', () => {
        expect(NEXT_INTL_DEFAULT_LANGUAGE.timezone).toBe('America/New_York');
    });

    it('should have adapterLocale from date-fns', () => {
        expect(NEXT_INTL_DEFAULT_LANGUAGE.adapterLocale).toBeDefined();
    });
});
