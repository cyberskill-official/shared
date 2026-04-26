import { describe, expect, it, vi } from 'vitest';

import { command, createGitHooksConfig } from './path.constant.js';
import { join, resolve } from './path.util.js';

vi.mock('../package/index.js', () => ({
    setupPackages: vi.fn().mockResolvedValue(undefined),
    E_PackageType: { DEPENDENCY: 'dependencies', DEV_DEPENDENCY: 'devDependencies', PEER_DEPENDENCY: 'peerDependencies', BUNDLE_DEPENDENCY: 'bundleDependencies', OPTIONAL_DEPENDENCY: 'optionalDependencies' },
}));

const RE_PATH_JOIN = /a[/\\]b/;

describe('path', () => {
    describe('resolve', () => {
        it('should resolve paths', () => {
            const result = resolve('a', 'b');
            expect(result).toContain('a');
            expect(result).toContain('b');
        });
    });

    describe('join', () => {
        it('should join paths', () => {
            const result = join('a', 'b');
            expect(result).toMatch(RE_PATH_JOIN);
        });
    });
});

describe('createGitHooksConfig', () => {
    it('should include pre-push with git pull for current project', () => {
        const config = createGitHooksConfig();
        expect(config['pre-commit']).toBeDefined();
        expect(config['commit-msg']).toBeDefined();
        expect(config['pre-push']).toHaveProperty('cmd');
        expect((config['pre-push'] as { cmd: string }).cmd).toContain('git pull');
    });

    it('should include pre-push with pnpm test', () => {
        const config = createGitHooksConfig();
        expect((config['pre-push'] as { cmd: string }).cmd).toContain('pnpm run --if-present test');
    });

    it('should chain git pull and pnpm test with &&', () => {
        const config = createGitHooksConfig();
        expect((config['pre-push'] as { cmd: string }).cmd).toContain('git pull && pnpm run --if-present test');
    });
});

describe('command', () => {
    describe('mongoMigrateCreate', () => {
        it('should allow valid migration names', async () => {
            const result = await command.mongoMigrateCreate('valid_name-123');
            expect(result).toContain('valid_name-123');
        });

        it('should throw error for invalid migration names', async () => {
            expect(() => command.mongoMigrateCreate('invalid; name')).toThrow('Migration name must only contain alphanumeric characters, underscores, and hyphens.');
        });
    });

    describe('string commands', () => {
        it('should resolve configureGitHook (STRING type)', async () => {
            const result = await command.configureGitHook();
            expect(result).toContain('git');
            expect(result).toContain('config');
        });

        it('should resolve build command', async () => {
            const result = await command.build();
            expect(result).toContain('build');
        });

        it('should resolve pnpmInstallStandard', async () => {
            const result = await command.pnpmInstallStandard();
            expect(result).toContain('install');
        });
    });

    describe('CLI commands', () => {
        it('should resolve eslintCheck', async () => {
            const result = await command.eslintCheck();
            expect(result).toContain('eslint');
        });

        it('should resolve typescriptCheck', async () => {
            const result = await command.typescriptCheck();
            expect(result).toContain('tsc');
        });

        it('should resolve commitLint', async () => {
            const result = await command.commitLint();
            expect(result).toContain('commitlint');
        });
    });
});
