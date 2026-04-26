import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStorage } from './storage.hook.js';
import { storage } from './storage.util.js';

vi.mock('../log/index.js', () => ({
    catchError: vi.fn(),
}));

vi.mock('./storage.util.js', () => {
    const store = new Map<string, unknown>();
    return {
        storage: {
            get: vi.fn(async (key: string) => store.get(key) ?? null),
            set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
            remove: vi.fn(async (key: string) => { store.delete(key); }),
            _store: store,
        },
    };
});

/**
 *
 */
function TestHarness({ storageKey, initialValue }: { storageKey: string; initialValue?: string }) {
    const { value, set, remove } = useStorage<string>(storageKey, initialValue);
    return (
        <div>
            <span data-testid="value">{value ?? 'undefined'}</span>
            <button data-testid="set" onClick={() => set('updated')}>set</button>
            <button data-testid="remove" onClick={() => remove()}>remove</button>
        </div>
    );
}

/**
 *
 */
function FnTestHarness() {
    const { value, set } = useStorage<number>('fn-key', 10);
    return (
        <div>
            <span data-testid="val">{value ?? 'undefined'}</span>
            <button data-testid="inc" onClick={() => set(prev => (prev ?? 0) + 1)}>inc</button>
        </div>
    );
}

describe('useStorage', () => {
    beforeEach(() => {
        (storage as any)._store.clear();
        vi.clearAllMocks();
    });

    it('should use initial value when storage is empty', async () => {
        await act(async () => {
            render(<TestHarness storageKey="test-key" initialValue="hello" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('hello');
    });

    it('should load existing value from storage', async () => {
        (storage as any)._store.set('existing-key', '"stored"');

        await act(async () => {
            render(<TestHarness storageKey="existing-key" initialValue="fallback" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('stored');
    });

    it('should return undefined when no initial value and nothing in storage', async () => {
        await act(async () => {
            render(<TestHarness storageKey="empty-key" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('undefined');
    });

    it('should call storage.set when initial value is persisted', async () => {
        await act(async () => {
            render(<TestHarness storageKey="persist-key" initialValue="init" />);
        });
        expect(storage.set).toHaveBeenCalledWith('persist-key', '"init"');
    });

    it('should update value when set is called', async () => {
        await act(async () => {
            render(<TestHarness storageKey="set-key" initialValue="orig" />);
        });
        await act(async () => {
            screen.getByTestId('set').click();
        });
        expect(screen.getByTestId('value').textContent).toBe('updated');
    });

    it('should remove value from storage when remove is called', async () => {
        (storage as any)._store.set('rem-key', '"existing"');
        await act(async () => {
            render(<TestHarness storageKey="rem-key" />);
        });
        await act(async () => {
            screen.getByTestId('remove').click();
        });
        expect(storage.remove).toHaveBeenCalledWith('rem-key');
        expect(screen.getByTestId('value').textContent).toBe('undefined');
    });

    it('should handle function updater in set', async () => {
        await act(async () => {
            render(<FnTestHarness />);
        });
        await act(async () => {
            screen.getByTestId('inc').click();
        });
        expect(screen.getByTestId('val').textContent).toBe('11');
    });

    it('should handle error during loadValue and fall back to initialValue', async () => {
        vi.mocked(storage.get).mockRejectedValueOnce(new Error('load-fail'));
        await act(async () => {
            render(<TestHarness storageKey="err-load" initialValue="fallback" />);
        });
        expect(screen.getByTestId('value').textContent).toBe('fallback');
    });

    it('should handle error during saveValue gracefully', async () => {
        vi.mocked(storage.set).mockRejectedValueOnce(new Error('save-fail'));
        await act(async () => {
            render(<TestHarness storageKey="err-save" initialValue="init" />);
        });
        // Should not crash
        expect(screen.getByTestId('value').textContent).toBeDefined();
    });

    it('should handle error during remove gracefully', async () => {
        (storage as any)._store.set('err-remove', '"val"');
        vi.mocked(storage.remove).mockRejectedValueOnce(new Error('remove-fail'));
        await act(async () => {
            render(<TestHarness storageKey="err-remove" />);
        });
        await act(async () => {
            screen.getByTestId('remove').click();
        });
        // Should not crash despite error
        expect(screen.getByTestId('value')).toBeDefined();
    });
});
