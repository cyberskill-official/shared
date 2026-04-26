/**
 * Interface representing an ESLint error structure.
 */
export interface I_EslintError {
    filePath: string;
    messages: Array<{
        ruleId: string;
        severity: number;
        message: string;
        line: number;
        column: number;
    }>;
}

/**
 * Interface representing the command execution context.
 */
export interface I_CommandContext {
    isCurrentProject: boolean;
}

/**
 * Interface representing a command with raw flag and command string.
 */
export interface I_Command { raw: boolean; cmd: string }

/**
 * Type for a function that generates a command string based on context.
 */
export type T_CommandFunction = (context?: I_CommandContext) => string;

/**
 * Type for a command, which can be a string, function that returns a string, or a raw command object.
 */
export type T_Command = string | T_CommandFunction | I_Command;

/**
 * Type for a command map input, which can be a record or a function returning a record.
 */
export type T_CommandMapInput = Record<string, T_Command> | ((context: I_CommandContext) => Record<string, T_Command>);

/**
 * Enum for command types: CLI, STRING, or FUNCTION.
 */
export enum E_CommandType {
    CLI = 'CLI',
    STRING = 'STRING',
    FUNCTION = 'FUNCTION',
}
