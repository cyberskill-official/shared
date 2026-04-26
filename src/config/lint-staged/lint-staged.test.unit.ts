import { describe, expect, it } from 'vitest';

import config from './index.js';

describe('lint-staged config', () => {
    it('should run tsc --noEmit for TypeScript files', () => {
        const handler = config['*.ts'];
        expect(typeof handler).toBe('function');
        expect(handler()).toBe('tsc --noEmit --incremental');
    });

    it('should run eslint --fix --no-cache for all files', () => {
        const handler = config['*'];
        expect(Array.isArray(handler)).toBe(true);
        expect(handler).toContain('eslint --fix --no-cache');
    });
});
