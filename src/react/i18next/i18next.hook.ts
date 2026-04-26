import { useTranslation } from 'react-i18next';

/**
 * React hook that provides i18next translation functionality.
 * This hook is a wrapper around react-i18next's useTranslation hook,
 * providing access to translation functions and current language information.
 * It enables internationalization features including text translation,
 * language switching, and pluralization support.
 *
 * @returns The useTranslation hook result with translation functions and language information.
 */
export const useTranslateI18next: typeof useTranslation = useTranslation;
