import type { i18n as I18nInstance } from 'i18next';

import globalI18nextInstance from 'i18next';

export interface I_GetTranslationsI18nextOptions {
    /**
     * Optional i18n instance. If not provided, it falls back to the global i18next instance.
     */
    i18n?: I18nInstance;
}

/**
 * Retrieves the i18next translation function outside of React components.
 * This provides access to translation functions for use in server components,
 * non-React environments, or normal JS functions.
 *
 * @param namespace - Optional namespace to load translations from.
 * @param options - Options object allowing injection of a specific i18n instance.
 * @returns The translation function (`t`) bound to the specified namespace and instance.
 */
export function getTranslationsI18next(
    namespace?: string | null,
    options?: I_GetTranslationsI18nextOptions,
) {
    const instance = options?.i18n || globalI18nextInstance;

    // We bind using getFixedT to ensure the namespace is locked to this t function
    return instance.getFixedT(null, namespace ?? null);
}
