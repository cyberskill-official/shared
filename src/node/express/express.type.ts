import type { ExceptionFilter, Type, ValidationPipe } from '@nestjs/common';
import type { CorsOptions as CorsOptionsNestJS } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import type { CorsOptions, CorsOptionsDelegate, CorsRequest } from 'cors';
import type { Store } from 'express-rate-limit';

export type { NextFunction, Request, Response } from 'express';

export { Router } from 'express';

export interface I_RateLimitOptions {
    windowMs?: number;
    limit?: number;
    store?: Store;
    skip?: (req: import('express').Request) => boolean | Promise<boolean>;
    keyGenerator?: (req: import('express').Request, res: import('express').Response) => string | Promise<string>;
    /**
     * When the backing store errors (e.g. Redis down), allow the request through
     * instead of failing closed via the Express error handler. Defaults to `false`
     * in express-rate-limit; set `true` for fail-open production behavior.
     */
    passOnStoreError?: boolean;
    /** Override default `true` (IETF `RateLimit-*` headers). */
    standardHeaders?: boolean | 'draft-6' | 'draft-7' | 'draft-8';
    /** Override default `false` (legacy `X-RateLimit-*` headers). */
    legacyHeaders?: boolean;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

export interface I_ExpressOptions {
    isDev?: boolean;
    static?: string | string[];
    maxFileSize?: number;
    maxFiles?: number;
    jsonLimit?: string;
    trustProxy?: boolean | number | string | string[];
    rateLimit?: false | I_RateLimitOptions;
    /** Route path to scope graphqlUploadExpress middleware (defaults to '/graphql'). */
    uploadPath?: string;
    /**
     * Secret string for cookie-parser. Required for signed cookie verification.
     * Without a secret, `req.signedCookies` will always be empty.
     */
    cookieSecret?: string;
}

export interface I_NestOptions {
    module: Type<object>;
    isDev?: boolean;
    static?: string | string[];
    filters?: ExceptionFilter[];
    pipes?: ValidationPipe[];
    jsonLimit?: string;
    trustProxy?: boolean | number | string | string[];
    rateLimit?: false | I_RateLimitOptions;
    /**
     * Secret string for cookie-parser. Required for signed cookie verification.
     * Without a secret, `req.signedCookies` will always be empty.
     */
    cookieSecret?: string;
}

export type T_CorsType = 'node' | 'nest';

interface I_BaseCorsOptions {
    isDev?: boolean;
    whiteList?: string[];
}

interface I_CorsOptionsNode extends I_BaseCorsOptions, CorsOptions, CorsOptionsDelegate<CorsRequest> {
}

interface I_CorsOptionsNest extends I_BaseCorsOptions, CorsOptionsNestJS {
}

export type T_CorsOptions<T extends T_CorsType> = T extends 'node'
    ? I_CorsOptionsNode
    : I_CorsOptionsNest;
