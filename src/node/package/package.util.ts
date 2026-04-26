import type { I_Return } from '#typescript/index.js';

import { getEnv } from '#config/env/index.js';

import type { I_PackageInfo, I_PackageInput, I_PackageJson } from './package.type.js';

import { runCommand } from '../command/index.js';
import { pathExistsSync, readJsonSync, writeFileSync } from '../fs/index.js';
import { catchError, log } from '../log/index.js';
import { command, join, NODE_MODULES, PACKAGE_JSON, PATH } from '../path/index.js';
import { E_PackageType } from './package.type.js';

const env = getEnv();

/**
 * Fetches the latest version of a package from the npm registry.
 * This function makes an HTTP request to the npm registry to get the latest version
 * information for a specified package.
 *
 * @param packageName - The name of the package to fetch the latest version for.
 * @returns A promise that resolves to a standardized response with the latest version string.
 */
export async function getLatestPackageVersion(packageName: string): Promise<I_Return<string>> {
    try {
        const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`);

        if (!res.ok) {
            throw new Error(`Failed to fetch latest version: ${res.status} ${res.statusText}`);
        }

        const { version } = await res.json() as { version: string };

        return {
            success: true,
            result: version,
        };
    }
    catch (error: unknown) {
        return catchError<string>(error);
    }
}

/**
 * Retrieves comprehensive information about a package.
 * This function analyzes package information including:
 * - Current and latest versions
 * - Installation status and location
 * - Dependency type (regular, dev, peer, etc.)
 * - Whether it's the current project or an external dependency
 *
 * @param inputPackage - Optional package input configuration. If not provided, returns current project info.
 * @returns A promise that resolves to a standardized response with detailed package information.
 */
export async function getPackage(inputPackage?: I_PackageInput): Promise<I_Return<I_PackageInfo>> {
    try {
        if (!inputPackage) {
            if (pathExistsSync(PATH.PACKAGE_JSON)) {
                const packageJson = readJsonSync(PATH.PACKAGE_JSON) as I_PackageJson;
                const { name = '', version = '' } = packageJson;

                return {
                    success: true,
                    result: {
                        name,
                        currentVersion: version,
                        latestVersion: version,
                        isCurrentProject: true,
                        isInstalled: true,
                        isUpToDate: true,
                        isDependency: false,
                        isDevDependency: false,
                        installedPath: PATH.PACKAGE_JSON,
                        file: packageJson,
                    },
                };
            }
            return {
                success: true,
                result: {
                    name: '',
                    currentVersion: '',
                    latestVersion: '',
                    isCurrentProject: false,
                    isInstalled: false,
                    isUpToDate: false,
                    isDependency: false,
                    isDevDependency: false,
                    installedPath: '',
                    file: {},
                },
            };
        }

        // if package.json does not exist
        if (!pathExistsSync(PATH.PACKAGE_JSON)) {
            return {
                success: true,
                result: {
                    name: inputPackage.name,
                    currentVersion: '',
                    latestVersion: '',
                    isCurrentProject: false,
                    isInstalled: false,
                    isUpToDate: false,
                    isDependency: inputPackage.type === E_PackageType.DEPENDENCY,
                    isDevDependency: inputPackage.type === E_PackageType.DEV_DEPENDENCY,
                    installedPath: '',
                    file: {},
                },
            };
        }

        const packageJson = readJsonSync(PATH.PACKAGE_JSON) as I_PackageJson;

        const { name, version = '', dependencies = {}, devDependencies = {} } = packageJson;

        // if it's the current project
        if (inputPackage.name === name) {
            return {
                success: true,
                result: {
                    name,
                    currentVersion: version,
                    latestVersion: version,
                    isCurrentProject: true,
                    isInstalled: true,
                    isUpToDate: true,
                    isDependency: inputPackage.type === E_PackageType.DEPENDENCY,
                    isDevDependency: inputPackage.type === E_PackageType.DEV_DEPENDENCY,
                    installedPath: PATH.PACKAGE_JSON,
                    file: packageJson,
                },
            };
        }

        const isDependency = inputPackage.name in dependencies;

        const isDevDependency = inputPackage.name in devDependencies;

        const latestVersionFound = await getLatestPackageVersion(inputPackage.name);

        if (!latestVersionFound.success) {
            return {
                success: true,
                result: {
                    name: inputPackage.name,
                    currentVersion: '',
                    latestVersion: '',
                    isCurrentProject: false,
                    isInstalled: false,
                    isUpToDate: false,
                    isDependency,
                    isDevDependency,
                    installedPath: '',
                    file: {},
                },
            };
        }

        // if it's not a dependency or devDependency
        if (!isDependency && !isDevDependency) {
            return {
                success: true,
                result: {
                    name: inputPackage.name,
                    currentVersion: '',
                    latestVersion: latestVersionFound.result,
                    isCurrentProject: false,
                    isInstalled: false,
                    isUpToDate: false,
                    isDependency: inputPackage.type === E_PackageType.DEPENDENCY,
                    isDevDependency: inputPackage.type === E_PackageType.DEV_DEPENDENCY,
                    installedPath: '',
                    file: {},
                },
            };
        }

        const packageJsonVersion = dependencies[inputPackage.name] ?? devDependencies[inputPackage.name] ?? '';
        const dependencyPackageJsonPath = join(env.CWD, NODE_MODULES, inputPackage.name, PACKAGE_JSON);

        // if package does not exist in node_modules
        if (!pathExistsSync(dependencyPackageJsonPath)) {
            return {
                success: true,
                result: {
                    name: inputPackage.name,
                    currentVersion: '',
                    latestVersion: latestVersionFound.result,
                    isCurrentProject: false,
                    isInstalled: false,
                    isUpToDate: false,
                    isDependency,
                    isDevDependency,
                    installedPath: '',
                    file: {},
                },
            };
        }

        const dependencyPackageJson = readJsonSync(dependencyPackageJsonPath) as I_PackageJson;

        const { version: dependencyVersion = '' } = dependencyPackageJson;

        // if version in package.json is different from version in node_modules
        if (packageJsonVersion !== dependencyVersion) {
            return {
                success: true,
                result: {
                    name: inputPackage.name,
                    currentVersion: dependencyVersion || packageJsonVersion,
                    latestVersion: latestVersionFound.result,
                    isCurrentProject: false,
                    isInstalled: true,
                    isUpToDate: false,
                    isDependency,
                    isDevDependency,
                    installedPath: dependencyPackageJsonPath,
                    file: dependencyPackageJson,
                },
            };
        }

        // if version in package.json is the same as version in node_modules
        return {
            success: true,
            result: {
                name: inputPackage.name,
                currentVersion: packageJsonVersion,
                latestVersion: latestVersionFound.result,
                isCurrentProject: false,
                isInstalled: true,
                isUpToDate: packageJsonVersion === latestVersionFound.result,
                isDependency,
                isDevDependency,
                installedPath: dependencyPackageJsonPath,
                file: dependencyPackageJson,
            },
        };
    }
    catch (error: unknown) {
        return catchError<I_PackageInfo>(error);
    }
}

/**
 * Updates a package to its latest version in package.json.
 * This function modifies the package.json file to update the specified package
 * to its latest version and logs the update action.
 *
 * @param packageInfo - The package information containing the latest version to update to.
 * @returns A promise that resolves when the update is complete.
 */
export async function updatePackage(packageInfo: I_PackageInfo): Promise<void> {
    try {
        const packageJson = readJsonSync(PATH.PACKAGE_JSON) as I_PackageJson;

        const dependencies = packageJson.dependencies ?? {};
        const devDependencies = packageJson.devDependencies ?? {};

        if (packageInfo.isDependency) {
            dependencies[packageInfo.name] = packageInfo.latestVersion;
        }
        else if (packageInfo.isDevDependency) {
            devDependencies[packageInfo.name] = packageInfo.latestVersion;
        }

        writeFileSync(PATH.PACKAGE_JSON, JSON.stringify(packageJson, null, 4));

        log.info(`Updated "${packageInfo.name}" to version ${packageInfo.latestVersion}`);
    }
    catch (error: unknown) {
        catchError(error);
    }
}

/**
 * Installs project dependencies using pnpm with fallback strategies.
 * This function attempts to install dependencies using different pnpm strategies:
 * 1. Standard installation
 * 2. Legacy peer dependencies mode
 * 3. Force installation mode
 *
 * @returns A promise that resolves when the installation is complete.
 */
export async function installDependencies(): Promise<void> {
    try {
        try {
            const cmd = await command.pnpmInstallStandard();
            await runCommand(`Installing dependencies (standard) using: ${cmd}`, cmd);
            return;
        }
        catch (error: unknown) {
            catchError(error);
        }

        try {
            const cmd = await command.pnpmInstallLegacy();
            await runCommand(`Retrying with legacy peer dependencies using: ${cmd}`, cmd);
            return;
        }
        catch (error: unknown) {
            catchError(error);
        }

        try {
            const cmd = await command.pnpmInstallForce();
            await runCommand(`Retrying with force install using: ${cmd}`, cmd);
        }
        catch (error: unknown) {
            catchError(error);
        }
    }
    catch (error: unknown) {
        catchError(error);
    }
}

/**
 * Sets up multiple packages with optional installation and update operations.
 * This function provides a comprehensive package management workflow that can:
 * - Install missing packages
 * - Update outdated packages
 * - Execute custom callbacks after package operations
 * - Run ESLint fixes after package changes
 *
 * @param packages - An array of package inputs to set up.
 * @param options - Optional configuration for installation, updates, and callbacks.
 * @param options.install - Whether to install missing packages (default: false).
 * @param options.update - Whether to update outdated packages (default: false).
 * @param options.callback - Optional callback function to execute after package operations.
 * @returns A promise that resolves when all package operations are complete.
 */
export async function setupPackages(
    packages: I_PackageInput[],
    options?: {
        install?: boolean;
        update?: boolean;
        callback?: () => Promise<void>;
    },
): Promise<void> {
    try {
        if (!pathExistsSync(PATH.PACKAGE_JSON)) {
            log.error('package.json not found. Aborting setup.');
            return;
        }

        const packagesData = await Promise.all(packages.map(getPackage));

        const validPackages = packagesData
            .filter((pkg): pkg is { success: true; result: I_PackageInfo } => pkg.success && Boolean(pkg.result) && !pkg.result.isCurrentProject)
            .map(pkg => pkg.result);

        const packagesToInstall = validPackages.filter(pkg => !pkg.isInstalled);
        const packagesToUpdate = validPackages.filter(pkg => !pkg.isUpToDate);

        const tasks: Promise<void>[] = [];

        if (options?.install && packagesToInstall.length > 0) {
            tasks.push(...packagesToInstall.map(updatePackage));
        }

        if (options?.update && packagesToUpdate.length > 0) {
            tasks.push(...packagesToUpdate.map(updatePackage));
        }

        if (tasks.length > 0) {
            await Promise.all(tasks);
            await installDependencies();
            await runCommand('Running ESLint with auto-fix', await command.eslintFix());
        }

        await options?.callback?.();
    }
    catch (error: unknown) {
        catchError(error);
    }
}
