import { createContext } from 'react';

import type { I_LoadingContext } from './loading.type.js';

export const LoadingContext = createContext<I_LoadingContext | undefined>(undefined);
