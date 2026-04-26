import i18next from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { initI18next } from './i18next.util.js';

// Mock i18next and react-i18next
vi.mock('i18next', () => {
    const mockI18next = {
        use: vi.fn().mockReturnThis(),
        init: vi.fn().mockResolvedValue(undefined),
    };
    return { default: mockI18next };
});

vi.mock('react-i18next', () => ({
    initReactI18next: {},
}));

describe('initI18next', () => {
    it('should call i18next.use with initReactI18next and then init', async () => {
        const options = { lng: 'en', resources: {} };
        await initI18next(options);
        expect(i18next.use).toHaveBeenCalled();
        expect(i18next.init).toHaveBeenCalledWith(options);
    });

    it('should return a promise', () => {
        const result = initI18next({ lng: 'vi' });
        expect(result).toBeInstanceOf(Promise);
    });
});
