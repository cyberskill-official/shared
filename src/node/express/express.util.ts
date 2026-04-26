import type { INestApplication } from '@nestjs/common';
import type { Application, RequestHandler } from 'express';
import type { SessionOptions } from 'express-session';

import { NestFactory } from '@nestjs/core';
import bodyParser from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { express as useragent } from 'express-useragent';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import helmet from 'helmet';
import process from 'node:process';

import { E_Environment } from '#typescript/index.js';

import type { I_ExpressOptions, I_NestOptions, T_CorsOptions, T_CorsType } from './express.type.js';

import { log } from '../log/index.js';

/**
 * Creates CORS options with environment-specific configuration.
 * This function generates CORS options based on the development environment,
 * including whitelist configuration for allowed origins.
 *
 * @param options - CORS configuration options.
 * @param options.isDev - Whether the application is running in development mode.
 * @param options.whiteList - Array of allowed origins for CORS requests.
 * @returns CORS options object configured for the specified environment.
 */
export function createCorsOptions<T extends T_CorsType>({ isDev, whiteList, ...rest }: T_CorsOptions<T>) {
    // Safety net: warn loudly if isDev is mistakenly true in production
    if (isDev && process.env['NODE_ENV'] === E_Environment.PRODUCTION) {
        log.warn('[CORS] WARNING: isDev is true but NODE_ENV is "production". CORS restrictions are relaxed. This is likely a misconfiguration.');
    }

    return {
        ...rest,
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            // Allow requests without Origin header only in development mode.
            // In production, undefined origin (e.g., curl, server-to-server) is rejected.
            if (isDev && !origin) {
                callback(null, true);
                return;
            }

            if (origin && whiteList?.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'), false);
            }
        },
        credentials: true,
    };
}

/**
 * Creates a CORS middleware function with the specified configuration.
 * This function creates a CORS middleware that can be used with both Express and NestJS applications,
 * applying the configured CORS options for origin validation and credential handling.
 *
 * @param options - CORS configuration options to apply to the middleware.
 * @returns A CORS middleware function ready to be used in Express or NestJS applications.
 */
export function createCors<T extends T_CorsType>(options: T_CorsOptions<T>) {
    return cors<cors.CorsRequest>(createCorsOptions(options));
}

/**
 * Creates a session middleware function with the specified configuration.
 * This function creates an Express session middleware that can be used to handle user sessions
 * with the provided session options including secret, cookie settings, and storage configuration.
 *
 * @remarks
 * **CSRF Protection Required:** This middleware sets `SameSite=Lax` by default, which mitigates
 * but does **NOT** fully prevent CSRF attacks. Specifically, `Lax` allows cookies on top-level
 * GET navigations, which can be exploited for state-changing GET endpoints.
 *
 * **Consumer apps MUST add CSRF token validation** for all state-changing routes (POST, PUT,
 * DELETE, PATCH). Recommended libraries:
 * - `csrf-csrf` (double-submit cookie pattern — stateless, recommended)
 * - `csrf-sync` (synchronizer token pattern — requires session store)
 *
 * Example:
 * ```typescript
 * import { doubleCsrf } from 'csrf-csrf';
 * const { doubleCsrfProtection } = doubleCsrf({ getSecret: () => req.session.csrfSecret });
 * app.use(doubleCsrfProtection);
 * ```
 *
 * **Session Store Warning:** The default `MemoryStore` is not designed for production use:
 * it leaks memory under load and loses all sessions on restart. Configure a persistent
 * store (e.g., `connect-redis`, `connect-mongo`) for production deployments.
 *
 * @param options - Session configuration options including secret, cookie settings, and storage.
 * @returns A session middleware function ready to be used in Express applications.
 */
export function createSession(options: SessionOptions): RequestHandler {
    if (!options.secret) {
        throw new Error('Session secret is required. Provide a strong secret string.');
    }

    if (!options.store && process.env['NODE_ENV'] === E_Environment.PRODUCTION) {
        // Security: MemoryStore leaks memory and loses sessions on restart.
        // Throw in production to prevent accidental deployment without a persistent store.
        // Consumers can opt out with `allowMemoryStore: true` for intentional use cases.
        if ((options as unknown as Record<string, unknown>)['allowMemoryStore'] === true) {
            log.warn('[Session] WARNING: Using MemoryStore in production (explicitly allowed). This leaks memory and loses sessions on restart.');
        }
        else {
            throw new Error('[Session] No session store configured in production. The default MemoryStore leaks memory and loses sessions on restart. Use connect-redis, connect-mongo, or another production store. To suppress this error, pass `allowMemoryStore: true`.');
        }
    }

    const secureDefaults: Partial<SessionOptions> = {
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env['NODE_ENV'] === E_Environment.PRODUCTION,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    };

    return session({
        ...secureDefaults,
        ...options,
        cookie: { ...secureDefaults.cookie, ...options.cookie },
    });
}

/**
 * Sets up common middleware for Express applications.
 * This function configures essential middleware including:
 * - Trust proxy settings for proper IP handling
 * - Cookie parsing for request cookies
 * - URL-encoded body parsing for form data
 * - Compression for response optimization
 * - User agent parsing for device/browser detection
 * - Rate limiting (configurable, default 1000 req/15min)
 *
 * @remarks
 * **Rate limit store:** The default `MemoryStore` is only suitable for single-process
 * deployments. For multi-process or clustered environments, configure a shared store
 * (e.g., `rate-limit-redis`, `rate-limit-mongo`) via `rateLimitOptions.store`.
 *
 * @param app - The Express application instance to configure with middleware.
 * @param isDev - Whether the application is running in development mode.
 * @param jsonLimit - Maximum request body size for JSON payloads.
 * @param trustProxy - Trust proxy setting; pass a truthy value to enable.
 * @param rateLimitOptions - Rate limit configuration, or `false` to disable.
 */
function setupMiddleware(
    app: Application,
    isDev = false,
    jsonLimit = '1mb',
    trustProxy: boolean | number | string | string[] = 1,
    rateLimitOptions: false | import('./express.type.js').I_RateLimitOptions = {},
    cookieSecret?: string,
) {
    // Defense-in-depth: explicitly disable x-powered-by header even if helmet is disabled/reconfigured
    app.disable('x-powered-by');

    if (trustProxy) {
        app.set('trust proxy', trustProxy);
    }

    app.use(
        helmet({
            crossOriginEmbedderPolicy: isDev ? false : undefined,
            contentSecurityPolicy: isDev ? false : undefined,
        }),
    );

    if (rateLimitOptions !== false) {
        if (!rateLimitOptions.store && process.env['NODE_ENV'] === E_Environment.PRODUCTION) {
            log.warn('[RateLimit] WARNING: No rate limit store configured in production. The default MemoryStore does not work across clustered processes — attackers can bypass limits by hitting different workers. Use rate-limit-redis or another distributed store.');
        }

        app.use(
            rateLimit({
                windowMs: rateLimitOptions.windowMs ?? 15 * 60 * 1000,
                limit: rateLimitOptions.limit ?? 1000,
                standardHeaders: true,
                legacyHeaders: false,
                ...(rateLimitOptions.store !== undefined && { store: rateLimitOptions.store }),
                ...(rateLimitOptions.skip !== undefined && { skip: rateLimitOptions.skip }),
                ...(rateLimitOptions.keyGenerator !== undefined && { keyGenerator: rateLimitOptions.keyGenerator }),
            }),
        );
    }
    app.use(cookieParser(cookieSecret));
    app.use(express.json({ limit: jsonLimit }));
    app.use(express.urlencoded({ extended: true, limit: jsonLimit }));
    app.use(compression());
    app.use(useragent());
}

/**
 * Sets up static file serving for Express applications.
 * This function configures static file serving for the specified folders,
 * making files in those directories accessible via HTTP requests.
 *
 * @param app - The Express application instance to configure with static file serving.
 * @param staticFolders - A string or array of strings representing the paths to serve statically.
 */
function setupStaticFolders(app: Application, staticFolders?: string | string[]) {
    if (staticFolders) {
        const statics = Array.isArray(staticFolders) ? staticFolders : [staticFolders];
        statics.forEach((folder) => {
            app.use(`/${folder}`, express.static(folder));
        });
    }
}

/**
 * Creates and configures an Express application with common middleware and settings.
 * This function sets up a complete Express application with:
 * - Essential middleware (cookies, body parsing, compression, user agent)
 * - Static file serving for specified folders
 * - GraphQL upload support for file uploads
 *
 * @remarks
 * **Requires Express 5.x** — This module uses Express 5 APIs and is not compatible with Express 4.
 * The peer dependency requires `express >= 5.0.0`.
 *
 * @param options - Optional configuration for the Express application including static folder paths.
 * @returns A configured Express application instance ready for use.
 */
export function createExpress(options?: I_ExpressOptions): Application {
    const app = express();

    setupMiddleware(app, options?.isDev, options?.jsonLimit, options?.trustProxy, options?.rateLimit, options?.cookieSecret);
    setupStaticFolders(app, options?.static);
    const uploadMiddleware = graphqlUploadExpress({
        maxFileSize: options?.maxFileSize ?? 10_000_000,
        maxFiles: options?.maxFiles ?? 10,
    });
    app.use(options?.uploadPath ?? '/graphql', uploadMiddleware);

    return app;
}

/**
 * Creates and configures a NestJS application with Express integration.
 * This function sets up a NestJS application with:
 * - Express HTTP adapter configuration
 * - Common middleware (cookies, body parsing, compression, user agent)
 * - Static file serving for specified folders
 * - Global filters and pipes if provided
 *
 * @param options - Configuration options for the NestJS application including module, static folders, filters, and pipes.
 * @returns A promise that resolves to a configured NestJS application instance.
 */
export async function createNest(options: I_NestOptions): Promise<INestApplication> {
    const app = await NestFactory.create(options.module);

    setupMiddleware(app.getHttpAdapter().getInstance(), options.isDev, options.jsonLimit, options.trustProxy, options.rateLimit, options.cookieSecret);
    setupStaticFolders(app.getHttpAdapter().getInstance(), options.static);

    if (options.filters) {
        app.useGlobalFilters(...options.filters);
    }

    if (options.pipes) {
        app.useGlobalPipes(...options.pipes);
    }

    return app;
}

export { bodyParser, express };

/**
 * Creates a Content Security Policy (CSP) configuration for Helmet.
 * Provides sensible defaults with presets for common application patterns.
 *
 * @param options - Custom CSP directives to override or extend defaults.
 * @param preset - Pre-configured patterns ('default' or 'graphql').
 * @returns CSP configuration object for Helmet options.
 */
export function createCSP(
    options?: Record<string, string[] | string | boolean>,
    preset: 'default' | 'graphql' = 'default',
) {
    const defaultDirectives: Record<string, string[]> = {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        fontSrc: ['\'self\'', 'https:', 'data:'],
        connectSrc: ['\'self\''],
    };

    if (preset === 'graphql') {
        // Security: Use 'strict-dynamic' instead of 'unsafe-inline' for script execution.
        // 'unsafe-inline' completely defeats CSP script injection prevention (CWE-79).
        // 'strict-dynamic' allows scripts loaded by trusted scripts while blocking inline injection.
        defaultDirectives['scriptSrc']?.push('\'strict-dynamic\'', 'https://cdn.jsdelivr.net');
        defaultDirectives['styleSrc']?.push('https://cdn.jsdelivr.net');
        defaultDirectives['imgSrc']?.push('https://cdn.jsdelivr.net');
        log.warn('[CSP] GraphQL preset enables \'strict-dynamic\' for scriptSrc. Ensure your GraphQL playground loads scripts via trusted sources. For tighter security, provide a custom CSP with nonce-based script loading.');
    }

    return {
        directives: {
            ...defaultDirectives,
            ...options,
        },
    };
}
