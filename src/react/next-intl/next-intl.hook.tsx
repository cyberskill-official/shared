import { useTranslations } from 'next-intl';
import { use } from 'react';

import type { I_NextIntlContext } from './next-intl.type.js';

import { NextIntlContext } from './next-intl.context.js';

/**
 * React hook that provides access to Next.js internationalization context.
 * This hook retrieves the Next.js internationalization context which contains
 * language information and language switching functionality. It provides a
 * convenient way to access internationalization features within components.
 *
 * The hook will throw an error if used outside of a NextIntlProvider,
 * ensuring proper context usage and providing clear error messages for debugging.
 *
 * @returns The Next.js internationalization context containing language state and control methods.
 * @throws {Error} When used outside of a NextIntlProvider context.
 */
export function useNextIntl(): I_NextIntlContext {
    const context = use(NextIntlContext);

    if (!context) {
        throw new Error('useNextIntl must be used within a NextIntlProvider');
    }

    return context;
}

/**
 * React hook that provides Next.js translation functionality.
 * This hook is a wrapper around next-intl's useTranslations hook,
 * providing access to translation functions and current locale information.
 * It enables internationalization features including text translation,
 * locale switching, and pluralization support for Next.js applications.
 *
 * @returns The useTranslations hook result with translation functions and locale information.
 */
export const useTranslateNextIntl: typeof useTranslations = useTranslations;
