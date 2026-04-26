// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { ApolloErrorComponent } from './apollo-error.component.js';
import { ApolloErrorContext } from './apollo-error.context.js';

const ERROR_REGEX = /GRAPHQL_VALIDATION_FAILED/i;
const RELOAD_REGEX = /Reload/i;

describe('ApolloErrorComponent E2E Flow', () => {
    it('renders error description and provides actionable reload', () => {
        const error = new Error('GRAPHQL_VALIDATION_FAILED');

        render(
            <ApolloErrorContext value={{ error, hideError: () => {}, showError: () => {} }}>
                <ApolloErrorComponent />
            </ApolloErrorContext>,
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        const errorTexts = screen.getAllByText(ERROR_REGEX);
        expect(errorTexts.length).toBeGreaterThan(0);

        const button = screen.getByRole('button', { name: RELOAD_REGEX });
        expect(button).toBeInTheDocument();
    });
});
