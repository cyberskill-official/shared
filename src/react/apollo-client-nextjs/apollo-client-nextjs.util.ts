import { ApolloClient, InMemoryCache } from '@apollo/client-integration-nextjs';
import { ApolloLink } from '@apollo/client/link';

import type { I_ApolloOptions } from '../apollo-client/index.js';

import { createApolloLinks } from '../apollo-client/apollo-client.util.js';

/**
 * Creates a Next.js optimized Apollo Client instance.
 * This function creates an Apollo Client specifically configured for Next.js applications,
 * using the Next.js integration package for proper server-side rendering support.
 * The client includes all standard Apollo features like error handling, logging,
 * file uploads, and WebSocket subscriptions, but is optimized for Next.js environments.
 *
 * @param options - Configuration options for the Apollo Client including URI, WebSocket URL, and custom links.
 * @returns A Next.js optimized Apollo Client instance ready for use in Next.js applications.
 */
export function getClient(options: I_ApolloOptions = {}) {
    const link = ApolloLink.from(createApolloLinks(options));

    return new ApolloClient({
        link,
        cache: new InMemoryCache(),
        ...options,
    });
}
