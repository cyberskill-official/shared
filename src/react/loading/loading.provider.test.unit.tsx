import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LoadingContext } from './loading.context.js';
import { useLoading } from './loading.hook.js';
import { LoadingProvider } from './loading.provider.js';

vi.mock('./loading.component.js', () => ({
    Loading: vi.fn(({ full }: { full?: boolean }) => <div data-testid="loading">{full ? 'global' : 'local'}</div>),
}));

/**
 *
 */
function TestConsumer() {
    const ctx = useLoading();
    return (
        <div>
            <span data-testid="status">{ctx.isLoading ? 'loading' : 'idle'}</span>
            <button data-testid="show" onClick={() => ctx.showLoading()}>show</button>
            <button data-testid="hide" onClick={() => ctx.hideLoading()}>hide</button>
        </div>
    );
}

/**
 *
 */
function ContextCapture({ onCapture }: { onCapture: (val: any) => void }) {
    onCapture(useLoading());
    return null;
}

/**
 *
 */
function Reader({ onRead }: { onRead: (val: unknown) => void }) {
    onRead(React.use(LoadingContext));
    return null;
}

describe('LoadingProvider', () => {
    it('should render children when not loading', () => {
        render(<LoadingProvider><span>content</span></LoadingProvider>);
        expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('should show loading indicator when showLoading is called', async () => {
        const { getByTestId } = render(
            <LoadingProvider>
                <TestConsumer />
            </LoadingProvider>,
        );
        const showBtn = getByTestId('show');
        await act(() => {
            showBtn.click();
        });
        expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('should show local loading by default', async () => {
        const { getByTestId } = render(
            <LoadingProvider>
                <TestConsumer />
            </LoadingProvider>,
        );
        await act(() => {
            getByTestId('show').click();
        });
        expect(screen.getByTestId('loading').textContent).toBe('local');
    });

    it('should hide loading when hideLoading is called', async () => {
        let capturedContext: any;
        /**
         *
         */
        // ContextCapture component moved to module scope

        const handleCapture = (val: any) => {
            capturedContext = val;
        };

        render(
            <LoadingProvider>
                <ContextCapture onCapture={handleCapture} />
            </LoadingProvider>,
        );

        await act(() => {
            capturedContext.showLoading();
        });
        expect(screen.getByTestId('loading')).toBeInTheDocument();

        // At this point ContextCapture is unmounted because isLoading=true replaces children.
        // But we have captured `hideLoading` reference!
        await act(() => {
            capturedContext.hideLoading();
        });

        // Now children are mounted again!
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
});

describe('useLoading', () => {
    it('should throw when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(() => render(<TestConsumer />)).toThrow('useLoading must be used within a LoadingProvider');
        spy.mockRestore();
    });

    it('should provide context within provider', () => {
        render(
            <LoadingProvider>
                <TestConsumer />
            </LoadingProvider>,
        );
        expect(screen.getByTestId('status').textContent).toBe('idle');
    });
});

describe('LoadingContext', () => {
    it('should default to undefined', () => {
        let contextValue: unknown;
        const handleRead = (v: unknown) => {
            contextValue = v;
        };
        render(<Reader onRead={handleRead} />);
        expect(contextValue).toBeUndefined();
    });
});
