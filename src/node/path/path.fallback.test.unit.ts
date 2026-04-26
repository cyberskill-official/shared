import * as fsExtra from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCyberskillDirectory, resetCyberskillDirCacheForTesting } from './path.constant.js';

describe('getCyberskillDirectory (fallback)', () => {
    beforeEach(() => {
        resetCyberskillDirCacheForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fallback to node_modules path when package.json is unreadable', () => {
        vi.spyOn(fsExtra.default, 'readJsonSync').mockImplementation(() => {
            throw new Error('Fake FS error');
        });

        const dir = getCyberskillDirectory();

        expect(dir).toContain('node_modules');
        expect(dir).toContain('@cyberskill/shared');
    });

    it('should use working directory if it is the cyberskill package', () => {
        vi.spyOn(fsExtra.default, 'readJsonSync').mockReturnValue({ name: '@cyberskill/shared' });

        const dir = getCyberskillDirectory();

        expect(dir).not.toContain('node_modules');
        expect(dir).toContain('dist');
    });
});
