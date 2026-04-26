import { describe, expect, it, vi } from 'vitest';

import {
    clearGlobalApolloErrorCallback,
    hasCustomApolloErrorHandler,
    setGlobalApolloErrorCallback,
    showGlobalApolloError,
} from './apollo-error.util.js';

describe('apollo-error util', () => {
    describe('setGlobalApolloErrorCallback / showGlobalApolloError', () => {
        it('should register a callback and invoke it on showGlobalApolloError', () => {
            const cb = vi.fn();
            setGlobalApolloErrorCallback(cb);

            const error = new Error('test');
            showGlobalApolloError(error);
            expect(cb).toHaveBeenCalledWith(error);
        });

        it('should not throw when no callback is registered', () => {
            clearGlobalApolloErrorCallback();
            expect(() => showGlobalApolloError(new Error('test'))).not.toThrow();
        });
    });

    describe('hasCustomApolloErrorHandler', () => {
        it('should return false by default', () => {
            clearGlobalApolloErrorCallback();
            expect(hasCustomApolloErrorHandler()).toBe(false);
        });

        it('should return true when registered with isCustomHandler=true', () => {
            setGlobalApolloErrorCallback(vi.fn(), true);
            expect(hasCustomApolloErrorHandler()).toBe(true);
        });

        it('should return false when registered without custom flag', () => {
            setGlobalApolloErrorCallback(vi.fn());
            expect(hasCustomApolloErrorHandler()).toBe(false);
        });
    });

    describe('clearGlobalApolloErrorCallback', () => {
        it('should clear callback and custom handler flag', () => {
            setGlobalApolloErrorCallback(vi.fn(), true);
            clearGlobalApolloErrorCallback();

            expect(hasCustomApolloErrorHandler()).toBe(false);

            const cb = vi.fn();
            showGlobalApolloError(new Error('test'));
            expect(cb).not.toHaveBeenCalled();
        });
    });
});
