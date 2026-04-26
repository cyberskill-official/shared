import type { ASTVisitor, ValidationContext } from 'graphql';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import {
    ApolloServerPluginLandingPageLocalDefault,
    ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware } from '@as-integrations/express5';
import { GraphQLError, Kind } from 'graphql';
import process from 'node:process';

import { E_Environment } from '#typescript/index.js';

import type { I_ApolloServerOptions } from './apollo-server.type.js';

import { log } from '../log/index.js';

const DEFAULT_MAX_QUERY_DEPTH = 10;

/**
 * Creates a GraphQL validation rule that rejects operations exceeding the
 * specified nesting depth. This prevents deeply nested queries from consuming
 * excessive server resources (query-depth DoS).
 *
 * @param maxDepth - Maximum allowed selection-set nesting depth.
 * @returns A GraphQL validation rule function.
 */
function createDepthLimitRule(maxDepth: number) {
    return function depthLimit(context: ValidationContext): ASTVisitor {
        return {
            Document: {
                enter(node) {
                    for (const definition of node.definitions) {
                        if (definition.kind === Kind.OPERATION_DEFINITION || definition.kind === Kind.FRAGMENT_DEFINITION) {
                            measureDepth(definition.selectionSet, 0, maxDepth, context);
                        }
                    }
                },
            },
        };
    };
}

/**
 * Recursively measures selection-set depth and reports an error when exceeded.
 */
function measureDepth(
    selectionSet: { selections: readonly { kind: string; selectionSet?: { selections: readonly unknown[] } }[] } | undefined,
    currentDepth: number,
    maxDepth: number,
    context: ValidationContext,
) {
    if (!selectionSet) {
        return;
    }

    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            if (currentDepth >= maxDepth) {
                context.reportError(
                    new GraphQLError(`Query depth of ${currentDepth + 1} exceeds the maximum allowed depth of ${maxDepth}.`),
                );
                return;
            }

            if (selection.selectionSet) {
                measureDepth(
                    selection.selectionSet as Parameters<typeof measureDepth>[0],
                    currentDepth + 1,
                    maxDepth,
                    context,
                );
            }
        }
        else if (selection.kind === Kind.INLINE_FRAGMENT || selection.kind === Kind.FRAGMENT_SPREAD) {
            measureDepth(
                (selection as { selectionSet?: Parameters<typeof measureDepth>[0] }).selectionSet,
                currentDepth,
                maxDepth,
                context,
            );
        }
    }
}

/**
 * Creates and configures an Apollo Server instance with appropriate plugins and settings.
 * This function sets up an Apollo Server with development or production landing pages,
 * HTTP server draining capabilities, and optional custom drain server hooks.
 *
 * The server is configured with:
 * - Development or production landing page based on the isDev flag
 * - HTTP server draining plugin for graceful shutdowns
 * - Optional custom drain server hook for additional cleanup
 * - Development-specific settings (introspection and stack traces) when isDev is true
 * - Query depth limiting (default: 10) to prevent deeply nested query abuse
 *
 * @param options - Configuration options for the Apollo Server including server instance, schema, and environment settings.
 * @returns A configured Apollo Server instance ready to be started.
 */
export function createApolloServer(options: I_ApolloServerOptions): ApolloServer {
    // Defense-in-depth: never enable dev features when NODE_ENV is 'production'
    const safeIsDev = options.isDev && process.env['NODE_ENV'] !== E_Environment.PRODUCTION;

    // Build validation rules: depth limit + user-provided rules
    const validationRules = buildValidationRules(options);

    return new ApolloServer({
        schema: options.schema,
        plugins: [
            safeIsDev
                ? ApolloServerPluginLandingPageLocalDefault()
                : ApolloServerPluginLandingPageProductionDefault(),
            ApolloServerPluginDrainHttpServer({ httpServer: options.server }),
            ...(options.drainServer
                ? [{
                        async serverWillStart() {
                            return {
                                async drainServer() {
                                    options.drainServer?.();
                                    log.info('Apollo Server drainServer hook called');
                                },
                            };
                        },
                    }]
                : []),
        ],
        ...(validationRules.length > 0 && { validationRules }),
        ...(safeIsDev && {
            introspection: true,
            includeStacktraceInErrorResponses: true,
        }),
    });
}

/**
 * Assembles the final list of GraphQL validation rules, prepending the
 * built-in depth-limit rule (unless explicitly disabled) before any
 * consumer-supplied rules.
 */
function buildValidationRules(options: I_ApolloServerOptions) {
    const rules = [];
    const maxDepth = options.maxQueryDepth;

    if (maxDepth !== false && maxDepth !== 0) {
        const depth = typeof maxDepth === 'number' ? maxDepth : DEFAULT_MAX_QUERY_DEPTH;
        rules.push(createDepthLimitRule(depth));
    }

    if (options.validationRules) {
        rules.push(...options.validationRules);
    }

    return rules;
}

export { expressMiddleware };
