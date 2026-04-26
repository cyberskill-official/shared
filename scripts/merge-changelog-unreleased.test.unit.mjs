import { readFileSync, writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prepare } from './merge-changelog-unreleased.mjs';

vi.mock('node:fs', () => {
    const readFn = vi.fn();
    const writeFn = vi.fn();
    return {
        readFileSync: readFn,
        writeFileSync: writeFn,
        default: {
            readFileSync: readFn,
            writeFileSync: writeFn,
        },
    };
});

describe('merge-changelog-unreleased', () => {
    let mockLogger;

    beforeEach(() => {
        vi.resetAllMocks();
        mockLogger = { log: vi.fn() };
    });

    it('should correctly merge unreleased items into the version entry', async () => {
        const initialChangelog = `
## [1.0.0]

### Bug Fixes

* fix a bug

## [Unreleased]

### Bug Fixes

* fix another bug

### Features

* new feature

---

## [0.9.0]
`.trim();

        vi.mocked(readFileSync).mockReturnValue(initialChangelog);

        await prepare({}, { logger: mockLogger });

        expect(writeFileSync).toHaveBeenCalled();
        const args = vi.mocked(writeFileSync).mock.calls[0];
        const newContent = args?.[1] || '';

        expect(newContent).toContain('## [1.0.0]');
        expect(newContent).toContain('### Bug Fixes');
        expect(newContent).toContain('* fix a bug');
        expect(newContent).toContain('* fix another bug');
        expect(newContent).toContain('### Features');
        expect(newContent).toContain('* new feature');
        expect(newContent).not.toContain('## [Unreleased]');
        expect(newContent).not.toContain('---');
        expect(newContent).toContain('## [0.9.0]');
    });

    it('should handle empty unreleased sections', async () => {
        const initialChangelog = `
## [1.0.0]

### Bug Fixes

* fix a bug

## [Unreleased]

---

## [0.9.0]
`.trim();

        vi.mocked(readFileSync).mockReturnValue(initialChangelog);

        await prepare({}, { logger: mockLogger });

        expect(writeFileSync).toHaveBeenCalled();
        const args = vi.mocked(writeFileSync).mock.calls[0];
        const newContent = args?.[1] || '';

        expect(newContent).not.toContain('## [Unreleased]');
        expect(newContent).not.toContain('---');
        expect(mockLogger.log).toHaveBeenCalledWith('Empty [Unreleased] block — removing it.');
    });

    it('should skip if no version entry', async () => {
        const initialChangelog = `
## [Unreleased]

### Bug Fixes

* fix a bug

---
`.trim();

        vi.mocked(readFileSync).mockReturnValue(initialChangelog);

        await prepare({}, { logger: mockLogger });

        expect(writeFileSync).not.toHaveBeenCalled();
        expect(mockLogger.log).toHaveBeenCalledWith('No version entry found — skipping merge.');
    });

    it('should skip if no unreleased entry', async () => {
        const initialChangelog = `
## [1.0.0]

### Bug Fixes

* fix a bug
`.trim();

        vi.mocked(readFileSync).mockReturnValue(initialChangelog);

        await prepare({}, { logger: mockLogger });

        expect(writeFileSync).not.toHaveBeenCalled();
        expect(mockLogger.log).toHaveBeenCalledWith('No [Unreleased] section found — nothing to merge.');
    });

    it('should merge unreleased items when no trailing --- separator exists', async () => {
        const initialChangelog = `
## [1.0.0]

### Bug Fixes

* fix a bug

## [Unreleased]

### Features

* trailing feature
`.trim();

        vi.mocked(readFileSync).mockReturnValue(initialChangelog);

        await prepare({}, { logger: mockLogger });

        expect(writeFileSync).toHaveBeenCalled();
        const args = vi.mocked(writeFileSync).mock.calls[0];
        const newContent = args?.[1] || '';

        expect(newContent).toContain('## [1.0.0]');
        expect(newContent).toContain('* fix a bug');
        expect(newContent).toContain('* trailing feature');
        expect(newContent).not.toContain('## [Unreleased]');
    });
});
