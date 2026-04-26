import { render } from '@testing-library/react';
import UserbackWidget from '@userback/widget';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Userback } from './userback.component.js';

// Mock @userback/widget before importing the component
vi.mock('@userback/widget', () => ({
    default: vi.fn().mockResolvedValue(undefined),
}));

describe('Userback', () => {
    it('should not call UserbackWidget when token is empty', () => {
        render(<Userback token="" />);
        expect(UserbackWidget).not.toHaveBeenCalled();
    });

    it('should call UserbackWidget when token is provided', async () => {
        render(<Userback token="test-token-123" />);
        // Allow useEffect to run
        await vi.waitFor(() => {
            expect(UserbackWidget).toHaveBeenCalledWith('test-token-123', expect.any(Object));
        });
    });

    it('should render null (no visible DOM)', () => {
        const { container } = render(<Userback token="token" />);
        expect(container.innerHTML).toBe('');
    });

    it('should clean up on unmount', async () => {
        const { unmount } = render(<Userback token="test-token" />);
        // Should not throw on unmount
        expect(() => unmount()).not.toThrow();
    });

    it('should pass options.hide and remove matching DOM elements', async () => {
        vi.mocked(UserbackWidget).mockClear();
        render(<Userback token="test-token-hide" options={{ hide: ['.ubhide'] }} />);
        await vi.waitFor(() => {
            expect(UserbackWidget).toHaveBeenCalledWith('test-token-hide', {});
        });
    });

    it('should not attempt hide when options has empty hide array', async () => {
        vi.mocked(UserbackWidget).mockClear();
        render(<Userback token="test-token-nohide" options={{ hide: [] }} />);
        await vi.waitFor(() => {
            expect(UserbackWidget).toHaveBeenCalledWith('test-token-nohide', {});
        });
    });

    it('should handle options without hide property', async () => {
        vi.mocked(UserbackWidget).mockClear();
        render(<Userback token="test-token-opts" options={{} as any} />);
        await vi.waitFor(() => {
            expect(UserbackWidget).toHaveBeenCalledWith('test-token-opts', {});
        });
    });
});
