/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import { createGraphqlCodegenConfig } from './graphql-codegen.util.js';

vi.mock('@dotenvx/dotenvx', () => ({
    default: { config: vi.fn() },
}));

vi.mock('@eddeee888/gcg-typescript-resolver-files', () => ({
    defineConfig: vi.fn(() => ({ resolverTypesConfig: true })),
}));

describe('createGraphqlCodegenConfig', () => {
    const baseOptions = {
        uri: 'http://localhost:4000/graphql',
        from: 'src/**/*.graphql',
        to: 'src/generated/',
        target: 'client' as const,
    };

    describe('client target', () => {
        it('should set schema to provided uri', () => {
            const config = createGraphqlCodegenConfig(baseOptions);
            expect(config.schema).toBe(baseOptions.uri);
        });

        it('should include documents from source', () => {
            const config = createGraphqlCodegenConfig(baseOptions);
            expect(config.documents).toContain(baseOptions.from);
        });

        it('should set ignoreNoDocuments to true', () => {
            const config = createGraphqlCodegenConfig(baseOptions);
            expect(config.ignoreNoDocuments).toBe(true);
        });

        it('should set overwrite to true', () => {
            const config = createGraphqlCodegenConfig(baseOptions);
            expect(config.overwrite).toBe(true);
        });

        it('should use client preset with correct config', () => {
            const config = createGraphqlCodegenConfig(baseOptions);
            const generates = config.generates[baseOptions.to] as any;

            expect(generates.preset).toBe('client');
            expect(generates.presetConfig.fragmentMasking).toBe(false);
            expect(generates.presetConfig.persistedDocuments).toBe(true);
        });

        it('should configure useTypeImports and namingConvention', () => {
            const config = createGraphqlCodegenConfig(baseOptions);
            const generates = config.generates[baseOptions.to] as any;

            expect(generates.config.useTypeImports).toBe(true);
            expect(generates.config.namingConvention).toBe('keep');
        });
    });

    describe('server target', () => {
        it('should not include documents', () => {
            const config = createGraphqlCodegenConfig({ ...baseOptions, target: 'server' });
            expect(config.documents).toBeUndefined();
        });

        it('should use defineConfig for server generates', () => {
            const config = createGraphqlCodegenConfig({ ...baseOptions, target: 'server' });
            const generates = config.generates[baseOptions.to] as any;

            expect(generates).toEqual({ resolverTypesConfig: true });
        });

        it('should not include client preset config', () => {
            const config = createGraphqlCodegenConfig({ ...baseOptions, target: 'server' });
            const generates = config.generates[baseOptions.to] as any;

            expect(generates.preset).toBeUndefined();
        });
    });

    describe('default target', () => {
        it('should default to client target', () => {
            const config = createGraphqlCodegenConfig({
                uri: baseOptions.uri,
                from: baseOptions.from,
                to: baseOptions.to,
            });

            expect(config.documents).toContain(baseOptions.from);
        });
    });
});
