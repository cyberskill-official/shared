import { getTranslations } from 'next-intl/server';

/**
 * Retrieves the translation function from Next.js internationalization context on the server.
 * This function wraps next-intl/server's getTranslations, returning a Promise that resolves
 * to the translation function. It enables asynchronous translation resolution for server components
 * and server actions.
 *
 * @returns A Promise that resolves to the getTranslations function.
 */
export const getTranslationsNextIntl: typeof getTranslations = getTranslations;
