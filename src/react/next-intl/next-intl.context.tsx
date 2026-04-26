import { createContext } from 'react';

import type { I_NextIntlContext } from './next-intl.type.js';

export const NextIntlContext = createContext<I_NextIntlContext | undefined>(undefined);
