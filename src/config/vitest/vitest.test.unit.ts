import { describe, expect, it } from 'vitest';

import { vitestE2E } from './vitest.e2e.js';
import { vitestUnit } from './vitest.unit.js';

describe('vitestUnit', () => {
    const config = vitestUnit({}) as any;

    it('should include unit test file pattern', () => {
        expect(config.test.include).toContain('**/*.test.unit.?(c|m)[jt]s?(x)');
    });

    it('should use jsdom environment', () => {
        expect(config.test.environment).toBe('jsdom');
    });

    it('should use forks pool', () => {
        expect(config.test.pool).toBe('forks');
    });

    it('should configure istanbul coverage provider', () => {
        expect(config.test.coverage.provider).toBe('istanbul');
    });

    it('should set 80% coverage thresholds', () => {
        const { thresholds } = config.test.coverage;
        expect(thresholds.statements).toBe(80);
        expect(thresholds.branches).toBe(80);
        expect(thresholds.functions).toBe(80);
        expect(thresholds.lines).toBe(80);
    });

    it('should include text and lcov reporters', () => {
        expect(config.test.coverage.reporter).toContain('text');
        expect(config.test.coverage.reporter).toContain('lcov');
    });

    it('should enable globals', () => {
        expect(config.test.globals).toBe(true);
    });

    it('should merge custom options', () => {
        const custom = vitestUnit({ resolve: { alias: { '#foo': '/bar' } } }) as any;
        expect(custom.resolve.alias['#foo']).toBe('/bar');
    });
});

describe('vitestE2E', () => {
    const config = vitestE2E({}) as any;

    it('should include e2e test file pattern', () => {
        expect(config.test.include).toContain('**/*.test.e2e.?(c|m)[jt]s?(x)');
    });

    it('should merge custom options', () => {
        const custom = vitestE2E({ resolve: { alias: { '#e2e': '/e2e' } } }) as any;
        expect(custom.resolve.alias['#e2e']).toBe('/e2e');
    });
});
