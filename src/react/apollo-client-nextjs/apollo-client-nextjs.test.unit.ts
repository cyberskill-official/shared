import { describe, expect, it, vi } from 'vitest';

import { getClient } from './apollo-client-nextjs.util.js';

vi.mock('@apollo/client-integration-nextjs', () => {
    class MockApolloClient {
        link: unknown;
        cache: unknown;
        _isApolloClient = true;
        constructor(config: { link?: unknown; cache?: unknown }) {
            this.link = config?.link;
            this.cache = config?.cache;
        }
    }

    class MockInMemoryCache {
        _isCache = true;
    }

    return {
        ApolloClient: MockApolloClient,
        InMemoryCache: MockInMemoryCache,
        ApolloNextAppProvider: vi.fn(({ children }: { children: unknown }) => children),
    };
});

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

vi.mock('@apollo/client/link/error', () => ({
    ErrorLink: vi.fn(),
}));

vi.mock('@apollo/client/link/remove-typename', () => ({
    RemoveTypenameFromVariablesLink: vi.fn(),
}));

vi.mock('@apollo/client/link/subscriptions', () => ({
    GraphQLWsLink: vi.fn(),
}));

vi.mock('graphql-ws', () => ({
    createClient: vi.fn(),
}));

vi.mock('rxjs', () => ({
    tap: vi.fn(),
}));

vi.mock('../apollo-error/index.js', () => ({
    ApolloErrorComponent: vi.fn(() => null),
    ApolloErrorProvider: vi.fn(({ children }: { children: unknown }) => children),
    hasCustomApolloErrorHandler: vi.fn(() => false),
    showGlobalApolloError: vi.fn(),
}));

vi.mock('../log/index.js', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../toast/index.js', () => ({
    toast: { error: vi.fn() },
    Toaster: vi.fn(() => null),
}));

vi.mock('../apollo-client/apollo-client.module.scss', () => ({
    default: {},
}));

vi.mock('./apollo-client-nextjs.util.js', async (importOriginal) => {
    return importOriginal();
});

vi.mock('../apollo-client/links/index.js', () => ({
    createUploadLink: vi.fn(() => ({ _isUploadLink: true })),
}));

describe('apollo-client-nextjs', () => {
    describe('getClient', () => {
        it('should return an Apollo Client instance', () => {
            const client = getClient();
            expect(client).toBeDefined();
            expect(client).toHaveProperty('_isApolloClient', true);
        });

        it('should create client with InMemoryCache', () => {
            const client = getClient();
            expect(client).toHaveProperty('cache');
        });

        it('should accept custom options', () => {
            const client = getClient({ uri: 'http://localhost:4000/graphql' });
            expect(client).toBeDefined();
        });

        it('should create link chain from createApolloLinks', () => {
            const client = getClient({ uri: 'http://test.com/graphql' });
            expect(client).toHaveProperty('link');
        });
    });
});
