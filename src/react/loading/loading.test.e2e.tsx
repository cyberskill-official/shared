// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { useLoading } from './loading.hook.js';
import { LoadingProvider } from './loading.provider.js';

let resolveWork: () => void;

/**
 * A testing component that utilizes the loading hook
 * to simulate an async loading sequence deterministically.
 */
function AsyncTestComponent() {
    const { showLoading, hideLoading } = useLoading();

    const doAsyncWork = async () => {
        showLoading(true); // Full screen global loading
        // Await deterministic promise resolution from the test runner
        await new Promise<void>((resolve) => {
            resolveWork = resolve;
        });
        hideLoading();
    };

    return (
        <div>
            <button type="button" onClick={() => void doAsyncWork()}>
                Fetch Data
            </button>
            <div data-testid="content">Main Content Area</div>
        </div>
    );
}

describe('Loading Flow E2E', () => {
    it('exercises the full lifecycle of global loading rendering and unmounting', async () => {
        render(
            <LoadingProvider>
                <AsyncTestComponent />
            </LoadingProvider>,
        );

        // Initially, content is visible and loading is hidden
        expect(screen.getByTestId('content')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(document.body).not.toHaveClass('noscroll');

        // Trigger loading sequence
        const button = screen.getByRole('button', { name: 'Fetch Data' });
        await act(async () => {
            fireEvent.click(button);
        });

        // The children unmount and loading animation is rendered
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByTestId('content')).not.toBeInTheDocument();
        expect(document.body).toHaveClass('noscroll');

        // Resolve the async operation deterministically
        await act(async () => {
            resolveWork();
        });

        // Wait for state updates to apply and hide the loading overlay
        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(document.body).not.toHaveClass('noscroll');
        });

        // The loading overlay is unmounted, noscroll class removed, and children remounted
        expect(screen.getByTestId('content')).toBeInTheDocument();
    });
});
