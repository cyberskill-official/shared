import { describe, expect, it } from 'vitest';

import { E_Environment } from './common.type.js';

describe('E_Environment', () => {
    it('should have correct enum values', () => {
        expect(E_Environment.PRODUCTION).toBe('production');
        expect(E_Environment.STAGING).toBe('staging');
        expect(E_Environment.DEVELOPMENT).toBe('development');
    });

    it('should contain exactly 3 members', () => {
        const values = Object.values(E_Environment);
        expect(values).toHaveLength(3);
    });

    it('should be usable as string literal types', () => {
        const env: string = E_Environment.PRODUCTION;
        expect(['production', 'staging', 'development']).toContain(env);
    });
});
