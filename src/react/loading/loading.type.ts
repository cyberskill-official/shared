import type { HTMLAttributes } from 'react';

export interface I_LoadingContext {
    isLoading: boolean;
    isGlobalLoading: boolean;
    showLoading: (global?: boolean) => void;
    hideLoading: () => void;
}

export interface I_LoadingProps extends HTMLAttributes<HTMLDivElement> {
    full?: boolean;
    block?: boolean;
    className?: string;
    message?: string;
}
