/**
 * Options for configuring error-catching behavior in both Node and React environments.
 */
export interface I_CatchErrorOptions {
    shouldLog?: boolean;
    returnValue?: unknown;
    callback?: (error: Error) => void;
}
