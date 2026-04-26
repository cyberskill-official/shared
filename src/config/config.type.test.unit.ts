import { describe, expect, it } from 'vitest';

import { E_ConfigType } from './config.type.js';

describe('E_ConfigType', () => {
    it('should have correct enum values', () => {
        expect(E_ConfigType.ESLINT).toBe('eslint');
        expect(E_ConfigType.COMMITLINT).toBe('commitlint');
        expect(E_ConfigType.LINT_STAGED).toBe('lint-staged');
        expect(E_ConfigType.VITEST_REACT_E2E).toBe('vitest-react-e2e');
        expect(E_ConfigType.VITEST_REACT_UNIT).toBe('vitest-react-unit');
    });

    it('should contain exactly 5 members', () => {
        const values = Object.values(E_ConfigType);
        expect(values).toHaveLength(5);
    });
});
