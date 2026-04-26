import { registerApolloClient } from '@apollo/client-integration-nextjs';
import { describe, expect, it, vi } from 'vitest';

import { makeClient } from './apollo-client-nextjs.rsc.js';

vi.mock('@apollo/client-integration-nextjs', () => ({
    ApolloClient: vi.fn().mockImplementation(function (this: any, opts: any) {
        Object.assign(this, opts);
        this._isApolloClient = true;
    }),
    InMemoryCache: vi.fn(),
    registerApolloClient: vi.fn((factory: () => unknown) => ({ getClient: factory })),
    ApolloNextAppProvider: vi.fn(({ children }: { children: unknown }) => children),
}));

vi.mock('@apollo/client/link', () => {
    class MockApolloLink {
        constructor(public requestHandler?: unknown) { }
        request = vi.fn();
        static from = vi.fn((links: unknown[]) => ({ _links: links }));
        static empty = vi.fn(() => new MockApolloLink());
        static split = vi.fn((_test: unknown, _left: unknown, right: unknown) => right);
    }
    return { ApolloLink: MockApolloLink };
});

vi.mock('@apollo/client/link/error', () => ({ ErrorLink: vi.fn() }));
vi.mock('@apollo/client/link/remove-typename', () => ({ RemoveTypenameFromVariablesLink: vi.fn() }));
vi.mock('@apollo/client/link/subscriptions', () => ({ GraphQLWsLink: vi.fn() }));
vi.mock('graphql-ws', () => ({ createClient: vi.fn() }));
vi.mock('rxjs', () => ({ tap: vi.fn() }));
vi.mock('../apollo-error/index.js', () => ({
    ApolloErrorComponent: vi.fn(() => null),
    ApolloErrorProvider: vi.fn(({ children }: { children: unknown }) => children),
    hasCustomApolloErrorHandler: vi.fn(() => false),
    showGlobalApolloError: vi.fn(),
}));
vi.mock('../log/index.js', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../toast/index.js', () => ({ toast: { error: vi.fn() }, Toaster: vi.fn(() => null) }));
vi.mock('../apollo-client/apollo-client.module.scss', () => ({ default: {} }));
vi.mock('../apollo-client/links/index.js', () => ({
    createUploadLink: vi.fn(() => ({ _isUploadLink: true })),
}));

describe('makeClient (RSC)', () => {
    it('should call registerApolloClient', () => {
        makeClient();
        expect(registerApolloClient).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should pass factory that returns an Apollo Client', () => {
        const result = makeClient() as any;
        const client = result.getClient();
        expect(client).toBeDefined();
        expect(client).toHaveProperty('_isApolloClient', true);
    });

    it('should forward options to getClient', () => {
        const result = makeClient({ uri: 'http://test.com/graphql' }) as any;
        const client = result.getClient();
        expect(client).toBeDefined();
    });
});
