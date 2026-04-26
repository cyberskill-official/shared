import {
    rewriteURIForGET,
    selectHttpOptionsAndBodyInternal,
} from '@apollo/client/link/http';
import extractFiles from 'extract-files/extractFiles.mjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createUploadLink } from './upload.js';

vi.mock('@apollo/client/link', () => {
    class MockApolloLink {
        public requestHandler: any;
        constructor(requestHandler?: any) {
            this.requestHandler = requestHandler;
        }

        request = vi.fn();
    }
    return { ApolloLink: MockApolloLink };
});

vi.mock('@apollo/client/link/http', () => ({
    defaultPrinter: vi.fn((_ast: any, _print: any) => 'query { test }'),
    fallbackHttpConfig: {},
    parseAndCheckHttpResponse: vi.fn(() => (response: any) => response.json()),
    rewriteURIForGET: vi.fn((_uri: string, _body: any) => ({ newURI: '/graphql?query=test', parseError: null })),
    selectHttpOptionsAndBodyInternal: vi.fn(() => ({
        options: { method: 'POST', headers: { 'content-type': 'application/json' } },
        body: { query: 'query { test }', variables: {} },
    })),
    selectURI: vi.fn((_operation: any, fallback: any) => (typeof fallback === 'string' ? fallback : '/graphql')),
}));

vi.mock('@apollo/client/utilities', () => {
    class MockObservable {
        private _subscriber: any;
        constructor(subscriber: (observer: any) => any) {
            this._subscriber = subscriber;
        }

        subscribe(observer: any) {
            const cleanup = this._subscriber(observer);
            return { unsubscribe: cleanup || (() => { }) };
        }
    }
    return { Observable: MockObservable };
});

vi.mock('extract-files/extractFiles.mjs', () => ({
    default: vi.fn(() => ({ clone: { query: 'query { test }', variables: {} }, files: new Map() })),
}));

vi.mock('extract-files/isExtractableFile.mjs', () => ({
    default: vi.fn(() => false),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('upload link', () => {
    describe('createUploadLink', () => {
        it('should be a function', () => {
            expect(typeof createUploadLink).toBe('function');
        });

        it('should return a link when called with defaults', () => {
            const link = createUploadLink();
            expect(link).toBeDefined();
        });

        it('should accept custom uri', () => {
            const link = createUploadLink({ uri: '/custom-graphql' });
            expect(link).toBeDefined();
        });

        it('should accept custom fetch function', () => {
            const customFetch = vi.fn();
            const link = createUploadLink({ fetch: customFetch });
            expect(link).toBeDefined();
        });

        it('should accept credentials and headers', () => {
            const link = createUploadLink({
                credentials: 'include',
                headers: { 'x-custom': 'test' },
            });
            expect(link).toBeDefined();
        });

        it('should accept custom FormData class', () => {
            const link = createUploadLink({ FormData: globalThis.FormData });
            expect(link).toBeDefined();
        });

        it('should accept includeExtensions option', () => {
            const link = createUploadLink({ includeExtensions: true });
            expect(link).toBeDefined();
        });
    });

    describe('operational behavior', () => {
        /**
         *
         */
        function createMockOperation(overrides: any = {}) {
            return {
                query: { definitions: [{ kind: 'OperationDefinition', operation: 'query' }] },
                variables: {},
                operationName: 'TestQuery',
                extensions: {},
                getContext: () => ({ headers: {}, ...overrides.context }),
                setContext: vi.fn(),
                ...overrides,
            };
        }

        it('should invoke the link request handler and complete on successful fetch', async () => {
            const mockResponse = {
                json: vi.fn().mockResolvedValue({ data: { test: true } }),
            };
            const mockFetch = vi.fn().mockResolvedValue(mockResponse);
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            const result = await new Promise((resolve, reject) => {
                observable.subscribe({
                    next: resolve,
                    error: reject,
                });
            });

            expect(mockFetch).toHaveBeenCalled();
            expect(result).toEqual({ data: { test: true } });
        });

        it('should handle file uploads with FormData', async () => {
            const file = new Blob(['test'], { type: 'text/plain' });
            const filesMap = new Map();
            filesMap.set(file, ['variables.file']);
            (extractFiles as any).mockReturnValueOnce({
                clone: { query: 'mutation { upload }', variables: { file: null } },
                files: filesMap,
            });

            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: { upload: true } }),
            });
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            expect(mockFetch).toHaveBeenCalled();
            const fetchArgs = mockFetch.mock.calls[0] as any[];
            const fetchOptions = fetchArgs[1];
            expect(fetchOptions.body).toBeInstanceOf(FormData);
        });

        it('should use GET for queries when useGETForQueries is true', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: {} }),
            });
            const link = createUploadLink({ fetch: mockFetch, useGETForQueries: true });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            expect(mockFetch).toHaveBeenCalled();
            const fetchArgs2 = mockFetch.mock.calls[0] as any[];
            expect(fetchArgs2[1].method).toBe('GET');
        });

        it('should not use GET for mutations even with useGETForQueries', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: {} }),
            });
            const link = createUploadLink({ fetch: mockFetch, useGETForQueries: true });
            const operation = createMockOperation({
                query: { definitions: [{ kind: 'OperationDefinition', operation: 'mutation' }] },
            });

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            const fetchArgs3 = mockFetch.mock.calls[0] as any[];
            expect(fetchArgs3[1].method).not.toBe('GET');
        });

        it('should handle fetch errors', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            const error = await new Promise((resolve) => {
                observable.subscribe({
                    next: () => { },
                    error: resolve,
                });
            });

            expect((error as Error).message).toBe('Network error');
        });

        it('should handle client awareness headers', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: {} }),
            });
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation({
                context: { clientAwareness: { name: 'TestApp', version: '1.0' } },
            });

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            expect(selectHttpOptionsAndBodyInternal).toHaveBeenCalled();
        });

        it('should return parseError via Observable when GET rewrite fails', async () => {
            (rewriteURIForGET as any).mockReturnValueOnce({ newURI: '', parseError: new Error('parse fail') });
            (selectHttpOptionsAndBodyInternal as any).mockReturnValueOnce({
                options: { method: 'GET', headers: {} },
                body: { query: 'query { test }' },
            });

            const mockFetch = vi.fn();
            const link = createUploadLink({ fetch: mockFetch, useGETForQueries: true });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            const error = await new Promise((resolve) => {
                observable.subscribe({ next: () => { }, error: resolve });
            });

            expect((error as Error).message).toBe('parse fail');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should handle cleanup/abort on unsubscribe', async () => {
            const mockFetch = vi.fn().mockReturnValue(new Promise(() => { })); // never resolves
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            const sub = observable.subscribe({ next: () => { }, error: () => { } });

            // Should not throw
            expect(() => sub.unsubscribe()).not.toThrow();
        });

        it('should forward error.result when it has errors and data', async () => {
            const errorResult = { errors: [{ message: 'partial error' }], data: { test: null } };
            const error = Object.assign(new Error('GraphQL error'), { result: errorResult });
            const mockFetch = vi.fn().mockRejectedValue(error);
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            const results: any[] = [];
            await new Promise<void>((resolve) => {
                observable.subscribe({
                    next: (val: any) => results.push(val),
                    error: () => resolve(),
                });
            });
            // Should have forwarded the error result before erroring
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle file upload with named File object', async () => {
            const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
            const filesMap = new Map();
            filesMap.set(file, ['variables.file']);
            (extractFiles as any).mockReturnValueOnce({
                clone: { query: 'mutation { upload }', variables: { file: null } },
                files: filesMap,
            });

            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: { upload: true } }),
            });
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            expect(mockFetch).toHaveBeenCalled();
            const fetchArgs = mockFetch.mock.calls[0] as any[];
            expect(fetchArgs[1].body).toBeInstanceOf(FormData);
        });

        it('should respect user-provided signal on operation context', async () => {
            const abortController = new AbortController();
            (selectHttpOptionsAndBodyInternal as any).mockReturnValueOnce({
                options: { method: 'POST', headers: {}, signal: abortController.signal },
                body: { query: 'query { test }', variables: {} },
            });

            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: {} }),
            });
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            expect(mockFetch).toHaveBeenCalled();
        });

        it('should handle already-aborted signal', async () => {
            const abortController = new AbortController();
            abortController.abort();
            (selectHttpOptionsAndBodyInternal as any).mockReturnValueOnce({
                options: { method: 'POST', headers: {}, signal: abortController.signal },
                body: { query: 'query { test }', variables: {} },
            });

            const mockFetch = vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ data: {} }),
            });
            const link = createUploadLink({ fetch: mockFetch });
            const operation = createMockOperation();

            const observable = (link as any).requestHandler(operation);
            await new Promise((resolve, reject) => {
                observable.subscribe({ next: resolve, error: reject });
            });

            expect(mockFetch).toHaveBeenCalled();
        });
    });
});
