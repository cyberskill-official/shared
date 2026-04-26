import type { GraphQLSchema, ValidationRule } from 'graphql';
import type { Server } from 'node:http';

export interface I_ApolloServerOptions {
    server: Server;
    schema: GraphQLSchema;
    isDev?: boolean;
    drainServer?: () => Promise<void>;
    /**
     * Maximum allowed depth for GraphQL queries.
     * Limits deeply nested queries to prevent abuse and denial-of-service.
     * Set to `0` or `false` to disable depth limiting entirely.
     * @default 10
     */
    maxQueryDepth?: number | false;
    /**
     * Additional GraphQL validation rules applied to every incoming operation.
     * These are appended after the built-in depth-limit rule (if enabled).
     */
    validationRules?: ValidationRule[];
}
