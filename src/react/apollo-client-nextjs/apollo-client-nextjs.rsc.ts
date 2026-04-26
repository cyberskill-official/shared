import { registerApolloClient } from '@apollo/client-integration-nextjs';

import type { I_ApolloOptions } from '../apollo-client/index.js';

import { getClient } from './apollo-client-nextjs.util.js';

/**
 * Creates a registered Apollo Client factory for Next.js server components.
 * This function creates a client factory that is registered with Next.js for
 * proper server-side rendering support. The factory function ensures that
 * each request gets its own Apollo Client instance, which is essential for
 * SSR compatibility and preventing client state leakage between requests.
 *
 * @param options - Configuration options for the Apollo Client including URI, WebSocket URL, and custom links.
 * @returns A registered Apollo Client factory function that can be used with Next.js server components.
 */
export const makeClient = (options: I_ApolloOptions = {}) => registerApolloClient(() => getClient(options));
