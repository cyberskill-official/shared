import type { CodegenConfig } from '@graphql-codegen/cli';

import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files';

import type { I_GraphqlCodegenConfig } from './graphql-codegen.type.js';

import { loadEnvFile } from '../env/env.util.js';

loadEnvFile();

/**
 * Creates a GraphQL Code Generator configuration for client or server code generation.
 * This function generates a complete GraphQL Code Generator configuration based on
 * the specified target (client or server) with appropriate presets and settings.
 *
 * For client targets, it configures:
 * - Client preset with fragment masking disabled
 * - Persisted documents support
 * - Type imports and naming convention settings
 * - Document processing from specified source
 *
 * For server targets, it configures:
 * - TypeScript resolver files generation
 * - Server-side GraphQL type definitions
 * - Resolver function generation
 *
 * @param options - Configuration object containing uri, from, to, and target properties.
 * @param options.uri - The GraphQL schema URI to generate types from.
 * @param options.from - The source path for GraphQL documents (used for client generation).
 * @param options.to - The output path for generated files.
 * @param options.target - The generation target ('client' for frontend, 'server' for backend).
 * @returns A complete GraphQL Code Generator configuration object.
 */
export function createGraphqlCodegenConfig({
    uri,
    from,
    to,
    target = 'client',
}: I_GraphqlCodegenConfig): CodegenConfig {
    const isClient = target === 'client';
    const isServer = target === 'server';

    return {
        schema: uri,
        ignoreNoDocuments: true,
        overwrite: true,
        ...(isClient && { documents: [from] }),
        generates: {
            ...(isClient && {
                [to]: {
                    preset: 'client',
                    presetConfig: {
                        fragmentMasking: false,
                        persistedDocuments: true,
                    },
                    config: {
                        useTypeImports: true,
                        namingConvention: 'keep',
                    },
                },
            }),
            ...(isServer && {
                [to]: defineConfig(),
            }),
        },
    };
}
