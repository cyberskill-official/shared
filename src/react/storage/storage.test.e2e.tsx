// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStorage } from './storage.hook.js';

vi.mock('../log/index.js', () => ({
    catchError: vi.fn((err: unknown) => ({ success: false, message: (err as Error)?.message || 'error' })),
}));

/**
 * Test harness component that exposes the useStorage hook API to the DOM.
 */
function StorageTestHarness({ storageKey, initialValue }: { storageKey: string; initialValue?: string }) {
    const { value, set, remove } = useStorage<string>(storageKey, initialValue);
    return (
        <div>
            <span data-testid="value">{value ?? 'EMPTY'}</span>
            <button data-testid="set-hello" onClick={() => set('hello')}>Set Hello</button>
            <button data-testid="set-world" onClick={() => set('world')}>Set World</button>
            <button data-testid="remove" onClick={() => void remove()}>Remove</button>
        </div>
    );
}

/**
 * The hook serialization chain is:
 *   write: serializer.serialize(val) → JSON.stringify(val) → then storage.set → localStorage.setItem(key, JSON.stringify(serialized))
 *   read:  localStorage.getItem(key) → JSON.parse → serializer.deserialize → JSON.parse
 *
 * So localStorage stores the double-serialized value: JSON.stringify(JSON.stringify(val))
 */
function expectedStoredValue(val: string): string {
    return JSON.stringify(JSON.stringify(val));
}

/**
 * To pre-seed localStorage for the hook, we need to store the double-serialized form.
 */
function seedLocalStorage(key: string, val: string): void {
    localStorage.setItem(key, JSON.stringify(JSON.stringify(val)));
}

describe('useStorage E2E (real localStorage)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
    });

    it('should initialize with initialValue when localStorage is empty', async () => {
        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-init" initialValue="first" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('first');
    });

    it('should persist initialValue to localStorage', async () => {
        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-persist" initialValue="saved" />);
        });
        const stored = localStorage.getItem('e2e-persist');
        expect(stored).not.toBeNull();
        expect(stored).toBe(expectedStoredValue('saved'));
    });

    it('should read pre-existing value from localStorage', async () => {
        seedLocalStorage('e2e-preexist', 'already-here');

        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-preexist" initialValue="fallback" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('already-here');
    });

    it('should update localStorage when set is called', async () => {
        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-update" initialValue="init" />);
        });

        await act(async () => {
            screen.getByTestId('set-hello').click();
        });

        expect(screen.getByTestId('value').textContent).toBe('hello');
        await waitFor(() => {
            expect(localStorage.getItem('e2e-update')).toBe(expectedStoredValue('hello'));
        });
    });

    it('should remove value from localStorage when remove is called', async () => {
        seedLocalStorage('e2e-remove', 'to-delete');

        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-remove" />);
        });

        expect(screen.getByTestId('value').textContent).toBe('to-delete');

        await act(async () => {
            screen.getByTestId('remove').click();
        });

        expect(screen.getByTestId('value').textContent).toBe('EMPTY');
        expect(localStorage.getItem('e2e-remove')).toBeNull();
    });

    it('should show EMPTY when no initialValue and nothing stored', async () => {
        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-nothing" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('EMPTY');
    });

    it('should handle sequential set operations', async () => {
        await act(async () => {
            render(<StorageTestHarness storageKey="e2e-seq" initialValue="start" />);
        });

        await act(async () => {
            screen.getByTestId('set-hello').click();
        });
        expect(screen.getByTestId('value').textContent).toBe('hello');

        await act(async () => {
            screen.getByTestId('set-world').click();
        });
        expect(screen.getByTestId('value').textContent).toBe('world');

        await waitFor(() => {
            expect(localStorage.getItem('e2e-seq')).toBe(expectedStoredValue('world'));
        });
    });
});
