import { enUS as enUSAdapter } from 'date-fns/locale';

/**
 * Default language configuration for Next.js internationalization.
 * This constant provides the default English (US) language settings including:
 * - Language label and value for display and identification
 * - Flag emoji and icon for UI representation
 * - Date-fns locale adapter for date formatting
 * - Number formatting configuration (locale and currency)
 * - Timezone setting for date/time operations
 */
export const NEXT_INTL_DEFAULT_LANGUAGE = {
    label: 'English',
    value: 'en',
    flag: '🇺🇸',
    adapterLocale: enUSAdapter,
    icon: 'flagpack:gb-nir',
    numberFormat: {
        code: 'en-US',
        currency: 'USD',
    },
    timezone: 'America/New_York',
};
