import type { InitOptions } from 'i18next';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Initializes i18next with React integration.
 * This function sets up i18next for use with React applications by configuring
 * the react-i18next plugin and initializing the i18next instance with the provided
 * options. It enables internationalization features including translation,
 * language detection, and pluralization rules.
 *
 * @param options - Configuration options for i18next initialization including languages, namespaces, and plugins.
 * @returns A promise that resolves when i18next initialization is complete.
 */
export function initI18next(options: InitOptions) {
    return i18next.use(initReactI18next).init(options);
}
