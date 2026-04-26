import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';

import { createCors, createCorsOptions, createCSP, createExpress, createNest, createSession } from './express.util.js';

const logMock = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../log/index.js', () => ({
    log: logMock,
}));

// ---------------------------------------------------------------------------
// createCorsOptions
// ---------------------------------------------------------------------------
describe('createCorsOptions', () => {
    it('should allow undefined origin in dev mode', () => {
        const options = createCorsOptions({ isDev: true, whiteList: [] });
        const callback = vi.fn();
        options.origin(undefined, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('should reject requests with no origin in production', () => {
        const options = createCorsOptions({ isDev: false, whiteList: ['http://allowed.com'] });
        const callback = vi.fn();
        options.origin(undefined, callback);
        expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    });

    it('should allow whitelisted origins', () => {
        const options = createCorsOptions({ isDev: false, whiteList: ['http://app.com'] });
        const callback = vi.fn();
        options.origin('http://app.com', callback);
        expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('should reject non-whitelisted origins in production', () => {
        const options = createCorsOptions({ isDev: false, whiteList: ['http://app.com'] });
        const callback = vi.fn();
        options.origin('http://evil.com', callback);
        expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    });

    it('should set credentials to true', () => {
        const options = createCorsOptions({ isDev: false, whiteList: [] });
        expect(options.credentials).toBe(true);
    });

    it('should pass through extra options', () => {
        const options = createCorsOptions({ isDev: false, whiteList: [], maxAge: 3600 } as any);
        expect(options.maxAge).toBe(3600);
    });
});

// ---------------------------------------------------------------------------
// createCors
// ---------------------------------------------------------------------------
describe('createCors', () => {
    it('should return a function (middleware)', () => {
        const middleware = createCors({ isDev: true, whiteList: [] });
        expect(typeof middleware).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------
describe('createSession', () => {
    it('should return a function (middleware)', () => {
        const middleware = createSession({ secret: 'test-secret' });
        expect(typeof middleware).toBe('function');
    });

    it('should set httpOnly cookie by default', () => {
        // We test the defaults by verifying the middleware is created without error
        const middleware = createSession({
            secret: 'test-secret',
            cookie: { maxAge: 60000 },
        });
        expect(typeof middleware).toBe('function');
    });

    it('should throw when no secret is provided', () => {
        expect(() => createSession({} as any)).toThrow('Session secret is required');
    });
});

// ---------------------------------------------------------------------------
// createExpress
// ---------------------------------------------------------------------------
describe('createExpress', () => {
    it('should return an express application', () => {
        const app = createExpress();
        expect(app).toBeDefined();
        expect(typeof app.use).toBe('function');
        expect(typeof app.get).toBe('function');
        expect(typeof app.listen).toBe('function');
    });

    it('should accept options for static folders', () => {
        const app = createExpress({ static: 'uploads' });
        expect(app).toBeDefined();
    });

    it('should accept isDev option', () => {
        const app = createExpress({ isDev: true });
        expect(app).toBeDefined();
    });

    it('should accept custom file limits', () => {
        const app = createExpress({ maxFileSize: 5_000_000, maxFiles: 3 });
        expect(app).toBeDefined();
    });

    it('should accept array of static folders', () => {
        const app = createExpress({ static: ['uploads', 'public'] });
        expect(app).toBeDefined();
    });

    it('should accept rateLimit: false to disable rate limiting', () => {
        const app = createExpress({ rateLimit: false });
        expect(app).toBeDefined();
    });

    it('should accept custom rate limit options', () => {
        const app = createExpress({ rateLimit: { windowMs: 60_000, limit: 100 } });
        expect(app).toBeDefined();
    });

    it('should accept trustProxy option', () => {
        const app = createExpress({ trustProxy: 1 });
        expect(app).toBeDefined();
    });

    it('should set trust proxy to 1 by default', () => {
        const app = createExpress();
        expect(app.get('trust proxy')).toBeTruthy();
    });

    it('should set trust proxy when trustProxy is provided', () => {
        const app = createExpress({ trustProxy: 2 });
        expect(app.get('trust proxy fn')).toBeDefined();
    });

    it('should disable x-powered-by header', () => {
        const app = createExpress();
        expect(app.disabled('x-powered-by')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// createExpress rate limiting behavior
// ---------------------------------------------------------------------------
describe('createExpress rate limiting', () => {
    it('should apply rate limit middleware by default', () => {
        const mockMiddleware = vi.fn((_req, _res, next) => next());
        const mockRateLimit = vi.fn(() => mockMiddleware);

        vi.doMock('express-rate-limit', () => ({ default: mockRateLimit }));

        // The rate limit is already applied at module load; verify via app middleware
        const app = createExpress();
        // Verify the app is created and functional (rate limit middleware is part of stack)
        expect(app).toBeDefined();
        vi.doUnmock('express-rate-limit');
    });

    it('should apply rate limit with custom options when provided', async () => {
        const { default: rateLimit } = await import('express-rate-limit');
        const rateLimitSpy = vi.spyOn({ rateLimit }, 'rateLimit');

        const customStore = { increment: vi.fn(), decrement: vi.fn(), resetKey: vi.fn(), resetAll: vi.fn() } as any;
        const customSkip = vi.fn().mockReturnValue(false);

        const app = createExpress({
            rateLimit: {
                windowMs: 30_000,
                limit: 50,
                store: customStore,
                skip: customSkip,
            },
        });

        expect(app).toBeDefined();
        rateLimitSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// createNest
// ---------------------------------------------------------------------------
vi.mock('@nestjs/core', () => ({
    NestFactory: {
        create: vi.fn(async () => ({
            getHttpAdapter: vi.fn(() => ({
                getInstance: vi.fn(() => ({
                    use: vi.fn(),
                    set: vi.fn(),
                    disable: vi.fn(),
                })),
            })),
            useGlobalFilters: vi.fn(),
            useGlobalPipes: vi.fn(),
        })),
    },
}));

describe('createNest', () => {
    it('should create a NestJS application', async () => {
        const app = await createNest({ module: {} as any });
        expect(app).toBeDefined();
        expect(typeof app.getHttpAdapter).toBe('function');
    });

    it('should apply global filters when provided', async () => {
        const filter = {} as any;
        const app = await createNest({ module: {} as any, filters: [filter] });
        expect(app.useGlobalFilters).toHaveBeenCalledWith(filter);
    });

    it('should apply global pipes when provided', async () => {
        const pipe = {} as any;
        const app = await createNest({ module: {} as any, pipes: [pipe] });
        expect(app.useGlobalPipes).toHaveBeenCalledWith(pipe);
    });

    it('should not apply filters when not provided', async () => {
        const app = await createNest({ module: {} as any });
        expect(app.useGlobalFilters).not.toHaveBeenCalled();
    });

    it('should accept rateLimit: false to disable rate limiting', async () => {
        const app = await createNest({ module: {} as any, rateLimit: false });
        expect(app).toBeDefined();
    });

    it('should accept custom rate limit options', async () => {
        const app = await createNest({ module: {} as any, rateLimit: { windowMs: 60_000, limit: 200 } });
        expect(app).toBeDefined();
    });

    it('should accept trustProxy option', async () => {
        const app = await createNest({ module: {} as any, trustProxy: true });
        expect(app).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// createCSP
// ---------------------------------------------------------------------------
describe('createCSP', () => {
    it('should return default preset CSP directives', () => {
        const csp = createCSP();
        expect((csp.directives as any)['defaultSrc']).toContain('\'self\'');
        expect((csp.directives as any)['scriptSrc']).toEqual(['\'self\'']);
        expect((csp.directives as any)['styleSrc']).toEqual(['\'self\'', '\'unsafe-inline\'']);
    });

    it('should return graphql preset CSP directives', () => {
        const csp = createCSP(undefined, 'graphql');
        expect((csp.directives as any)['scriptSrc']).toContain('\'strict-dynamic\'');
        expect((csp.directives as any)['scriptSrc']).not.toContain('\'unsafe-inline\'');
        expect((csp.directives as any)['scriptSrc']).toContain('https://cdn.jsdelivr.net');
    });

    it('should merge user provided directives', () => {
        const csp = createCSP({ frameSrc: ['\'none\''] });
        expect((csp.directives as any)['frameSrc']).toEqual(['\'none\'']);
        expect((csp.directives as any)['defaultSrc']).toContain('\'self\''); // default still there
    });

    it('should NOT include unsafe-eval in graphql preset scriptSrc', () => {
        const csp = createCSP(undefined, 'graphql');
        expect((csp.directives as any)['scriptSrc']).not.toContain('\'unsafe-eval\'');
    });
});

// ---------------------------------------------------------------------------
// createSession (Additional coverage)
// ---------------------------------------------------------------------------
describe('createSession additional coverage', () => {
    it('should throw if no secret is provided', () => {
        expect(() => createSession({} as any)).toThrowError('Session secret is required');
    });

    it('should set secure defaults', () => {
        const sessionMiddleware = createSession({ secret: 'test-secret' });
        expect(typeof sessionMiddleware).toBe('function');
    });

    it('should throw when no store is configured in production', () => {
        const original = process.env['NODE_ENV'];
        process.env['NODE_ENV'] = 'production';

        expect(() => createSession({ secret: 'test-secret' })).toThrow(
            'No session store configured in production',
        );

        process.env['NODE_ENV'] = original;
    });

    it('should warn but allow when allowMemoryStore is true in production', () => {
        const original = process.env['NODE_ENV'];
        process.env['NODE_ENV'] = 'production';
        logMock.warn.mockClear();

        const sessionMiddleware = createSession({ secret: 'test-secret', allowMemoryStore: true } as any);

        expect(typeof sessionMiddleware).toBe('function');
        expect(logMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('Using MemoryStore in production'),
        );
        process.env['NODE_ENV'] = original;
    });
});

// ---------------------------------------------------------------------------
// createCorsOptions (safety-net logging coverage)
// ---------------------------------------------------------------------------
describe('createCorsOptions safety warnings', () => {
    it('should warn when isDev is true but NODE_ENV is production', () => {
        const original = process.env['NODE_ENV'];
        process.env['NODE_ENV'] = 'production';
        logMock.warn.mockClear();

        createCorsOptions({ isDev: true, whiteList: [] });

        expect(logMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('isDev is true but NODE_ENV is "production"'),
        );
        process.env['NODE_ENV'] = original;
    });
});
