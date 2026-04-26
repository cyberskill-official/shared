import type { ApolloClient } from '@apollo/client';

import { use } from 'react';

import { ApolloClientContext } from './apollo-client.context.js';

/**
 * React hook that provides access to the Apollo Client instance.
 * This hook retrieves the Apollo Client from the React context and provides
 * a convenient way to access client methods, cache operations, and other
 * Apollo Client functionality within components.
 *
 * The hook will throw an error if used outside of an ApolloClientProvider,
 * ensuring proper context usage and providing clear error messages for debugging.
 *
 * @returns The Apollo Client instance from the nearest ApolloClientProvider context.
 * @throws {Error} When used outside of an ApolloClientProvider context.
 */
export function useApolloClient(): ApolloClient {
    const client = use(ApolloClientContext);

    if (!client) {
        throw new Error('useApolloClient must be used within an ApolloClientProvider');
    }

    return client;
}
