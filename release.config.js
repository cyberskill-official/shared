const types = [
    { type: 'feat', section: '✨ Features' },
    { type: 'fix', section: '🐛 Bug Fixes' },
    { type: 'perf', section: '⚡ Performance' },
    { type: 'refactor', section: '♻️ Refactoring' },
    { type: 'docs', section: '📝 Documentation' },
    { type: 'test', section: '✅ Tests' },
    { type: 'build', section: '📦 Build' },
    { type: 'ci', section: '🔧 CI' },
    { type: 'chore', section: '🧹 Chores' },
    { type: 'revert', section: '⏪ Reverts' },
];

export default {
    branches: ['main'],
    plugins: [
        ['@semantic-release/commit-analyzer', {
            preset: 'conventionalcommits',
        }],
        ['@semantic-release/release-notes-generator', {
            preset: 'conventionalcommits',
            presetConfig: { types },
        }],
        // Gate: abort the release if the computed version would publish backwards
        // over npm's current `latest` (e.g. when git tags are missing). Runs in
        // verifyRelease — before changelog/npm/git — so nothing is mutated or
        // published on a blocked release.
        './scripts/guard-no-downgrade.mjs',
        ['@semantic-release/changelog', {
            changelogFile: 'docs/CHANGELOG.md',
        }],
        '@semantic-release/npm',
        './scripts/merge-changelog-unreleased.mjs',
        '@semantic-release/github',
        ['@semantic-release/git', {
            assets: ['package.json', 'docs/CHANGELOG.md'],
            // eslint-disable-next-line no-template-curly-in-string
            message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
        }],
    ],
};
