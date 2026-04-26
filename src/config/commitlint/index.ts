export default {
    extends: ['@commitlint/config-conventional'],
    ignores: [
        (message: string) => message.includes('[🚀 CI - Deploy]'),
    ],
};
