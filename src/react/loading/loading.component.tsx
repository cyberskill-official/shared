import clsx from 'clsx';
import * as React from 'react';
import { useEffect } from 'react';

import type { I_LoadingProps } from './loading.type.js';

import style from './loading.module.scss';

/**
 * Injects CSS styles to prevent scrolling when full-screen loading is active.
 * This function creates and injects a style element that adds the 'noscroll' class
 * to prevent body scrolling and sets a fixed height. It ensures the style is only
 * injected once by checking for an existing style element with the same ID.
 */
function injectNoScrollStyle() {
    if (document.getElementById('noscroll-style')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'noscroll-style';
    style.textContent = `
    .noscroll {
        overflow: hidden !important;
        height: 100vh !important;
    }
    `;
    document.head.appendChild(style);
}

/**
 * Loading component that displays an animated 3D perspective loader.
 * This component provides a customizable loading interface with three rotating
 * rings in a 3D perspective view and optional full-screen overlay. It includes
 * features for preventing user interaction during loading states and supports
 * both inline and full-screen modes.
 *
 * Features:
 * - Three rotating rings with 3D perspective transforms
 * - Full-screen overlay mode with scroll prevention
 * - Context menu prevention during full-screen loading
 * - Customizable loading message
 * - Responsive design with CSS modules
 * - Accessibility considerations with reduced motion support
 *
 * @param props - Component props containing loading configuration.
 * @param props.full - Whether to display the loading indicator in full-screen mode (default: false).
 * @param props.className - Additional CSS classes to apply to the loading container.
 * @param props.message - Custom message to display below the loading animation.
 * @param props.rest - Additional props to spread to the loading container.
 * @returns A React component displaying the loading animation with optional full-screen overlay.
 */
export function Loading({ full = false, className = '', message = 'Loading', ...rest }: I_LoadingProps) {
    useEffect(() => {
        if (full) {
            document.body.classList.add('noscroll');

            const handleContextMenu = (e: MouseEvent) => e.preventDefault();
            document.addEventListener('contextmenu', handleContextMenu);

            return () => {
                document.body.classList.remove('noscroll');
                document.removeEventListener('contextmenu', handleContextMenu);
            };
        }
    }, [full]);

    useEffect(() => {
        injectNoScrollStyle();
    }, []);

    /**
     * Renders the core loading animation with 3D rotating rings and message.
     * This function creates three load-inner elements that rotate in 3D space
     * with staggered animations, along with a centered message text.
     *
     * @returns A React element containing the loading animation and message.
     */
    function _renderLoading() {
        return (
            <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                aria-label={message}
                className={style['container']}
                {...rest}
            >
                <div className={clsx(style['load-inner'], style['load-one'])} aria-hidden="true"></div>
                <div className={clsx(style['load-inner'], style['load-two'])} aria-hidden="true"></div>
                <div className={clsx(style['load-inner'], style['load-three'])} aria-hidden="true"></div>
                {message && <span className={style['message']}>{message}</span>}
            </div>
        );
    }

    if (full) {
        return (
            <div className={clsx(style['full'], className)}>
                {_renderLoading()}
            </div>
        );
    }

    return (
        <div className={clsx(style['block'], className)}>
            {_renderLoading()}
        </div>
    );
}
