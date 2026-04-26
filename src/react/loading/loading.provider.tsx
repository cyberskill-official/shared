import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';

import type { I_Children } from '#typescript/index.js';

import { Loading } from './loading.component.js';
import { LoadingContext } from './loading.context.js';

/**
 * Provider component that manages loading state and provides loading context.
 * This component sets up loading state management for the application and provides
 * loading context to all child components through React context.
 *
 * Features:
 * - Global loading state management
 * - Loading context provision to child components
 * - Automatic loading state synchronization
 * - Integration with loading components
 *
 * @param props - Component props containing children.
 * @param props.children - React children that will have access to the loading context.
 * @returns A React component that provides loading context to its children.
 */
export function LoadingProvider({ children }: I_Children) {
    const [isLoading, setIsLoading] = useState(false);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);

    const showLoading = useCallback((global = false) => {
        setIsLoading(true);
        setIsGlobalLoading(global);
    }, []);

    const hideLoading = useCallback(() => {
        setIsLoading(false);
        setIsGlobalLoading(false);
    }, []);

    const contextValue = useMemo(
        () => ({ isLoading, isGlobalLoading, showLoading, hideLoading }),
        [isLoading, isGlobalLoading, showLoading, hideLoading],
    );

    return (
        <LoadingContext value={contextValue}>
            {isLoading ? <Loading full={isGlobalLoading} /> : children}
        </LoadingContext>
    );
}
