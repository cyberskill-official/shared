import type { ApolloClient } from '@apollo/client';
import type { ApolloLink } from '@apollo/client/link';
import type { GraphQLError } from 'graphql';

import type { I_Children } from '#typescript/index.js';

export interface I_ApolloOptions extends Omit<ApolloClient.Options, 'link' | 'cache'> {
    uri?: string;
    wsUrl?: string;
    customLinks?: ApolloLink[];
    /** Enable round-trip timing logs for every GraphQL operation. Defaults to false. */
    debug?: boolean;
}

export interface I_ApolloProviderProps extends I_Children {
    isNextJS?: boolean;
    options?: I_ApolloOptions;
    /**
     * Optional callback to override the default Apollo error modal/toast handling.
     * When provided, the consumer is responsible for surfacing GraphQL errors.
     */
    onError?: (error: GraphQLError | Error) => void;
}

export type { ApolloCache, ApolloClient, ErrorLike } from '@apollo/client';
