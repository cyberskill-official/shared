import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApolloErrorContext } from './apollo-error.context.js';
import { useApolloError } from './apollo-error.hook.js';
import { ApolloErrorProvider } from './apollo-error.provider.js';

/**
 *
 */
function TestConsumer() {
    const ctx = useApolloError();
    return <div data-testid="error">{ctx.error ? ctx.error.message : 'none'}</div>;
}

/**
 *
 */
function TestTrigger() {
    const { showError, hideError, error } = useApolloError();
    return (
        <div>
            <span data-testid="error-msg">{error ? error.message : 'none'}</span>
            <button data-testid="trigger" onClick={() => showError(new Error('test-error'))}>trigger</button>
            <button data-testid="hide" onClick={() => hideError()}>hide</button>
        </div>
    );
}

describe('ApolloErrorProvider', () => {
    it('should render children', () => {
        render(<ApolloErrorProvider><span>child</span></ApolloErrorProvider>);
        expect(screen.getByText('child')).toBeInTheDocument();
    });

    it('should provide error context to children', () => {
        render(
            <ApolloErrorProvider>
                <TestConsumer />
            </ApolloErrorProvider>,
        );
        expect(screen.getByTestId('error').textContent).toBe('none');
    });

    it('should delegate to onError when custom handler is provided', () => {
        const onError = vi.fn();
        render(
            <ApolloErrorProvider onError={onError}>
                <span>child</span>
            </ApolloErrorProvider>,
        );
        expect(screen.getByText('child')).toBeInTheDocument();
    });

    it('should set error state when showError is called without onError', async () => {
        render(
            <ApolloErrorProvider>
                <TestTrigger />
            </ApolloErrorProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        expect(screen.getByTestId('error-msg').textContent).toBe('test-error');
    });

    it('should clear error when hideError is called', async () => {
        render(
            <ApolloErrorProvider>
                <TestTrigger />
            </ApolloErrorProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        expect(screen.getByTestId('error-msg').textContent).toBe('test-error');
        await act(async () => {
            screen.getByTestId('hide').click();
        });
        expect(screen.getByTestId('error-msg').textContent).toBe('none');
    });

    it('should call onError callback instead of setting state when provided', async () => {
        const onError = vi.fn();
        render(
            <ApolloErrorProvider onError={onError}>
                <TestTrigger />
            </ApolloErrorProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        // Error should NOT be set in the context when onError is provided
        expect(screen.getByTestId('error-msg').textContent).toBe('none');
    });
});

describe('useApolloError', () => {
    it('should throw when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(() => render(<TestConsumer />)).toThrow('useApolloError must be used within ApolloErrorProvider');
        spy.mockRestore();
    });
});

/**
 *
 */
function Reader({ onRead }: { onRead: (v: unknown) => void }) {
    onRead(React.use(ApolloErrorContext));
    return null;
}

describe('ApolloErrorContext', () => {
    it('should default to undefined', () => {
        let contextValue: unknown;
        const handleRead = (v: unknown) => {
            contextValue = v;
        };
        render(<Reader onRead={handleRead} />);
        expect(contextValue).toBeUndefined();
    });
});
