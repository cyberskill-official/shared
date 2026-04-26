/**
 * Indicates if the current environment is a browser (as opposed to Node.js or SSR).
 * Checks both `window` and `document` to avoid false positives in SSR environments
 * like Next.js where `window` may exist but `document` does not.
 */
export const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
