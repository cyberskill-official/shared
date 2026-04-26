import { use } from 'react';

import { LoadingContext } from './loading.context.js';

/**
 * React hook that provides access to loading context.
 * This hook retrieves the loading context which contains loading state and
 * control methods. It provides a convenient way to access loading functionality
 * within components, allowing them to show and hide loading states.
 *
 * The hook will throw an error if used outside of a LoadingProvider,
 * ensuring proper context usage and providing clear error messages for debugging.
 *
 * @returns The loading context containing loading state and control methods.
 * @throws {Error} When used outside of a LoadingProvider context.
 */
export function useLoading() {
    const context = use(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}
