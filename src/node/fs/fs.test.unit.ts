import fsExtra from 'fs-extra';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addGitIgnoreEntry, appendFileSync, copySync, pathExistsSync, removeSync, writeFileSync } from './fs.util.js';

let testDir: string;

beforeEach(() => {
    testDir = fsExtra.mkdtempSync(join(tmpdir(), 'fs-test-'));
});

afterEach(() => {
    fsExtra.removeSync(testDir);
});

describe('writeFileSync', () => {
    it('should write a file with UTF-8 encoding by default', () => {
        const filePath = join(testDir, 'test.txt');
        writeFileSync(filePath, 'hello');
        expect(fsExtra.readFileSync(filePath, 'utf-8')).toBe('hello');
    });
});

describe('appendFileSync', () => {
    it('should append data to an existing file', () => {
        const filePath = join(testDir, 'append.txt');
        writeFileSync(filePath, 'hello');
        appendFileSync(filePath, ' world');
        expect(fsExtra.readFileSync(filePath, 'utf-8')).toBe('hello world');
    });
});

describe('pathExistsSync', () => {
    it('should return true when all paths exist', () => {
        const file1 = join(testDir, 'a.txt');
        const file2 = join(testDir, 'b.txt');
        writeFileSync(file1, '');
        writeFileSync(file2, '');
        expect(pathExistsSync(file1, file2)).toBe(true);
    });

    it('should return false when any path does not exist', () => {
        const file1 = join(testDir, 'exists.txt');
        writeFileSync(file1, '');
        expect(pathExistsSync(file1, join(testDir, 'nope.txt'))).toBe(false);
    });
});

describe('removeSync', () => {
    it('should remove existing files', () => {
        const filePath = join(testDir, 'remove-me.txt');
        writeFileSync(filePath, 'bye');
        removeSync(filePath);
        expect(fsExtra.pathExistsSync(filePath)).toBe(false);
    });

    it('should not throw for non-existent paths', () => {
        expect(() => removeSync(join(testDir, 'ghost.txt'))).not.toThrow();
    });
});

describe('copySync', () => {
    it('should copy a directory', () => {
        const srcDir = join(testDir, 'src');
        const destDir = join(testDir, 'dest');
        fsExtra.mkdirSync(srcDir);
        writeFileSync(join(srcDir, 'file.txt'), 'content');
        copySync(srcDir, destDir);
        expect(fsExtra.readFileSync(join(destDir, 'file.txt'), 'utf-8')).toBe('content');
    });

    it('should filter by extensions when provided', () => {
        const srcDir = join(testDir, 'src-ext');
        const destDir = join(testDir, 'dest-ext');
        fsExtra.mkdirSync(srcDir);
        writeFileSync(join(srcDir, 'keep.ts'), 'code');
        writeFileSync(join(srcDir, 'skip.md'), 'docs');
        copySync(srcDir, destDir, { extensions: ['.ts'] });
        expect(fsExtra.pathExistsSync(join(destDir, 'keep.ts'))).toBe(true);
        expect(fsExtra.pathExistsSync(join(destDir, 'skip.md'))).toBe(false);
    });
});

describe('addGitIgnoreEntry', () => {
    it('should create .gitignore with entry if file does not exist', () => {
        const gitignorePath = join(testDir, '.gitignore');
        addGitIgnoreEntry(gitignorePath, '.agent');
        const content = fsExtra.readFileSync(gitignorePath, 'utf-8');
        expect(content).toContain('.agent');
    });

    it('should append entry if not already present', () => {
        const gitignorePath = join(testDir, '.gitignore');
        writeFileSync(gitignorePath, 'node_modules\n');
        addGitIgnoreEntry(gitignorePath, '.agent');
        const content = fsExtra.readFileSync(gitignorePath, 'utf-8');
        expect(content).toContain('.agent');
        expect(content).toContain('node_modules');
    });

    it('should not duplicate existing entries', () => {
        const gitignorePath = join(testDir, '.gitignore');
        writeFileSync(gitignorePath, '.agent\n');
        addGitIgnoreEntry(gitignorePath, '.agent');
        const lines = fsExtra.readFileSync(gitignorePath, 'utf-8').split('\n').filter(l => l === '.agent');
        expect(lines).toHaveLength(1);
    });
});
