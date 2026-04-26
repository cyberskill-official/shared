import UserbackWidget from '@userback/widget';
import { useEffect } from 'react';

import type { I_UserBackProps } from './userback.type.js';

/**
 * Userback feedback widget component for collecting user feedback.
 * This component integrates the Userback feedback widget into React applications,
 * providing a customizable feedback collection interface for users to submit
 * bug reports, feature requests, and general feedback.
 *
 * Features:
 * - Userback widget integration
 * - Customizable feedback collection
 * - Automatic widget initialization
 * - Token-based configuration
 * - Responsive design support
 *
 * @param props - Component props containing token and options.
 * @param props.token - The Userback token for widget authentication.
 * @param props.options - Optional configuration options for the Userback widget.
 * @returns A React component that renders the Userback feedback widget.
 */
export function Userback({ token, options }: I_UserBackProps) {
    useEffect(() => {
        if (!token) {
            return;
        }

        let observer: MutationObserver;

        const loadUserback = async () => {
            const { hide, ...rest } = options || {};

            await UserbackWidget(token, rest);

            if (hide && hide.length > 0) {
                hide.forEach((selector: string) => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
            }

            observer = new MutationObserver(() => {
                if (hide && hide.length > 0) {
                    hide.forEach((selector: string) => {
                        document.querySelectorAll(selector).forEach(el => el.remove());
                    });
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        };

        loadUserback();

        return () => {
            observer?.disconnect();
        };
        // eslint-disable-next-line react/exhaustive-deps -- intended to only load Userback on token change
    }, [token]);

    return null;
}
