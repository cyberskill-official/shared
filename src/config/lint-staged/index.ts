export default {
    '*.ts': () => 'tsc --noEmit --incremental',
    '*': ['eslint --fix --no-cache'],
};
