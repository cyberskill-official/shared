import type { JSX, ReactElement, ReactNode } from 'react';

export type T_Children = ReactNode | ReactNode[] | ReactElement | JSX.Element | null;

export interface I_Children {
    children: T_Children;
}
