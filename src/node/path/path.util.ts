import pathNode from 'node:path';

import { getEnv } from '#config/env/index.js';

const env = getEnv();

export const path = pathNode;

export const dirname = path.dirname;

/**
 * Resolves a path relative to the current working directory.
 * This function creates an absolute path by combining the current working directory
 * with the provided path segments, ensuring consistent path resolution across the application.
 *
 * @param urls - Path segments to resolve relative to the current working directory.
 * @returns An absolute path string resolved from the current working directory.
 */
export function resolveWorkingPath(...urls: string[]): string {
    return path.resolve(env.CWD, ...urls);
}

/**
 * Resolves an absolute path from the provided path segments.
 * This function creates an absolute path by combining the provided path segments,
 * similar to Node.js path.resolve but without using the current working directory as base.
 *
 * @param urls - Path segments to resolve into an absolute path.
 * @returns An absolute path string resolved from the provided segments.
 */
export function resolve(...urls: string[]): string {
    return path.resolve(...urls);
}

/**
 * Joins path segments into a single path string.
 * This function combines multiple path segments using the appropriate path separator
 * for the current operating system, similar to Node.js path.join.
 *
 * @param urls - Path segments to join together.
 * @returns A joined path string with appropriate separators.
 */
export function join(...urls: string[]): string {
    return path.join(...urls);
}
