import type { I_Log as I_LogCommon } from '#typescript/index.js';

export type { I_CatchErrorOptions } from '#util/log/index.js';

/**
 * Enum representing the type of issues for logging and error handling.
 * - Error: Represents an error issue.
 * - Warning: Represents a warning issue.
 */
export enum E_IssueType {
    Error = 'error',
    Warning = 'warning',
}

export interface I_IssueEntry {
    type: E_IssueType;
    file: string;
    message: string;
    position?: string;
    rule?: string;
}

export interface I_ThrowError {
    message?: string;
    status?: {
        CODE: string | number;
        MESSAGE: string;
    };
    type?: 'graphql' | 'rest';
}

export interface I_Log extends I_LogCommon {
    printBoxedLog: (
        title: string,
        issues: I_IssueEntry[],
        color?: string,
    ) => void;
    /**
     * Creates a context-aware logger that prefixes all messages with a correlation ID.
     * Useful for distributed tracing across CyberSkill services.
     *
     * @param correlationId - A UUID correlation ID. If not provided, a new UUID is generated.
     * @returns A logger with standard methods that prefix output with the correlation ID.
     */
    withContext: (correlationId?: string) => {
        correlationId: string;
        fatal: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
        log: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        success: (...args: unknown[]) => void;
        debug: (...args: unknown[]) => void;
    };
}
