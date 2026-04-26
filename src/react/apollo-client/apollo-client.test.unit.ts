import type * as React from 'react';

import { CombinedGraphQLErrors, CombinedProtocolErrors, ServerError } from '@apollo/client/core';
import { ApolloLink } from '@apollo/client/link';
import { ErrorLink } from '@apollo/client/link/error';
import { describe, expect, it, vi } from 'vitest';

import { hasCustomApolloErrorHandler, showGlobalApolloError } from '../apollo-error/index.js';
import { log } from '../log/index.js';
import { toast } from '../toast/index.js';
import { createApolloLinks, getClient } from './apollo-client.util.js';

// All vi.mock factories are hoisted to the top of the file by vitest.
// Classes used with `new` in the source code MUST be mock-constructors, not arrow functions.

vi.mock('@apollo/client/core', () => {
    class MockApolloClient {
        __isApolloClient = true;
        constructor(opts: any) { Object.assign(this, opts); }
    }
    class MockInMemoryCache { }
    return {
        ApolloClient: MockApolloClient,
        InMemoryCache: MockInMemoryCache,
        CombinedGraphQLErrors: { is: vi.fn().mockReturnValue(false) },
        CombinedProtocolErrors: { is: vi.fn().mockReturnValue(false) },
        ServerError: { is: vi.fn().mockReturnValue(false) },
    };
});

vi.mock('@apollo/client/link', () => {
    class MockLink { }
    return {
        ApolloLink: Object.assign(MockLink, {
            from: vi.fn((links: any[]) => ({ links, __isLink: true })),
            split: vi.fn((_test: any, _a: any, b: any) => b),
            empty: vi.fn(() => ({ __isEmpty: true })),
        }),
    };
});

vi.mock('@apollo/client/link/error', () => {
    class MockErrorLink {
        static instances: MockErrorLink[] = [];
        constructor(public handler: any) {
            MockErrorLink.instances.push(this);
        }
    }
    return { ErrorLink: MockErrorLink };
});

vi.mock('@apollo/client/link/remove-typename', () => {
    class MockRemoveTypename { }
    return { RemoveTypenameFromVariablesLink: MockRemoveTypename };
});

vi.mock('@apollo/client/link/subscriptions', () => {
    class MockGraphQLWsLink {
        constructor(_client: any) { }
    }
    return { GraphQLWsLink: MockGraphQLWsLink };
});

vi.mock('graphql-ws', () => ({
    createClient: vi.fn(() => ({})),
}));

vi.mock('graphql', () => ({
    OperationTypeNode: { SUBSCRIPTION: 'subscription' },
}));

vi.mock('rxjs', () => ({
    tap: vi.fn(() => (source: any) => source),
}));

vi.mock('./links/index.js', () => ({
    createUploadLink: vi.fn(() => ({ __isUploadLink: true })),
}));

vi.mock('../apollo-error/index.js', () => ({
    hasCustomApolloErrorHandler: vi.fn().mockReturnValue(false),
    showGlobalApolloError: vi.fn(),
}));

vi.mock('../log/index.js', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../toast/index.js', () => ({
    toast: { error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('./apollo-client.module.scss', () => ({
    default: {},
}));

vi.mock('#constant/index.js', () => ({
    IS_BROWSER: true,
}));

// ---------------------------------------------------------------------------
// createApolloLinks
// ---------------------------------------------------------------------------
describe('createApolloLinks', () => {
    it('should return an array of links', () => {
        const links = createApolloLinks({ uri: 'http://localhost:4000/graphql' });
        expect(Array.isArray(links)).toBe(true);
        expect(links.length).toBeGreaterThan(0);
    });

    it('should include ws link when wsUrl is provided', () => {
        const links = createApolloLinks({
            uri: 'http://localhost:4000/graphql',
            wsUrl: 'ws://localhost:4000/graphql',
        });
        expect(links.length).toBeGreaterThan(0);
    });

    it('should work without wsUrl', () => {
        const links = createApolloLinks({ uri: 'http://localhost:4000/graphql' });
        expect(links.length).toBeGreaterThan(0);
    });

    it('should configure splitLink correctly when wsUrl is provided', () => {
        const splitMock = vi.mocked(ApolloLink.split);
        splitMock.mockClear();

        createApolloLinks({
            uri: 'http://localhost:4000/graphql',
            wsUrl: 'ws://localhost:4000/graphql',
        });

        expect(splitMock).toHaveBeenCalled();

        const predicate = splitMock.mock.lastCall?.[0] as (operation: any) => boolean;
        expect(predicate({ operationType: 'subscription' })).toBe(true);
        expect(predicate({ operationType: 'mutation' })).toBe(false);
    });

    it('should include custom links when provided', () => {
        const customLink = { __isCustom: true } as any;
        const links = createApolloLinks({
            uri: 'http://localhost:4000/graphql',
            customLinks: [customLink],
        });
        expect(links).toContain(customLink);
    });

    it('should warn when no uri is provided', () => {
        createApolloLinks({} as any);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('No GraphQL URI'));
    });
});

// ---------------------------------------------------------------------------
// getClient
// ---------------------------------------------------------------------------
describe('getClient', () => {
    it('should return an Apollo Client instance', () => {
        const client = getClient({ uri: 'http://localhost:4000/graphql' });
        expect(client).toBeDefined();
        expect((client as any).__isApolloClient).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ErrorLink callback branches
// ---------------------------------------------------------------------------
describe('errorLink callback', () => {
    // Capture the error handler callback from ErrorLink mock
    /**
     *
     */
    function getErrorHandler() {
        const instance = (ErrorLink as any).instances[0];
        return instance?.handler as (args: { error: any; operation: any }) => void;
    }

    const mockOperation = { operationName: 'TestOp' };

    it('should handle CombinedGraphQLErrors', () => {
        vi.mocked(CombinedGraphQLErrors.is).mockReturnValueOnce(true);
        const handler = getErrorHandler();
        handler({
            error: {
                message: 'gql error',
                errors: [
                    { message: 'Field error', locations: [{ line: 1, column: 1 }], path: ['test'] },
                    { message: 'Second error', locations: [], path: [] },
                ],
            },
            operation: mockOperation,
        });
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('GraphQL error'));
    });

    it('should handle CombinedProtocolErrors', () => {
        vi.mocked(CombinedGraphQLErrors.is).mockReturnValueOnce(false);
        vi.mocked(CombinedProtocolErrors.is).mockReturnValueOnce(true);
        const handler = getErrorHandler();
        handler({
            error: {
                message: 'protocol error',
                errors: [
                    { message: 'Protocol issue', extensions: { code: 'TEST' } },
                    { message: 'Another', extensions: {} },
                ],
            },
            operation: mockOperation,
        });
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Protocol error'));
    });

    it('should handle ServerError', () => {
        vi.mocked(CombinedGraphQLErrors.is).mockReturnValueOnce(false);
        vi.mocked(CombinedProtocolErrors.is).mockReturnValueOnce(false);
        vi.mocked(ServerError.is).mockReturnValueOnce(true);
        const handler = getErrorHandler();
        handler({
            error: { message: 'Server failure' },
            operation: mockOperation,
        });
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Server error'));
    });

    it('should handle generic network error', () => {
        vi.mocked(CombinedGraphQLErrors.is).mockReturnValueOnce(false);
        vi.mocked(CombinedProtocolErrors.is).mockReturnValueOnce(false);
        vi.mocked(ServerError.is).mockReturnValueOnce(false);
        const handler = getErrorHandler();
        handler({
            error: { message: 'Network down' },
            operation: mockOperation,
        });
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });

    it('should invoke custom apollo error handler in browser when available', () => {
        vi.mocked(ServerError.is).mockReturnValue(true);
        vi.mocked(hasCustomApolloErrorHandler).mockReturnValueOnce(true);

        const handler = getErrorHandler();
        handler({
            error: { message: 'Test error' },
            operation: mockOperation,
        });

        expect(showGlobalApolloError).toHaveBeenCalled();
        vi.mocked(ServerError.is).mockReset();
    });

    it('should invoke toast.error in browser when no custom handler', () => {
        vi.mocked(ServerError.is).mockReturnValue(true);
        vi.mocked(hasCustomApolloErrorHandler).mockReturnValueOnce(false);

        const handler = getErrorHandler();
        handler({
            error: { message: 'Test error' },
            operation: mockOperation,
        });
        expect(toast.error).toHaveBeenCalled();
        const renderArg = vi.mocked(toast.error).mock.calls[0]?.[0];
        expect(typeof renderArg).toBe('function');

        const result = (renderArg as (props: { id: string }) => React.ReactElement)({ id: 'test-id' });
        expect(result).toBeDefined();
        // Extract the button from the JSX and invoke onClick
        const buttonElement = (result.props as any).children[1];
        expect(buttonElement.type).toBe('button');

        vi.mocked(showGlobalApolloError).mockClear();
        vi.mocked(toast.dismiss).mockClear();

        buttonElement.props.onClick();
        expect(showGlobalApolloError).toHaveBeenCalled();
        expect(toast.dismiss).toHaveBeenCalledWith('test-id');
        vi.mocked(ServerError.is).mockReset();
    });
});
