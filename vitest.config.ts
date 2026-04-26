import { resolve } from 'node:path';

import { vitestUnit } from './src/config/vitest/vitest.unit.js';

export default vitestUnit({
    resolve: {
        alias: {
            '#public': resolve(import.meta.dirname, 'public'),
            '#config': resolve(import.meta.dirname, 'src/config'),
            '#constant': resolve(import.meta.dirname, 'src/constant'),
            '#node': resolve(import.meta.dirname, 'src/node'),
            '#react': resolve(import.meta.dirname, 'src/react'),
            '#style': resolve(import.meta.dirname, 'src/style'),
            '#typescript': resolve(import.meta.dirname, 'src/typescript'),
            '#util': resolve(import.meta.dirname, 'src/util'),
        },
    },
});
