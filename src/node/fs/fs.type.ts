import type { CopyOptionsSync } from 'fs-extra';

/**
 * Options for synchronous copy operations, extending fs-extra's CopyOptionsSync.
 */
export interface I_CopySyncOptions extends CopyOptionsSync {
    /**
     * Optional array of file extensions to filter which files are copied.
     */
    extensions?: string[];
}
