import type { RequestHandler } from 'express';
import type { GraphQLSchema } from 'graphql';
import type { IncomingMessage, Server } from 'node:http';
import type { WebSocketServer } from 'ws';

/** Extends `IncomingMessage` with optional session and user properties set by authentication middleware. */
export interface I_AuthenticatedRequest extends IncomingMessage {
    session?: Record<string, unknown>;
    user?: Record<string, unknown>;
}

export interface I_WSOptions {
    server: Server;
    path: string;
    sessionParser?: RequestHandler;
    /**
     * List of allowed origins for WebSocket connections. When provided, the `Origin`
     * header on upgrade requests is validated against this list. Connections from
     * unlisted origins are rejected to prevent WebSocket Cross-Site Hijacking (CWE-346).
     *
     * @security Omitting this option allows connections from ANY origin.
     */
    allowedOrigins?: string[];
}

export interface I_GraphqlWSOptions {
    schema: GraphQLSchema;
    server: WebSocketServer;
    context?: (req: I_AuthenticatedRequest) =>
        Promise<Record<string, unknown>> | Record<string, unknown>;
    onConnect?: (req: I_AuthenticatedRequest) =>
        Promise<void> | void;
}
