/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    setupPackages,
    runCommand,
    clearAllErrorLists,
    getStoredErrorLists,
    typescriptCheck,
    eslintCheck,
    eslintFix,
    pathExistsSync,
} = vi.hoisted(() => ({
    setupPackages: vi.fn().mockResolvedValue(undefined),
    runCommand: vi.fn().mockResolvedValue(undefined),
    clearAllErrorLists: vi.fn().mockResolvedValue(undefined),
    getStoredErrorLists: vi.fn().mockResolvedValue([]),
    typescriptCheck: vi.fn().mockResolvedValue('tsc --noEmit'),
    eslintCheck: vi.fn().mockResolvedValue('eslint .'),
    eslintFix: vi.fn().mockResolvedValue('eslint . --fix'),
    pathExistsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('../package/index.js', () => ({
    setupPackages,
    E_PackageType: {
        DEPENDENCY: 'dependencies',
        DEV_DEPENDENCY: 'devDependencies',
    },
}));

vi.mock('../command/index.js', () => ({
    runCommand,
    clearAllErrorLists,
    getStoredErrorLists,
}));

vi.mock('../fs/index.js', () => ({
    pathExistsSync,
}));

vi.mock('../log/index.js', () => ({
    catchError: vi.fn(),
    E_IssueType: { Error: 'error', Warning: 'warning' },
    log: {
        warn: vi.fn(),
        printBoxedLog: vi.fn(),
    },
}));

vi.mock('../path/index.js', () => ({
    command: {
        typescriptCheck,
        eslintCheck,
        eslintFix,
    },
    ESLINT_PACKAGE_NAME: 'eslint',
    TSC_PACKAGE_NAME: 'typescript',
    PATH: { TS_CONFIG: '/test/tsconfig.json' },
}));

describe('cli lint orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupPackages.mockResolvedValue(undefined);
        runCommand.mockResolvedValue(undefined);
        clearAllErrorLists.mockResolvedValue(undefined);
        getStoredErrorLists.mockResolvedValue([]);
        typescriptCheck.mockResolvedValue('tsc --noEmit');
        eslintCheck.mockResolvedValue('eslint .');
        eslintFix.mockResolvedValue('eslint . --fix');
        pathExistsSync.mockReturnValue(true);
    });

    it('lintCheck sets up once then runs typecheck before ESLint sequentially', async () => {
        const { lintCheck } = await import('./cli.lint.js');
        const order: string[] = [];

        setupPackages.mockImplementation(async () => {
            order.push('setup');
        });
        typescriptCheck.mockImplementation(async () => {
            order.push('typescriptCheck');
            return 'tsc --noEmit';
        });
        eslintCheck.mockImplementation(async () => {
            order.push('eslintCheck');
            return 'eslint .';
        });
        runCommand.mockImplementation(async (label: string) => {
            order.push(`run:${label}`);
        });

        await lintCheck();

        expect(setupPackages).toHaveBeenCalledTimes(1);
        expect(typescriptCheck).toHaveBeenCalledWith({ setup: false });
        expect(eslintCheck).toHaveBeenCalledWith({ setup: false });
        expect(eslintFix).not.toHaveBeenCalled();
        expect(order).toEqual([
            'setup',
            'typescriptCheck',
            'run:Performing TypeScript validation',
            'eslintCheck',
            'run:Running ESLint check',
        ]);
    });

    it('lintFix sets up once then runs ESLint fix before typecheck sequentially', async () => {
        const { lintFix } = await import('./cli.lint.js');
        const order: string[] = [];

        setupPackages.mockImplementation(async () => {
            order.push('setup');
        });
        eslintFix.mockImplementation(async () => {
            order.push('eslintFix');
            return 'eslint . --fix';
        });
        typescriptCheck.mockImplementation(async () => {
            order.push('typescriptCheck');
            return 'tsc --noEmit';
        });
        runCommand.mockImplementation(async (label: string) => {
            order.push(`run:${label}`);
        });

        await lintFix();

        expect(setupPackages).toHaveBeenCalledTimes(1);
        expect(eslintFix).toHaveBeenCalledWith({ setup: false });
        expect(eslintCheck).not.toHaveBeenCalled();
        expect(typescriptCheck).toHaveBeenCalledWith({ setup: false });
        expect(order).toEqual([
            'setup',
            'eslintFix',
            'run:Running ESLint with auto-fix',
            'typescriptCheck',
            'run:Performing TypeScript validation',
        ]);
    });
});
