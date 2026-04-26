import { use } from 'react';

import { ApolloErrorContext } from './apollo-error.context.js';

/**
 * React hook that provides access to Apollo error context.
 * This hook retrieves the Apollo error context which contains the current error state
 * and methods to show or hide errors. It provides a convenient way to access error
 * handling functionality within components.
 *
 * The hook will throw an error if used outside of an ApolloErrorProvider,
 * ensuring proper context usage and providing clear error messages for debugging.
 *
 * @returns The Apollo error context containing error state and control methods.
 * @throws {Error} When used outside of an ApolloErrorProvider context.
 */
export function useApolloError() {
    const context = use(ApolloErrorContext);

    if (!context) {
        throw new Error('useApolloError must be used within ApolloErrorProvider');
    }

    return context;
}
