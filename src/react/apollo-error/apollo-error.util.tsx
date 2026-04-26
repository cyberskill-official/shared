import type { GraphQLError } from 'graphql';

/**
 * Global callback function for displaying Apollo errors.
 * This variable holds the callback function that will be called when a global
 * Apollo error needs to be displayed. It is set by the ApolloErrorProvider
 * and used throughout the application for consistent error handling.
 *
 * @remarks
 * **SSR Warning — Known Limitation:** These module-level singletons are shared
 * across all requests in SSR environments (e.g., Next.js). In server contexts,
 * Request A's error handler could be invoked for Request B's error, causing
 * intermittent wrong-user error display. This module is designed for **client-side
 * use only**. For SSR, ensure the provider is properly scoped per-request
 * or use a request-scoped error handling strategy.
 */
let showErrorCallback: ((err: GraphQLError | Error) => void) | null = null;
let hasCustomHandler = false;

/**
 * Sets the global callback function for Apollo error handling.
 * This function registers a callback that will be called whenever a global
 * Apollo error needs to be displayed. The callback is typically set by the
 * ApolloErrorProvider component and used throughout the application for
 * consistent error handling.
 *
 * @param callback - The function to be called when a global Apollo error occurs.
 * @param isCustomHandler - Flag that identifies whether the handler was provided by the consumer.
 */
export function setGlobalApolloErrorCallback(
    callback: (err: GraphQLError | Error) => void,
    isCustomHandler = false,
) {
    showErrorCallback = callback;
    hasCustomHandler = isCustomHandler;
}

/**
 * Clears the global callback function for Apollo error handling.
 * Useful when the ApolloErrorProvider unmounts to avoid stale references.
 */
export function clearGlobalApolloErrorCallback() {
    showErrorCallback = null;
    hasCustomHandler = false;
}

/**
 * Indicates whether a custom Apollo error handler is registered.
 *
 * @returns True if a custom handler is registered, otherwise false.
 */
export function hasCustomApolloErrorHandler() {
    return hasCustomHandler;
}

/**
 * Displays a global Apollo error using the registered callback.
 * This function triggers the global error display system by calling the
 * registered callback function. If no callback is registered, the function
 * does nothing, providing safe error handling even when the provider is not set up.
 *
 * @param error - The Apollo error to display globally.
 */
export function showGlobalApolloError(error: GraphQLError | Error) {
    showErrorCallback?.(error);
}
