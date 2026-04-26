import { describe, expect, it } from 'vitest';

import config from './index.js';

describe('eslint config', () => {
    const baseConfig = config[0]!;

    it('should export an array with at least one config object', () => {
        expect(Array.isArray(config)).toBe(true);
        expect(config.length).toBeGreaterThan(0);
    });

    it('should include node and browser globals', () => {
        expect(baseConfig.languageOptions!.globals).toBeDefined();
    });

    it('should disable dot-notation rule', () => {
        expect(baseConfig.rules!['dot-notation']).toBe('off');
    });

    it('should configure perfectionist/sort-imports with internal pattern', () => {
        const rule = baseConfig.rules!['perfectionist/sort-imports'] as [string, { internalPattern: string[] }];
        expect(rule[0]).toBe('error');
        expect(rule[1].internalPattern).toEqual(['^#.*', '^@/.*']);
    });

    it('should ignore node_modules, .git, build, dist, and .agent', () => {
        expect(baseConfig.ignores).toContain('**/node_modules/**');
        expect(baseConfig.ignores).toContain('**/.git/**');
        expect(baseConfig.ignores).toContain('build');
        expect(baseConfig.ignores).toContain('dist');
        expect(baseConfig.ignores).toContain('.agent');
    });
});
