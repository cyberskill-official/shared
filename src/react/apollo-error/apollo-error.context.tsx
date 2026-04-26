import { createContext } from 'react';

import type { I_ApolloErrorContext } from './apollo-error.type.js';

export const ApolloErrorContext = createContext<I_ApolloErrorContext | undefined>(undefined);
