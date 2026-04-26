import { ApolloServer } from '@apollo/server';
import http from 'node:http';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createApolloServer } from './apollo-server.util.js';

// Mock ApolloServer to avoid dual graphql module instance issue in vitest
// vi.mock is hoisted, so the factory must be fully self-contained
vi.mock('@apollo/server', () => {
    const MockApolloServer = vi.fn().mockImplementation(function (this: any, opts: any) {
        Object.assign(this, opts);
        this.start = vi.fn().mockResolvedValue(undefined);
        this.stop = vi.fn().mockResolvedValue(undefined);
    });
    return { ApolloServer: MockApolloServer };
});

vi.mock('@apollo/server/plugin/drainHttpServer', () => ({
    ApolloServerPluginDrainHttpServer: vi.fn(() => ({})),
}));

vi.mock('@apollo/server/plugin/landingPage/default', () => ({
    ApolloServerPluginLandingPageLocalDefault: vi.fn(() => ({ __isLocalLanding: true })),
    ApolloServerPluginLandingPageProductionDefault: vi.fn(() => ({ __isProdLanding: true })),
}));

vi.mock('@as-integrations/express5', () => ({
    expressMiddleware: vi.fn(),
}));

vi.mock('../log/index.js', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockSchema = {} as any;

describe('createApolloServer', () => {
    it('should create an ApolloServer instance', () => {
        const server = http.createServer();
        const apollo = createApolloServer({ server, schema: mockSchema, isDev: false });
        expect(apollo).toBeDefined();
        expect(typeof apollo.start).toBe('function');
        server.close();
    });

    it('should pass schema to ApolloServer constructor', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: false });
        expect(ApolloServer).toHaveBeenCalledWith(
            expect.objectContaining({ schema: mockSchema }),
        );
        server.close();
    });

    it('should enable introspection in dev mode', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: true });
        expect(ApolloServer).toHaveBeenCalledWith(
            expect.objectContaining({ introspection: true }),
        );
        server.close();
    });

    it('should not enable introspection in prod mode', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: false });
        const lastCall = (ApolloServer as any).mock.calls.at(-1)?.[0];
        expect(lastCall.introspection).toBeUndefined();
        server.close();
    });

    it('should accept a drainServer hook', () => {
        const server = http.createServer();
        const drainFn = vi.fn();
        const apollo = createApolloServer({ server, schema: mockSchema, isDev: false, drainServer: drainFn });
        expect(apollo).toBeDefined();
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        expect(constructorArg.plugins.length).toBeGreaterThan(1);
        server.close();
    });

    it('should call drainServer hook when serverWillStart and drainServer are invoked', async () => {
        const server = http.createServer();
        const drainFn = vi.fn();
        createApolloServer({ server, schema: mockSchema, isDev: false, drainServer: drainFn });
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        // Find the drain plugin (last one)
        const drainPlugin = constructorArg.plugins.find((p: any) => p.serverWillStart);
        expect(drainPlugin).toBeDefined();

        // Call the serverWillStart which returns drainServer
        const result = await drainPlugin.serverWillStart();
        expect(result).toHaveProperty('drainServer');

        // Call drainServer
        await result.drainServer();
        expect(drainFn).toHaveBeenCalled();
        server.close();
    });

    it('should not include drain plugin when drainServer is not provided', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: false });
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        const drainPlugin = constructorArg.plugins.find((p: any) => p.serverWillStart);
        expect(drainPlugin).toBeUndefined();
        server.close();
    });

    it('should enable includeStacktraceInErrorResponses in dev mode', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: true });
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        expect(constructorArg.includeStacktraceInErrorResponses).toBe(true);
        server.close();
    });

    it('should include depth limit in validationRules by default', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: false });
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        expect(constructorArg.validationRules).toBeDefined();
        expect(constructorArg.validationRules.length).toBeGreaterThan(0);
        server.close();
    });

    it('should handle custom validationRules alongside default depth limit', () => {
        const server = http.createServer();
        const customRule = vi.fn();
        createApolloServer({ server, schema: mockSchema, isDev: false, validationRules: [customRule as any] });
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        expect(constructorArg.validationRules).toContain(customRule);
        expect(constructorArg.validationRules.length).toBeGreaterThan(1);
        server.close();
    });

    it('should allow disabling query depth limit with maxQueryDepth = false', () => {
        const server = http.createServer();
        createApolloServer({ server, schema: mockSchema, isDev: false, maxQueryDepth: false });
        const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
        // If there are no rules, it should be undefined or empty
        expect(constructorArg.validationRules).toBeUndefined();
        server.close();
    });

    describe('depth limit rule logic', () => {
        let depthLimitRule: any;

        beforeAll(() => {
            const server = http.createServer();
            createApolloServer({ server, schema: mockSchema, isDev: false, maxQueryDepth: 2 });
            const constructorArg = (ApolloServer as any).mock.calls.at(-1)?.[0];
            depthLimitRule = constructorArg.validationRules[0];
            server.close();
        });

        it('should correctly validate depth limit AST with measureDepth', () => {
            const mockContext = { reportError: vi.fn() };
            const visitor = depthLimitRule(mockContext);

            // depth 1: field
            // depth 2: field
            // depth 3: field -> triggers limit (maxDepth is 2)
            const astDocument = {
                definitions: [
                    {
                        kind: 'OperationDefinition',
                        selectionSet: {
                            selections: [
                                {
                                    kind: 'Field',
                                    selectionSet: {
                                        selections: [
                                            {
                                                kind: 'Field',
                                                selectionSet: {
                                                    selections: [
                                                        { kind: 'Field' },
                                                    ],
                                                },
                                            },
                                            {
                                                kind: 'InlineFragment',
                                                selectionSet: {
                                                    selections: [
                                                        { kind: 'Field' },
                                                    ],
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            };

            // Traversal entry
            visitor.Document.enter(astDocument);

            expect(mockContext.reportError).toHaveBeenCalled();
            expect(mockContext.reportError.mock.calls[0]?.[0]?.message).toContain('exceeds the maximum allowed depth of 2');
        });

        it('should ignore empty definitions safely', () => {
            const mockContext = { reportError: vi.fn() };
            const visitor = depthLimitRule(mockContext);

            // Should not throw
            visitor.Document.enter({ definitions: [{ kind: 'OperationDefinition', selectionSet: undefined }] });

            expect(mockContext.reportError).not.toHaveBeenCalled();
        });
    });
});
