import * as React from 'react';
import { useMemo } from 'react';

import type { I_Children } from '#typescript/index.js';

import type { I_NextIntlLanguage, I_NextIntlProviderProps } from './next-intl.type.js';

import { useStorage } from '../storage/index.js';
import { NEXT_INTL_DEFAULT_LANGUAGE } from './next-intl.constant.js';
import { NextIntlContext } from './next-intl.context.js';
import { withNextIntl } from './next-intl.hoc.js';

/**
 * Base component that serves as a wrapper for the withNextIntl HOC.
 * This component is used internally by the NextIntlProvider to create
 * the language wrapper component with internationalization capabilities.
 *
 * @param props - Component props containing children.
 * @param props.children - React children to be wrapped with internationalization support.
 * @returns A React component that passes through its children.
 */
function LanguageWrapperBase({ children }: I_Children) {
    return <>{children}</>;
}

const LanguageWrapper = withNextIntl(LanguageWrapperBase);

/**
 * Provider component that manages Next.js internationalization state and provides i18n context.
 * This component sets up a complete internationalization system for Next.js applications,
 * including language management, message loading, and persistent language preferences.
 * It integrates with the storage system to remember user language choices and provides
 * a comprehensive i18n context to all child components.
 *
 * Features:
 * - Language state management with persistence
 * - Automatic language detection and fallback
 * - Message loading and caching
 * - Timezone configuration per language
 * - Integration with Next.js internationalization
 * - Memoized context value for performance optimization
 *
 * @param props - Component props containing children, languages, and messages.
 * @param props.children - React children that will have access to the internationalization context.
 * @param props.languages - Array of supported languages with their configurations.
 * @param props.messages - Object containing translation messages for each supported language.
 * @returns A React component that provides internationalization context to its children.
 */
export function NextIntlProvider({
    children,
    languages,
    messages,
}: I_NextIntlProviderProps) {
    const { value, set } = useStorage<I_NextIntlLanguage>('lang', languages[0]);

    const contextValue = useMemo(
        () => ({ languages, currentLanguage: value ?? NEXT_INTL_DEFAULT_LANGUAGE, setCurrentLanguage: set }),
        [languages, set, value],
    );

    return (
        <NextIntlContext value={contextValue}>
            <LanguageWrapper languages={languages} messages={messages}>
                {children}
            </LanguageWrapper>
        </NextIntlContext>
    );
}
