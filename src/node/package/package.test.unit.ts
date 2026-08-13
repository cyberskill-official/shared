import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pathExistsSync, readJsonSync } from '../fs/index.js';
import { E_PackageType } from './package.type.js';
import { getLatestPackageVersion, getPackage, installDependencies, setupPackages, updatePackage } from './package.util.js';

vi.mock('#config/env/index.js', () => ({
    getEnv: () => ({ CWD: '/test-cwd', DEBUG: false }),
}));

vi.mock('../log/index.js', () => ({
    catchError: vi.fn((_err: unknown, opts?: { returnValue?: unknown }) => opts?.returnValue ?? { success: false, message: 'error', code: 500 }),
    log: {
        silent: vi.fn(),
        level: 4,
        fatal: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        ready: vi.fn(),
        start: vi.fn(),
        box: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        verbose: vi.fn(),
        printBoxedLog: vi.fn(),
    },
}));

vi.mock('../command/index.js', () => ({
    runCommand: vi.fn(),
}));

vi.mock('../fs/index.js', () => ({
    pathExistsSync: vi.fn().mockReturnValue(true),
    readJsonSync: vi.fn().mockReturnValue({ name: 'test-project', version: '1.0.0', dependencies: {}, devDependencies: {} }),
    writeFileSync: vi.fn(),
}));

vi.mock('../path/index.js', () => ({
    command: {
        pnpmInstallStandard: vi.fn().mockResolvedValue('pnpm install'),
        pnpmInstallLegacy: vi.fn().mockResolvedValue('pnpm install --legacy-peer-deps'),
        pnpmInstallForce: vi.fn().mockResolvedValue('pnpm install --force'),
        eslintFix: vi.fn().mockResolvedValue('eslint --fix'),
    },
    join: (...args: string[]) => args.join('/'),
    NODE_MODULES: 'node_modules',
    PACKAGE_JSON: 'package.json',
    PATH: { ROOT: '/root', PACKAGE_JSON: '/test-cwd/package.json' },
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pathExistsSync).mockReturnValue(true);
    vi.mocked(readJsonSync).mockReturnValue({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
    }));
});

describe('E_PackageType', () => {
    it('should have all expected package type values', () => {
        expect(E_PackageType.DEPENDENCY).toBe('dependencies');
        expect(E_PackageType.DEV_DEPENDENCY).toBe('devDependencies');
        expect(E_PackageType.PEER_DEPENDENCY).toBe('peerDependencies');
        expect(E_PackageType.BUNDLE_DEPENDENCY).toBe('bundleDependencies');
        expect(E_PackageType.OPTIONAL_DEPENDENCY).toBe('optionalDependencies');
    });

    it('should contain exactly 5 values', () => {
        const values = Object.values(E_PackageType);
        expect(values).toHaveLength(5);
    });
});

describe('getLatestPackageVersion', () => {
    it('should return latest version from npm registry', async () => {
        const result = await getLatestPackageVersion('test-package');
        expect(result.success).toBe(true);
    });

    it('should handle failed fetch', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
        const result = await getLatestPackageVersion('nonexistent');
        expect(result.success).toBe(false);
    });
});

describe('getPackage', () => {
    it('should return current project info when no input and package.json exists', async () => {
        const result = await getPackage();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isCurrentProject).toBe(true);
            expect(result.result.name).toBe('test-project');
        }
    });

    it('should return empty info when no input and no package.json', async () => {
        vi.mocked(pathExistsSync).mockReturnValue(false);
        const result = await getPackage();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isCurrentProject).toBe(false);
            expect(result.result.isInstalled).toBe(false);
        }
    });

    it('should return not-found info when package.json is missing with input', async () => {
        vi.mocked(pathExistsSync).mockReturnValue(false);
        const result = await getPackage({ name: 'some-package' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isInstalled).toBe(false);
        }
    });

    it('should detect current project by name match', async () => {
        const result = await getPackage({ name: 'test-project' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isCurrentProject).toBe(true);
        }
    });

    it('should detect package not in dependencies', async () => {
        const result = await getPackage({ name: 'unknown-package' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isInstalled).toBe(false);
        }
    });

    it('should detect package in dependencies but not installed', async () => {
        vi.mocked(readJsonSync).mockReturnValueOnce({
            name: 'test-project',
            version: '1.0.0',
            dependencies: { 'my-dep': '1.0.0' },
            devDependencies: {},
        });
        vi.mocked(pathExistsSync)
            .mockReturnValueOnce(true) // PACKAGE_JSON exists
            .mockReturnValueOnce(false); // node_modules/my-dep/package.json missing
        const result = await getPackage({ name: 'my-dep' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isInstalled).toBe(false);
        }
    });

    it('should detect version mismatch between package.json and node_modules', async () => {
        vi.mocked(readJsonSync)
            .mockReturnValueOnce({
                name: 'test-project',
                version: '1.0.0',
                dependencies: { 'my-dep': '2.0.0' },
                devDependencies: {},
            })
            .mockReturnValueOnce({ version: '1.5.0' }); // node_modules version
        const result = await getPackage({ name: 'my-dep' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isInstalled).toBe(true);
            expect(result.result.isUpToDate).toBe(false);
        }
    });

    it('should detect up-to-date package', async () => {
        vi.mocked(readJsonSync)
            .mockReturnValueOnce({
                name: 'test-project',
                version: '1.0.0',
                dependencies: { 'my-dep': '2.0.0' },
                devDependencies: {},
            })
            .mockReturnValueOnce({ version: '2.0.0' }); // same version
        const result = await getPackage({ name: 'my-dep' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.isInstalled).toBe(true);
        }
    });

    it('should handle devDependency type', async () => {
        vi.mocked(readJsonSync).mockReturnValueOnce({
            name: 'test-project',
            version: '1.0.0',
            dependencies: {},
            devDependencies: { 'dev-dep': '1.0.0' },
        });
        const result = await getPackage({ name: 'dev-dep', type: E_PackageType.DEV_DEPENDENCY });
        expect(result.success).toBe(true);
    });

    it('should handle failed latest version fetch', async () => {
        vi.mocked(pathExistsSync).mockImplementation((pathStr: unknown) => {
            const path = String(pathStr);
            return path.includes('package.json');
        });
        vi.mocked(readJsonSync).mockImplementation((pathStr: unknown) => {
            if (String(pathStr).includes('node_modules')) {
                return { name: 'my-dep', version: '1.0.0' };
            }
            return {
                name: 'test-project',
                version: '1.0.0',
                dependencies: { 'my-dep': '1.0.0' },
                devDependencies: {},
            };
        });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
        const result = await getPackage({ name: 'my-dep' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.currentVersion).toBe('1.0.0');
            expect(result.result.latestVersion).toBe('1.0.0');
            expect(result.result.isInstalled).toBe(true);
            expect(result.result.isUpToDate).toBe(true);
        }
    });

    it('should preserve manifest version when registry fails and package is not on disk', async () => {
        vi.mocked(pathExistsSync).mockImplementation((pathStr: unknown) => String(pathStr).includes('test-cwd/package.json'));
        vi.mocked(readJsonSync).mockReturnValue({
            name: 'test-project',
            version: '1.0.0',
            dependencies: {},
            devDependencies: { eslint: '9.0.0' },
        });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

        const result = await getPackage({ name: 'eslint', type: E_PackageType.DEV_DEPENDENCY });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result.latestVersion).toBe('9.0.0');
            expect(result.result.currentVersion).toBe('9.0.0');
            expect(result.result.isInstalled).toBe(false);
            expect(result.result.isUpToDate).toBe(true);
            expect(result.result.isDevDependency).toBe(true);
        }
    });

    it('should install from preserved manifest version when registry fails and package is absent on disk', async () => {
        let packageJson: Record<string, any> = {
            name: 'consumer-app',
            version: '1.0.0',
            dependencies: {},
            devDependencies: { eslint: '9.1.0' },
        };

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('registry down')));
        vi.mocked(pathExistsSync).mockImplementation((pathStr: unknown) => String(pathStr).includes('test-cwd/package.json'));
        vi.mocked(readJsonSync).mockImplementation(() => packageJson);

        const { writeFileSync: wfs } = await import('../fs/index.js');
        const { runCommand } = await import('../command/index.js');
        vi.mocked(wfs).mockImplementation((_path: unknown, contents: unknown) => {
            packageJson = JSON.parse(String(contents));
        });

        const pkg = await getPackage({ name: 'eslint', type: E_PackageType.DEV_DEPENDENCY });
        expect(pkg.success).toBe(true);
        if (pkg.success) {
            expect(pkg.result.latestVersion).toBe('9.1.0');
            expect(pkg.result.isInstalled).toBe(false);
        }

        await setupPackages([{ name: 'eslint', type: E_PackageType.DEV_DEPENDENCY }], { install: true });

        expect(packageJson['devDependencies'].eslint).toBe('9.1.0');
        expect(String(packageJson['devDependencies'].eslint).trim().length).toBeGreaterThan(0);
        expect(runCommand).toHaveBeenCalledWith(
            expect.stringContaining('Installing dependencies'),
            expect.any(String),
        );
    });
    it('should catch errors if internal logic throws', async () => {
        const { catchError } = await import('../log/index.js');
        const customError = new Error('simulated getPackage exception');
        vi.mocked(pathExistsSync).mockImplementation(() => {
            throw customError;
        });

        await getPackage({ name: 'my-dep' });

        expect(catchError).toHaveBeenCalledWith(customError);
    });
});

describe('updatePackage', () => {
    it('should update dependency version in package.json', async () => {
        await updatePackage({
            name: 'my-dep',
            latestVersion: '3.0.0',
            isDependency: true,
            isDevDependency: false,
            currentVersion: '1.0.0',
            isCurrentProject: false,
            isInstalled: true,
            isUpToDate: false,
            installedPath: '',
            file: {},
        } as any);
        const { writeFileSync: wfs } = await import('../fs/index.js');
        expect(wfs).toHaveBeenCalled();
    });

    it('should update devDependency version', async () => {
        await updatePackage({
            name: 'my-dev-dep',
            latestVersion: '3.0.0',
            isDependency: false,
            isDevDependency: true,
            currentVersion: '1.0.0',
            isCurrentProject: false,
            isInstalled: true,
            isUpToDate: false,
            installedPath: '',
            file: {},
        } as any);
        const { writeFileSync: wfs } = await import('../fs/index.js');
        expect(wfs).toHaveBeenCalled();
    });
    it('should catch errors when internal logic throws', async () => {
        const { writeFileSync: wfs } = await import('../fs/index.js');
        const customError = new Error('simulated update throw');
        vi.mocked(wfs).mockImplementationOnce(() => {
            throw customError;
        });
        const { catchError } = await import('../log/index.js');

        await updatePackage({
            name: 'my-dep',
            latestVersion: '3.0.0',
            isDependency: true,
            isDevDependency: false,
            currentVersion: '1.0.0',
            isCurrentProject: false,
            isInstalled: true,
            isUpToDate: false,
            installedPath: '',
            file: {},
        } as any);

        expect(catchError).toHaveBeenCalledWith(customError);
    });

    it('should skip writing when latestVersion is empty', async () => {
        const { writeFileSync: wfs } = await import('../fs/index.js');
        const { log } = await import('../log/index.js');

        await updatePackage({
            name: 'eslint',
            latestVersion: '',
            isDependency: false,
            isDevDependency: true,
            currentVersion: '9.0.0',
            isCurrentProject: false,
            isInstalled: true,
            isUpToDate: false,
            installedPath: '',
            file: {},
        } as any);

        expect(wfs).not.toHaveBeenCalled();
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('no valid latestVersion'));
    });
});

describe('installDependencies', () => {
    it('should attempt standard install first', async () => {
        await installDependencies();
        const { runCommand } = await import('../command/index.js');
        expect(runCommand).toHaveBeenCalled();
    });
    it('should fallback to legacy and force install on failures', async () => {
        const { runCommand } = await import('../command/index.js');
        const { catchError } = await import('../log/index.js');

        const error1 = new Error('std command failed');
        const error2 = new Error('legacy command failed');
        const error3 = new Error('force command failed');

        vi.mocked(runCommand)
            .mockRejectedValueOnce(error1)
            .mockRejectedValueOnce(error2)
            .mockRejectedValueOnce(error3);

        await installDependencies();

        expect(runCommand).toHaveBeenCalledTimes(3);
        expect(catchError).toHaveBeenCalledWith(error1);
        expect(catchError).toHaveBeenCalledWith(error2);
        expect(catchError).toHaveBeenCalledWith(error3);
    });

    it('should trigger outer catch block if an inner catch throws', async () => {
        const { catchError } = await import('../log/index.js');
        const { runCommand } = await import('../command/index.js');

        vi.mocked(runCommand).mockRejectedValueOnce(new Error('fail std'));
        const outerError = new Error('catchError itself failed');
        vi.mocked(catchError).mockImplementationOnce(() => {
            throw outerError;
        });

        await installDependencies();

        expect(catchError).toHaveBeenCalledWith(outerError);
    });
});

describe('setupPackages', () => {
    it('should abort when no package.json exists', async () => {
        vi.mocked(pathExistsSync).mockReturnValue(false);
        await setupPackages([{ name: 'test' }]);
        const { log } = await import('../log/index.js');
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('package.json not found'));
    });

    it('should handle empty packages array', async () => {
        await setupPackages([]);
        // Should complete without error
    });

    it('should execute install dependencies and run ESLint if tasks exist', async () => {
        // mock node_modules pathExistsSync = false to flag isInstalled = false
        vi.mocked(pathExistsSync).mockImplementation((pathStr: any) => String(pathStr).includes('test-cwd/package.json'));
        vi.mocked(readJsonSync).mockReturnValue({
            name: 'test-project',
            version: '1.0.0',
            dependencies: { 'my-dep': '1.0.0' },
        });

        const { runCommand } = await import('../command/index.js');

        await setupPackages([{ name: 'my-dep' }], { install: true });

        expect(runCommand).toHaveBeenCalledWith(
            'Running ESLint with auto-fix',
            'eslint --fix',
        );
    });

    it('should update packages if requested', async () => {
        // mock node_modules/package.json version to differ from root package.json -> isUpToDate = false
        vi.mocked(pathExistsSync).mockReturnValue(true);
        vi.mocked(readJsonSync).mockImplementation((pathStr: any) => {
            if (String(pathStr).includes('node_modules')) {
                return { version: '1.5.0' }; // installed version
            }
            return {
                name: 'test-project',
                version: '1.0.0',
                dependencies: { 'my-dep': '2.0.0' }, // requested version
            };
        });

        const { writeFileSync: wfs } = await import('../fs/index.js');

        await setupPackages([{ name: 'my-dep' }], { update: true });

        expect(wfs).toHaveBeenCalled();
    });

    it('should catch errors if internal logic throws', async () => {
        const { catchError } = await import('../log/index.js');
        const customError = new Error('simulated exception');
        vi.mocked(pathExistsSync).mockImplementation(() => {
            throw customError;
        });

        await setupPackages([{ name: 'some-dep' }]);

        expect(catchError).toHaveBeenCalledWith(customError);
    });

    it('should keep installed lint tool versions when registry fails for on-disk packages', async () => {
        let packageJson: Record<string, any> = {
            name: 'consumer-app',
            version: '1.0.0',
            dependencies: {},
            devDependencies: {
                eslint: '9.1.0',
                typescript: '5.4.0',
            },
        };

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('registry down')));
        vi.mocked(pathExistsSync).mockReturnValue(true);
        vi.mocked(readJsonSync).mockImplementation((pathStr: unknown) => {
            if (String(pathStr).includes('node_modules/eslint')) {
                return { name: 'eslint', version: '9.1.0' };
            }
            if (String(pathStr).includes('node_modules/typescript')) {
                return { name: 'typescript', version: '5.4.0' };
            }
            return packageJson;
        });

        const { writeFileSync: wfs } = await import('../fs/index.js');
        vi.mocked(wfs).mockImplementation((_path: unknown, contents: unknown) => {
            packageJson = JSON.parse(String(contents));
        });

        await setupPackages(
            [
                { name: 'eslint', type: E_PackageType.DEV_DEPENDENCY },
                { name: 'typescript', type: E_PackageType.DEV_DEPENDENCY },
            ],
            { install: true },
        );

        expect(packageJson['devDependencies'].eslint).toBe('9.1.0');
        expect(packageJson['devDependencies'].typescript).toBe('5.4.0');
        expect(wfs).not.toHaveBeenCalled();
    });

    it('should write packages sequentially so later updates see earlier package.json changes', async () => {
        const writeSnapshots: string[][] = [];
        let packageJson: Record<string, any> = {
            name: 'consumer-app',
            version: '1.0.0',
            dependencies: {},
            devDependencies: {},
        };

        vi.mocked(pathExistsSync).mockImplementation((pathStr: unknown) => String(pathStr).includes('test-cwd/package.json'));
        vi.mocked(readJsonSync).mockImplementation(() => structuredClone(packageJson));
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ version: '9.2.0' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ version: '5.5.0' }) }));

        const { writeFileSync: wfs } = await import('../fs/index.js');
        vi.mocked(wfs).mockImplementation((_path: unknown, contents: unknown) => {
            const parsed = JSON.parse(String(contents));
            packageJson = parsed;
            writeSnapshots.push(Object.keys(parsed.devDependencies ?? {}));
        });

        await setupPackages(
            [
                { name: 'eslint', type: E_PackageType.DEV_DEPENDENCY },
                { name: 'typescript', type: E_PackageType.DEV_DEPENDENCY },
            ],
            { install: true },
        );

        // Sequential updates: first snapshot has only eslint; second has both.
        // This fails if writes are fired concurrently from a shared stale read.
        expect(writeSnapshots).toEqual([
            ['eslint'],
            ['eslint', 'typescript'],
        ]);
        expect(packageJson['devDependencies'].eslint).toBe('9.2.0');
        expect(packageJson['devDependencies'].typescript).toBe('5.5.0');
    });
});
