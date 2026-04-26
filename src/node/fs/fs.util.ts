import fsExtra from 'fs-extra';
import path from 'node:path';

import type { I_CopySyncOptions } from './fs.type.js';

/**
 * Re-export of the fs-extra module for file system operations.
 */
export const fs = fsExtra;

export const {
    lstatSync,
    readdirSync,
    mkdirSync,
    readFileSync,
    unlinkSync,
    statSync,
    createWriteStream,
} = fsExtra;

export const readJsonSync: typeof fsExtra.readJsonSync = fsExtra.readJsonSync;

/**
 * Writes data to a file synchronously with UTF-8 encoding as default.
 * This function provides a simplified interface for writing files with automatic UTF-8 encoding
 * when no specific options are provided.
 *
 * @param file - The file path or file descriptor to write to.
 * @param data - The data to write to the file (string or Uint8Array).
 * @param options - Optional write file options (defaults to UTF-8 encoding).
 */
export function writeFileSync(file: fsExtra.PathOrFileDescriptor, data: string | Uint8Array, options?: fsExtra.WriteFileOptions): void {
    fsExtra.writeFileSync(file, data, options ?? 'utf-8');
}

/**
 * Appends data to a file synchronously with UTF-8 encoding as default.
 * This function provides a simplified interface for appending to files with automatic UTF-8 encoding
 * when no specific options are provided.
 *
 * @param path - The file path or file descriptor to append to.
 * @param data - The data to append to the file (string or Uint8Array).
 * @param options - Optional write file options (defaults to UTF-8 encoding).
 */
export function appendFileSync(path: fsExtra.PathOrFileDescriptor, data: string | Uint8Array, options?: fsExtra.WriteFileOptions): void {
    fsExtra.appendFileSync(path, data, options ?? 'utf-8');
}

/**
 * Checks if all specified paths exist synchronously.
 * This function verifies that every path in the provided array exists in the file system.
 * Returns true only if all paths exist, false if any path is missing.
 *
 * @param paths - An array of file or directory paths to check for existence.
 * @returns True if all paths exist, false if any path is missing.
 */
export function pathExistsSync(...paths: string[]) {
    return paths.every(path => fsExtra.pathExistsSync(path));
}

/**
 * Removes files or directories synchronously if they exist.
 * This function safely removes multiple files or directories by checking for existence
 * before attempting removal, preventing errors for non-existent paths.
 *
 * @param paths - An array of file or directory paths to remove.
 */
export function removeSync(...paths: string[]) {
    paths.forEach((filePath) => {
        if (pathExistsSync(filePath)) {
            fsExtra.removeSync(filePath);
        }
    });
}

/**
 * Copies files and directories synchronously with optional filtering.
 * This function copies files from source to destination with support for:
 * - Extension-based filtering (only copy files with specified extensions)
 * - Directory preservation (always copy directories regardless of extension filter)
 * - Additional copy options from fs-extra
 *
 * @param src - The source path to copy from.
 * @param dest - The destination path to copy to.
 * @param options - Optional copy configuration including extensions filter and other fs-extra options.
 */
export function copySync(src: string, dest: string, options: I_CopySyncOptions = {}): void {
    const { extensions, ...rest } = options;

    fsExtra.copySync(src, dest, {
        filter: (srcPath: string) => {
            if (statSync(srcPath).isDirectory()) {
                return true;
            }

            if (!extensions || extensions.length === 0) {
                return true;
            }

            return extensions.includes(path.extname(srcPath));
        },
        ...rest,
    });
}

/**
 * Adds an entry to the .gitignore file if it doesn't already exist.
 * Creates the .gitignore file if it doesn't exist.
 *
 * @param gitIgnorePath - The absolute path to the .gitignore file.
 * @param entry - The entry name to add (e.g. '.agent', '.simple-git-hooks.json').
 */
export function addGitIgnoreEntry(gitIgnorePath: string, entry: string): void {
    if (pathExistsSync(gitIgnorePath)) {
        const gitignore = readFileSync(gitIgnorePath, 'utf-8').split('\n');

        if (!gitignore.includes(entry)) {
            appendFileSync(gitIgnorePath, `\n${entry}\n`);
        }
    }
    else {
        writeFileSync(gitIgnorePath, `${entry}\n`);
    }
}
