import type { Request, Response } from 'express';
import type { Buffer } from 'node:buffer';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import { useServer as createGraphQLWSServer } from 'graphql-ws/use/ws';
import process from 'node:process';
import { WebSocketServer } from 'ws';

import type { I_AuthenticatedRequest, I_GraphqlWSOptions, I_WSOptions } from './ws.type.js';

import { log } from '../log/index.js';

/**
 * Creates a WebSocket server with the specified configuration.
 * This function creates a WebSocket server instance that can be attached to an HTTP server
 * and configured with a specific path for WebSocket connections.
 *
 * @remarks
 * **Authentication Warning:** When `sessionParser` is not provided, the WebSocket server
 * has **no session-based authentication**. Any client that can reach the endpoint can
 * establish a connection. Only omit `sessionParser` for truly public WebSocket endpoints
 * (e.g., health-check or anonymous broadcast channels). For authenticated subscriptions,
 * always provide a `sessionParser` to validate sessions on upgrade.
 *
 * @param options - Configuration options including the HTTP server instance and WebSocket path.
 * @returns A configured WebSocket server instance ready to handle connections.
 */
export function createWSServer(options: I_WSOptions): WebSocketServer {
    const { server, path, sessionParser, allowedOrigins } = options;

    if (!server) {
        throw new Error('[WS] HTTP server instance is required to create a WebSocket server.');
    }

    if (!path || !path.startsWith('/')) {
        throw new Error('[WS] WebSocket path must be a non-empty string starting with "/".');
    }

    /**
     * Validates the Origin header of an incoming WebSocket upgrade request.
     *
     * In production (`NODE_ENV === 'production'`), connections are **denied by default**
     * when no `allowedOrigins` are configured — failing closed prevents unintentional
     * open WebSocket endpoints (CWE-346).
     *
     * In development, an empty allowedOrigins list allows all origins for convenience.
     *
     * @returns `true` if the origin is allowed, `false` otherwise.
     * @security CWE-346 — prevents WebSocket Cross-Site Hijacking.
     */
    function isOriginAllowed(req: IncomingMessage): boolean {
        if (!allowedOrigins || allowedOrigins.length === 0) {
            // Production: deny by default when no allowedOrigins configured
            if (process.env['NODE_ENV'] === 'production') {
                return false;
            }
            return true;
        }
        const origin = req.headers['origin'];
        if (!origin) {
            return false;
        }
        return allowedOrigins.includes(origin);
    }

    if (sessionParser) {
        const wss = new WebSocketServer({ noServer: true });

        server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
            try {
                const url = new URL(req.url || '', 'http://localhost');
                if (url.pathname !== path)
                    return;

                // Security: Validate origin before session parsing to reject early (CWE-346)
                if (!isOriginAllowed(req)) {
                    log.warn(`[WS] Rejected connection from disallowed origin: ${req.headers['origin'] ?? '(none)'}`);
                    socket.destroy();
                    return;
                }

                sessionParser(req as Request, {} as Response, () => {
                    wss.handleUpgrade(req, socket, head, (ws) => {
                        wss.emit('connection', ws, req);
                    });
                });
            }
            catch {
                /* Intentionally empty — destroy socket on any URL parsing or session error */
                socket.destroy();
            }
        });

        return wss;
    }

    if (allowedOrigins && allowedOrigins.length > 0) {
        // When origin validation is needed but no sessionParser, use noServer mode with manual upgrade
        const wss = new WebSocketServer({ noServer: true });

        server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
            try {
                const url = new URL(req.url || '', 'http://localhost');
                if (url.pathname !== path)
                    return;

                if (!isOriginAllowed(req)) {
                    log.warn(`[WS] Rejected connection from disallowed origin: ${req.headers['origin'] ?? '(none)'}`);
                    socket.destroy();
                    return;
                }

                wss.handleUpgrade(req, socket, head, (ws) => {
                    wss.emit('connection', ws, req);
                });
            }
            catch {
                socket.destroy();
            }
        });

        log.warn(`[WS] Creating unauthenticated WebSocket at "${path}" with origin validation. No sessionParser provided — any client from an allowed origin can connect.`);
        return wss;
    }

    log.warn(`[WS] Creating unauthenticated WebSocket at "${path}". No sessionParser or allowedOrigins provided — any client can connect. Provide a sessionParser for authenticated endpoints.`);

    return new WebSocketServer({ server, path });
}

/**
 * Initializes GraphQL WebSocket server with schema and WebSocket server.
 * This function sets up GraphQL subscriptions over WebSocket by creating a GraphQL WebSocket server
 * that can handle GraphQL operations including queries, mutations, and subscriptions.
 *
 * @param options - Configuration options including the GraphQL schema and WebSocket server instance.
 * @returns A configured GraphQL WebSocket server ready to handle GraphQL operations over WebSocket.
 */
export function initGraphQLWS(options: I_GraphqlWSOptions) {
    const { schema, server, context: makeExtraContext, onConnect } = options;

    return createGraphQLWSServer(
        {
            schema,
            context: async (ctx) => {
                const req = ctx.extra.request as I_AuthenticatedRequest;

                const extra = makeExtraContext ? await makeExtraContext(req) : {};
                return { req, ...extra };
            },
            onConnect: async (ctx) => {
                if (onConnect) {
                    const req = ctx.extra.request as I_AuthenticatedRequest;
                    await onConnect(req);
                }
            },
        },
        server,
    );
}
