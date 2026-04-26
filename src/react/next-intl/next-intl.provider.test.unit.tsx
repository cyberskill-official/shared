import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NextIntlContext } from './next-intl.context.js';
import { withNextIntl } from './next-intl.hoc.js';
import { useNextIntl } from './next-intl.hook.js';
import { NextIntlProvider } from './next-intl.provider.js';

vi.mock('next-intl', () => ({
    NextIntlClientProvider: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
    useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock('../storage/index.js', () => ({
    useStorage: vi.fn(() => ({ value: { label: 'English', value: 'en', flag: '🇺🇸', numberFormat: { code: 'en-US', currency: 'USD' }, timezone: 'America/New_York' }, set: vi.fn() })),
}));

vi.mock('../log/index.js', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 *
 */
function TestConsumer() {
    const ctx = useNextIntl();
    return <span data-testid="lang">{ctx.currentLanguage.value}</span>;
}

/**
 *
 */
function Reader({ onRead }: { onRead: (val: unknown) => void }) {
    onRead(React.use(NextIntlContext));
    return null;
}

describe('NextIntlContext', () => {
    it('should default to undefined', () => {
        let contextValue: unknown;
        const handleRead = (v: unknown) => {
            contextValue = v;
        };
        render(<Reader onRead={handleRead} />);
        expect(contextValue).toBeUndefined();
    });
});

describe('useNextIntl', () => {
    it('should throw when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(() => render(<TestConsumer />)).toThrow('useNextIntl must be used within a NextIntlProvider');
        spy.mockRestore();
    });
});

const languages = [
    { label: 'English', value: 'en', flag: '🇺🇸', numberFormat: { code: 'en-US', currency: 'USD' }, timezone: 'America/New_York', adapterLocale: {} as any, icon: 'us' },
    { label: 'Vietnamese', value: 'vi', flag: '🇻🇳', numberFormat: { code: 'vi-VN', currency: 'VND' }, timezone: 'Asia/Saigon', adapterLocale: {} as any, icon: 'vn' },
] as any;
const messages = { en: { greeting: 'Hello' }, vi: { greeting: 'Xin chào' } };

describe('NextIntlProvider', () => {
    it('should render children with context', () => {
        render(
            <NextIntlProvider languages={languages} messages={messages}>
                <TestConsumer />
            </NextIntlProvider>,
        );
        expect(screen.getByTestId('lang').textContent).toBe('en');
    });
});

/**
 *
 */
function BaseComponent({ children }: { children?: React.ReactNode }) {
    return <div data-testid="base">{children}</div>;
}

describe('withNextIntl HOC', () => {
    const WrappedComponent = withNextIntl(BaseComponent);

    it('should set displayName', () => {
        expect(WrappedComponent.displayName).toBe('withNextIntl(BaseComponent)');
    });

    it('should render wrapped component within provider context', () => {
        render(
            <NextIntlProvider languages={languages} messages={messages}>
                <WrappedComponent languages={languages} messages={messages}>
                    <span>wrapped</span>
                </WrappedComponent>
            </NextIntlProvider>,
        );
        expect(screen.getByTestId('base')).toBeInTheDocument();
        expect(screen.getByText('wrapped')).toBeInTheDocument();
    });

    it('should handle timezone fallback when language not in list', () => {
        const unknownLangs = [
            { label: 'French', value: 'fr', flag: '🇫🇷', numberFormat: { code: 'fr-FR', currency: 'EUR' }, timezone: 'Europe/Paris' },
        ] as any;
        render(
            <NextIntlProvider languages={languages} messages={messages}>
                <WrappedComponent languages={unknownLangs} messages={messages}>
                    <span>tz-fallback</span>
                </WrappedComponent>
            </NextIntlProvider>,
        );
        expect(screen.getByText('tz-fallback')).toBeInTheDocument();
    });

    it('should set displayName to Component for anonymous function', () => {
        const AnonWrapped = withNextIntl(() => <div>anon</div>);
        expect(AnonWrapped.displayName).toBe('withNextIntl(Component)');
    });
});

describe('withNextIntl HOC - null currentLanguage', () => {
    it('should use defaultLang when currentLanguage is null', async () => {
        const { useStorage } = await import('../storage/index.js');

        // Mock returns null value → currentLanguage will be NEXT_INTL_DEFAULT_LANGUAGE
        vi.mocked(useStorage).mockReturnValueOnce({ value: null, set: vi.fn() } as any);

        const NullComponent = withNextIntl(({ children }: { children?: React.ReactNode }) => (
            <div data-testid="null-lang">{children}</div>
        ));

        render(
            <NextIntlProvider languages={languages} messages={messages}>
                <NullComponent languages={languages} messages={messages}>
                    <span>null-lang-test</span>
                </NullComponent>
            </NextIntlProvider>,
        );
        // Should not crash when currentLanguage is null
        expect(screen.getByText('null-lang-test')).toBeInTheDocument();
    });

    it('should handle messages without matching language', () => {
        const WrappedComponent = withNextIntl(({ children }: { children?: React.ReactNode }) => (
            <div data-testid="no-match">{children}</div>
        ));

        render(
            <NextIntlProvider languages={languages} messages={messages}>
                <WrappedComponent languages={languages} messages={{ de: { greeting: 'Hallo' } }}>
                    <span>no-match-test</span>
                </WrappedComponent>
            </NextIntlProvider>,
        );
        expect(screen.getByText('no-match-test')).toBeInTheDocument();
    });
});
