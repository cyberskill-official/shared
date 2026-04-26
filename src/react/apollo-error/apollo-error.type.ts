import type { GraphQLError } from 'graphql';
import type { ReactNode } from 'react';

export type { GraphQLError } from 'graphql';

export interface I_ApolloErrorContext {
    error: GraphQLError | Error | null;
    showError: (error: GraphQLError | Error) => void;
    hideError: () => void;
}

export interface I_ApolloErrorProviderProps {
    children: ReactNode;
    onError?: (error: GraphQLError | Error) => void;
}
