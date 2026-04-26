import type { ApolloClient } from '@apollo/client';

import * as React from 'react';
import { createContext } from 'react';

/**
 * React context for providing Apollo Client instance to child components.
 * This context allows components to access the Apollo Client instance without
 * prop drilling, enabling direct access to client methods and cache operations.
 */
const ApolloClientContext = createContext<ApolloClient | null>(null);

/**
 * Provider component that makes Apollo Client available to the component tree.
 * This component wraps the Apollo Client instance in a React context, allowing
 * any child component to access the client using the useApolloClient hook.
 *
 * @param props - Component props containing client and children.
 * @param props.client - The Apollo Client instance to provide to the component tree.
 * @param props.children - React children that will have access to the Apollo Client context.
 * @returns A React component that provides Apollo Client context to its children.
 */
export function ApolloClientProvider({
    client,
    children,
}: {
    client: ApolloClient;
    children: React.ReactNode;
}) {
    return (
        <ApolloClientContext value={client}>
            {children}
        </ApolloClientContext>
    );
}

export { ApolloClientContext };
