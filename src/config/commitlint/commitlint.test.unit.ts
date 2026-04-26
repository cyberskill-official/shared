import { describe, expect, it } from 'vitest';

import config from './index.js';

describe('commitlint config', () => {
    it('should extend @commitlint/config-conventional', () => {
        expect(config.extends).toContain('@commitlint/config-conventional');
    });

    it('should have an ignores array with one predicate', () => {
        expect(config.ignores).toHaveLength(1);
        expect(typeof config.ignores[0]).toBe('function');
    });

    it('should ignore CI deploy commit messages', () => {
        const predicate = config.ignores[0] as (msg: string) => boolean;
        expect(predicate('[🚀 CI - Deploy] v1.2.3')).toBe(true);
        expect(predicate('chore: [🚀 CI - Deploy] release')).toBe(true);
    });

    it('should not ignore regular commit messages', () => {
        const predicate = config.ignores[0] as (msg: string) => boolean;
        expect(predicate('feat: add new feature')).toBe(false);
        expect(predicate('fix: resolve bug')).toBe(false);
        expect(predicate('')).toBe(false);
    });
});
