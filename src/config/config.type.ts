import type { T_Object } from '#typescript/index.js';

export enum E_ConfigType {
    ESLINT = 'eslint',
    COMMITLINT = 'commitlint',
    LINT_STAGED = 'lint-staged',
    VITEST_REACT_E2E = 'vitest-react-e2e',
    VITEST_REACT_UNIT = 'vitest-react-unit',
}

export type T_ConfigType = `${E_ConfigType}`;

export type T_ConfigHandler = (...config: T_Object[]) => T_Object;
