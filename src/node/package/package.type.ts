export interface I_PackageJson {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
}

export interface I_PackageInfo {
    name: string;
    currentVersion: string;
    latestVersion: string;
    isCurrentProject: boolean;
    isInstalled: boolean;
    isUpToDate: boolean;
    isDependency: boolean;
    isDevDependency: boolean;
    installedPath: string;
    file: I_PackageJson;
}

export enum E_PackageType {
    DEPENDENCY = 'dependencies',
    DEV_DEPENDENCY = 'devDependencies',
    PEER_DEPENDENCY = 'peerDependencies',
    BUNDLE_DEPENDENCY = 'bundleDependencies',
    OPTIONAL_DEPENDENCY = 'optionalDependencies',
}

export interface I_PackageInput {
    name: string;
    type?: E_PackageType;
}
