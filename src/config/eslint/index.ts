import * as globals from 'globals';

/**
 * Base ESLint configuration.
 * This config provides the foundation for ESLint rules.
 */
export default [
    {
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            'perfectionist/sort-imports': ['error', {
                internalPattern: ['^#.*', '^@/.*'],
            }],
            'dot-notation': 'off',
        },
        ignores: ['**/node_modules/**', '**/.git/**', 'build', 'dist', '.agent'],
    },
];
