/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import { E_ConfigType } from './config.type.js';
import { mergeConfigs } from './config.util.js';

vi.mock('vitest/config', () => ({
    defineConfig: vi.fn((config: unknown) => config),
}));

vi.mock('@antfu/eslint-config', () => ({
    default: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@vitejs/plugin-react', () => ({
    default: vi.fn(() => ({})),
}));

describe('mergeConfigs', () => {
    it('should throw for unknown config type', () => {
        expect(() => mergeConfigs('unknown-type' as any, { rules: {} })).toThrow('Unknown config type');
    });

    it('should handle commitlint config with default options', () => {
        const result = mergeConfigs(E_ConfigType.COMMITLINT);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    it('should handle lint-staged config with default options', () => {
        const result = mergeConfigs(E_ConfigType.LINT_STAGED);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    it('should deep merge commitlint config with custom options', () => {
        const result = mergeConfigs(E_ConfigType.COMMITLINT, { extends: ['@commitlint/config-conventional'] });
        expect(result).toBeDefined();
        expect(result['extends']).toContain('@commitlint/config-conventional');
    });

    it('should deep merge lint-staged config with custom options', () => {
        const result = mergeConfigs(E_ConfigType.LINT_STAGED, { '*.ts': 'eslint --fix' });
        expect(result).toBeDefined();
        expect(result['*.ts']).toBe('eslint --fix');
    });

    it('should handle ESLint config type', () => {
        const result = mergeConfigs(E_ConfigType.ESLINT, { rules: { 'no-console': 'error' } });
        expect(result).toBeDefined();
    });

    it('should handle ESLint config with ignores', () => {
        const result = mergeConfigs(E_ConfigType.ESLINT, { ignores: ['dist/**'] });
        expect(result).toBeDefined();
    });

    it('should handle VITEST_REACT_UNIT config type', () => {
        const result = mergeConfigs(E_ConfigType.VITEST_REACT_UNIT);
        expect(result).toBeDefined();
    });

    it('should handle VITEST_REACT_E2E config type', () => {
        const result = mergeConfigs(E_ConfigType.VITEST_REACT_E2E);
        expect(result).toBeDefined();
    });

    it('should handle empty config for ESLint', () => {
        const result = mergeConfigs(E_ConfigType.ESLINT);
        expect(result).toBeDefined();
    });
});
