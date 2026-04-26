/**
 * @vitest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import UserbackWidget from '@userback/widget';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Userback } from './userback.component.js';

vi.mock('@userback/widget', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

describe('Userback Widget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';

        (globalThis as any).MutationObserver = class {
            public callback: MutationCallback;

            constructor(callback: MutationCallback) {
                this.callback = callback;
            }

            disconnect = vi.fn();

            observe = vi.fn();

            takeRecords = vi.fn();
        };
    });

    it('should not initialize when token is missing', () => {
        render(<Userback token="" />);
        expect(UserbackWidget).not.toHaveBeenCalled();
    });

    it('should initialize UserbackWidget when token is provided', async () => {
        const token = 'test-token-123';
        render(<Userback token={token} options={{ widget_settings: { language: 'en' }, hide: [] }} />);

        await waitFor(() => expect(UserbackWidget).toHaveBeenCalled());

        expect(UserbackWidget).toHaveBeenCalledWith(token, { widget_settings: { language: 'en' } });
    });

    it('should remove elements specified in hide option initially', async () => {
        const token = 'test-token-123';
        const dummyElement = document.createElement('div');
        dummyElement.className = 'hide-me-initial';
        document.body.appendChild(dummyElement);

        render(<Userback token={token} options={{ hide: ['.hide-me-initial'] }} />);

        await waitFor(() => expect(document.querySelector('.hide-me-initial')).toBeNull());
    });

    it('should setup MutationObserver to remove elements dynamically added later', async () => {
        const token = 'test-token-123';
        const observeSpy = vi.fn();
        let observerCallback: MutationCallback | undefined;

        (globalThis as any).MutationObserver = class {
            public callback: MutationCallback;

            constructor(callback: MutationCallback) {
                this.callback = callback;
                observerCallback = callback;
            }

            disconnect = vi.fn();

            observe = observeSpy;

            takeRecords = vi.fn();
        };

        render(<Userback token={token} options={{ hide: ['.hide-me-dynamic'] }} />);
        await waitFor(() => expect(observeSpy).toHaveBeenCalled());

        expect(observeSpy).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });

        const lateElement = document.createElement('div');
        lateElement.className = 'hide-me-dynamic';
        document.body.appendChild(lateElement);

        expect(document.querySelector('.hide-me-dynamic')).not.toBeNull();

        if (observerCallback) {
            observerCallback([], {} as any);
        }

        expect(document.querySelector('.hide-me-dynamic')).toBeNull();
    });

    it('should disconnect observer on component unmount', async () => {
        const token = 'test-token-123';
        const disconnectSpy = vi.fn();
        const observeSpy = vi.fn();

        (globalThis as any).MutationObserver = class {
            public callback: MutationCallback;

            constructor(callback: MutationCallback) {
                this.callback = callback;
            }

            disconnect = disconnectSpy;

            observe = observeSpy;

            takeRecords = vi.fn();
        };

        const { unmount } = render(<Userback token={token} />);
        await waitFor(() => expect(observeSpy).toHaveBeenCalled());

        unmount();

        expect(disconnectSpy).toHaveBeenCalled();
    });
});
