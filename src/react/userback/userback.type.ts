import type { UserbackOptions } from '@userback/widget';

export interface I_UserBackOptions extends UserbackOptions {
    hide: string[];
}

export interface I_UserBackProps {
    token?: string;
    options?: I_UserBackOptions;
}
