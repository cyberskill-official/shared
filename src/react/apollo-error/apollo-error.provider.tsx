import type { GraphQLError } from 'graphql';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { I_ApolloErrorProviderProps } from './apollo-error.type.js';

import { ApolloErrorContext } from './apollo-error.context.js';
import { clearGlobalApolloErrorCallback, setGlobalApolloErrorCallback } from './apollo-error.util.js';

/**
 * Provider component that manages Apollo error state and provides error context.
 * This component sets up error handling for Apollo Client operations and provides
 * error state management to all child components through React context.
 *
 * Features:
 * - Global Apollo error state management
 * - Error context provision to child components
 * - Automatic error handling and display
 * - Optional custom error handling callbacks
 * - Integration with error boundaries
 *
 * @param props - Component props containing children.
 * @param props.children - React children that will have access to the error context.
 * @param props.onError - Optional callback to override the default error modal/toast flow.
 * @returns A React component that provides Apollo error context to its children.
 */
export function ApolloErrorProvider({ children, onError }: I_ApolloErrorProviderProps) {
    const [error, setError] = useState<GraphQLError | Error | null>(null);

    const handleGlobalError = useCallback((apolloError: GraphQLError | Error) => {
        if (onError) {
            onError(apolloError);

            return;
        }

        setError(apolloError);
    }, [onError]);

    useEffect(() => {
        setGlobalApolloErrorCallback(handleGlobalError, Boolean(onError));

        return () => {
            clearGlobalApolloErrorCallback();
        };
    }, [handleGlobalError, onError]);

    const hideError = useCallback(() => setError(null), []);

    const contextValue = useMemo(() => ({
        error: onError ? null : error,
        showError: handleGlobalError,
        hideError,
    }), [error, handleGlobalError, hideError, onError]);

    return (
        <ApolloErrorContext value={contextValue}>
            {children}
        </ApolloErrorContext>
    );
}
