import { useServer as createGraphQLWSServer } from 'graphql-ws/use/ws';
import { Buffer } from 'node:buffer';
import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { createWSServer, initGraphQLWS } from './ws.util.js';

vi.mock('graphql-ws/use/ws', () => ({
    useServer: vi.fn((config: any, _server: any) => config),
}));

vi.mock('../log/index.js', () => ({
    log: { warn: vi.fn(), error: vi.fn() },
}));

describe('createWSServer', () => {
    it('should throw when server is not provided', () => {
        expect(() => createWSServer({ path: '/ws' } as any)).toThrow('HTTP server instance is required');
    });

    it('should throw when path is missing or invalid', () => {
        const server = http.createServer();
        expect(() => createWSServer({ server, path: '' } as any)).toThrow('WebSocket path must be a non-empty string starting with "/"');
        expect(() => createWSServer({ server, path: 'ws' } as any)).toThrow('WebSocket path must be a non-empty string starting with "/"');
        server.close();
    });

    it('should create a WebSocketServer with server and path (no session parser)', () => {
        const server = http.createServer();
        const wss = createWSServer({ server, path: '/ws' });
        expect(wss).toBeInstanceOf(WebSocketServer);
        server.close();
    });

    it('should create a noServer WebSocketServer when session parser is provided', () => {
        const server = http.createServer();
        const sessionParser = vi.fn((_req: any, _res: any, next: any) => next());
        const wss = createWSServer({ server, path: '/ws', sessionParser });
        expect(wss).toBeInstanceOf(WebSocketServer);
        server.close();
    });

    it('should register upgrade handler when session parser is provided', () => {
        const server = http.createServer();
        const onSpy = vi.spyOn(server, 'on');
        const sessionParser = vi.fn((_req: any, _res: any, next: any) => next());
        createWSServer({ server, path: '/ws', sessionParser });
        expect(onSpy).toHaveBeenCalledWith('upgrade', expect.any(Function));
        server.close();
    });

    it('should skip upgrade for non-matching path', () => {
        const server = http.createServer();
        const sessionParser = vi.fn((_req: any, _res: any, next: any) => next());
        const wss = createWSServer({ server, path: '/ws', sessionParser });

        const upgradeHandler = (server as any).listeners('upgrade').find((fn: any) => fn);
        if (upgradeHandler) {
            const mockReq = { url: '/other-path', headers: {} } as any;
            const mockSocket = { destroy: vi.fn() } as any;
            const mockHead = Buffer.from('');
            upgradeHandler(mockReq, mockSocket, mockHead);
        }
        expect(wss).toBeInstanceOf(WebSocketServer);
        server.close();
    });

    it('should call sessionParser and handleUpgrade for matching path', () => {
        const server = http.createServer();
        const sessionParser = vi.fn((_req: any, _res: any, next: any) => next());
        const wss = createWSServer({ server, path: '/ws', sessionParser });

        const handleUpgradeSpy = vi.spyOn(wss, 'handleUpgrade').mockImplementation(
            ((_req: any, _socket: any, _head: any, cb: any) => cb({} as any)) as any,
        );
        const emitSpy = vi.spyOn(wss, 'emit');

        const upgradeHandler = (server as any).listeners('upgrade').find((fn: any) => fn);
        if (upgradeHandler) {
            const mockReq = { url: '/ws', headers: {} } as any;
            const mockSocket = { destroy: vi.fn() } as any;
            const mockHead = Buffer.from('');
            upgradeHandler(mockReq, mockSocket, mockHead);
            expect(sessionParser).toHaveBeenCalled();
            expect(handleUpgradeSpy).toHaveBeenCalled();
            expect(emitSpy).toHaveBeenCalledWith('connection', expect.anything(), mockReq);
        }
        server.close();
    });

    it('should destroy socket on upgrade error', () => {
        const server = http.createServer();
        const sessionParser = vi.fn(() => {
            throw new Error('session error');
        });
        createWSServer({ server, path: '/ws', sessionParser });

        const upgradeHandler = (server as any).listeners('upgrade').find((fn: any) => fn);
        if (upgradeHandler) {
            const mockReq = { url: '/ws', headers: {} } as any;
            const mockSocket = { destroy: vi.fn() } as any;
            const mockHead = Buffer.from('');
            upgradeHandler(mockReq, mockSocket, mockHead);
            expect(mockSocket.destroy).toHaveBeenCalled();
        }
        server.close();
    });

    it('should match path ignoring query parameters on upgrade', () => {
        const server = http.createServer();
        const sessionParser = vi.fn((_req: any, _res: any, next: any) => next());
        const wss = createWSServer({ server, path: '/ws', sessionParser });

        const handleUpgradeSpy = vi.spyOn(wss, 'handleUpgrade').mockImplementation(
            ((_req: any, _socket: any, _head: any, cb: any) => cb({} as any)) as any,
        );

        const upgradeHandler = (server as any).listeners('upgrade').find((fn: any) => fn);
        if (upgradeHandler) {
            const mockReq = { url: '/ws?token=abc123', headers: {} } as any;
            const mockSocket = { destroy: vi.fn() } as any;
            const mockHead = Buffer.from('');
            upgradeHandler(mockReq, mockSocket, mockHead);
            expect(sessionParser).toHaveBeenCalled();
            expect(handleUpgradeSpy).toHaveBeenCalled();
        }
        server.close();
    });

    it('should skip upgrade for encoded path that does not match', () => {
        const server = http.createServer();
        const sessionParser = vi.fn((_req: any, _res: any, next: any) => next());
        const wss = createWSServer({ server, path: '/ws', sessionParser });

        const handleUpgradeSpy = vi.spyOn(wss, 'handleUpgrade');

        const upgradeHandler = (server as any).listeners('upgrade').find((fn: any) => fn);
        if (upgradeHandler) {
            // %77%73 = 'ws' percent-encoded — pathname becomes '/ws' after URL parsing
            // but '/not-ws' should not match
            const mockReq = { url: '/not-ws', headers: {} } as any;
            const mockSocket = { destroy: vi.fn() } as any;
            const mockHead = Buffer.from('');
            upgradeHandler(mockReq, mockSocket, mockHead);
            expect(handleUpgradeSpy).not.toHaveBeenCalled();
        }
        server.close();
    });
});

describe('initGraphQLWS', () => {
    it('should call createGraphQLWSServer with schema and server', () => {
        const mockSchema = { kind: 'Document' } as any;
        const mockWss = {} as any;
        initGraphQLWS({ schema: mockSchema, server: mockWss });
        expect(createGraphQLWSServer).toHaveBeenCalledWith(
            expect.objectContaining({ schema: mockSchema }),
            mockWss,
        );
    });

    it('should provide default empty context when no context function is given', async () => {
        const mockSchema = { kind: 'Document' } as any;
        const mockWss = {} as any;
        const result = initGraphQLWS({ schema: mockSchema, server: mockWss }) as any;
        const ctx = { extra: { request: { url: '/test' } } };
        const resolved = await result.context(ctx);
        expect(resolved).toHaveProperty('req', ctx.extra.request);
    });

    it('should call custom context function', async () => {
        const customContext = vi.fn().mockResolvedValue({ userId: '123' });
        const mockSchema = { kind: 'Document' } as any;
        const mockWss = {} as any;
        const result = initGraphQLWS({ schema: mockSchema, server: mockWss, context: customContext }) as any;
        const ctx = { extra: { request: { url: '/test', session: {}, user: null } } };
        const resolved = await result.context(ctx);
        expect(customContext).toHaveBeenCalledWith(ctx.extra.request);
        expect(resolved).toHaveProperty('userId', '123');
    });

    it('should call onConnect callback when provided', async () => {
        const onConnect = vi.fn().mockResolvedValue(undefined);
        const mockSchema = { kind: 'Document' } as any;
        const mockWss = {} as any;
        const result = initGraphQLWS({ schema: mockSchema, server: mockWss, onConnect }) as any;
        const ctx = { extra: { request: { url: '/test' } } };
        await result.onConnect(ctx);
        expect(onConnect).toHaveBeenCalledWith(ctx.extra.request);
    });

    it('should not throw when onConnect is not provided', async () => {
        const mockSchema = { kind: 'Document' } as any;
        const mockWss = {} as any;
        const result = initGraphQLWS({ schema: mockSchema, server: mockWss }) as any;
        const ctx = { extra: { request: {} } };
        await expect(result.onConnect(ctx)).resolves.toBeUndefined();
    });
});
