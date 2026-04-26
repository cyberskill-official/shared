import { ApolloNextAppProvider } from '@apollo/client-integration-nextjs';
import * as React from 'react';
import { useMemo } from 'react';

import type { I_ApolloProviderProps } from '../apollo-client/index.js';

import { ApolloErrorComponent, ApolloErrorProvider } from '../apollo-error/index.js';
import { Toaster } from '../toast/index.js';
import { getClient } from './apollo-client-nextjs.util.js';

/**
 * Next.js Apollo Provider component that wraps the application with Apollo Client context.
 * This component provides the Apollo Client instance to all child components,
 * enabling GraphQL operations throughout the component tree. It includes
 * error handling and toast integration for a complete GraphQL experience.
 *
 * Features:
 * - Apollo Client context provision
 * - Error boundary integration
 * - Toast notification support
 * - Automatic error handling
 * - Next.js specific optimizations
 *
 * @param props - Component props containing options, children, and optional error override.
 * @param props.options - Apollo Client configuration options.
 * @param props.children - React children that will have access to Apollo Client context.
 * @param props.onError - Optional callback to override the default modal/toast error handling.
 * @returns A React component that provides Apollo Client context to its children.
 */
export function ApolloProvider({ options, children, onError }: I_ApolloProviderProps) {
    const makeClient = useMemo(
        () => () => getClient(options || {}),
        [options],
    );

    return (
        <>
            <ApolloErrorProvider onError={onError}>
                <ApolloNextAppProvider makeClient={makeClient}>
                    {children}
                </ApolloNextAppProvider>
                {!onError && <ApolloErrorComponent />}
            </ApolloErrorProvider>
            <Toaster position="top-right" />
        </>
    );
}
