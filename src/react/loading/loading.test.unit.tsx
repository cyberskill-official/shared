import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { Loading } from './loading.component.js';

describe('Loading Component', () => {
    it('renders with default props and accessibility attributes', () => {
        render(<Loading />);

        const loadingContainer = screen.getByRole('status');
        expect(loadingContainer).toBeInTheDocument();
        expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
        expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
        expect(loadingContainer).toHaveAttribute('aria-label', 'Loading');
        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('renders with custom message and updates aria-label', () => {
        const customMessage = 'Processing...';
        render(<Loading message={customMessage} />);

        const loadingContainer = screen.getByRole('status');
        expect(loadingContainer).toHaveAttribute('aria-label', customMessage);
        expect(screen.getByText(customMessage)).toBeInTheDocument();
    });

    it('hides decorative loader elements from screen readers', () => {
        const { container } = render(<Loading />);
        // Check that the load-inner elements are hidden from assistive technologies
        const loaderElements = container.querySelectorAll('[aria-hidden="true"]');
        expect(loaderElements.length).toBe(3);
    });

    it('allows overriding aria attributes', () => {
        render(<Loading role="alert" aria-live="assertive" />);

        const loadingContainer = screen.getByRole('alert');
        expect(loadingContainer).toBeInTheDocument();
        expect(loadingContainer).toHaveAttribute('aria-live', 'assertive');
    });

    it('renders in full screen mode', () => {
        const { unmount } = render(<Loading full />);

        // The component uses a side effect to add 'noscroll' class to the body
        expect(document.body).toHaveClass('noscroll');

        // Cleanup
        unmount();
        expect(document.body).not.toHaveClass('noscroll');
    });
});
