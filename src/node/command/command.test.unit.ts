import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { log } from '../log/index.js';
import { storage } from '../storage/index.js';
import { clearAllErrorLists, formatCommand, getStoredErrorLists, rawCommand, resolveCommands, runCommand } from './command.util.js';

const RE_QUOTE = /"/g;

vi.mock('#config/env/index.js', () => ({
    getEnv: vi.fn(() => ({ DEBUG: true })),
}));

vi.mock('../log/index.js', () => ({
    catchError: vi.fn((_err: unknown, opts?: { returnValue?: unknown }) => opts?.returnValue ?? { success: false, message: 'error', code: 500 }),
    E_IssueType: { Error: 'error', Warning: 'warning' },
    log: {
        silent: vi.fn(),
        level: 4,
        fatal: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        ready: vi.fn(),
        start: vi.fn(),
        box: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        verbose: vi.fn(),
        printBoxedLog: vi.fn(),
    },
}));

vi.mock('../package/index.js', () => ({
    getPackage: vi.fn().mockResolvedValue({ success: true, result: { name: 'test-pkg', isCurrentProject: false } }),
    installDependencies: vi.fn(),
    TSX_CLI: 'tsx',
    PNPM_EXEC_CLI: 'pnpm exec',
    CYBERSKILL_CLI_PATH: 'src/node/cli/index.ts',
    CYBERSKILL_CLI: 'cyberskill',
    CYBERSKILL_PACKAGE_NAME: '@cyberskill/shared',
}));

vi.mock('../path/index.js', () => ({
    command: { cyberskill: '/usr/local/bin/cyberskill' },
    join: (...args: string[]) => args.join('/'),
    NODE_MODULES: 'node_modules',
    PACKAGE_JSON: 'package.json',
    PATH: { ROOT: '/root' },
    PNPM_EXEC_CLI: 'pnpm exec',
    TSX_CLI: 'tsx',
    CYBERSKILL_CLI: 'cyberskill',
    CYBERSKILL_CLI_PATH: 'src/node/cli/index.ts',
    CYBERSKILL_PACKAGE_NAME: '@cyberskill/shared',
}));

vi.mock('../storage/index.js', () => ({
    storage: {
        set: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        remove: vi.fn(),
        getLogLink: vi.fn().mockResolvedValue(null),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('rawCommand', () => {
    it('should return a command object with raw=true', () => {
        const result = rawCommand('echo hello');
        expect(result).toEqual({ raw: true, cmd: 'echo hello' });
    });

    it('should preserve the command string exactly', () => {
        const result = rawCommand('pnpm exec vitest run --coverage');
        expect(result.cmd).toBe('pnpm exec vitest run --coverage');
        expect(result.raw).toBe(true);
    });
});

describe('formatCommand', () => {
    it('should return raw command string as-is', () => {
        const cmd = rawCommand('echo hello');
        const result = formatCommand(cmd);
        expect(result).toBe('echo hello');
    });

    it('should handle string commands (formats as CLI)', () => {
        const result = formatCommand('lint');
        expect(typeof result).toBe('string');
        expect(result).toContain('cyberskill');
        expect(result).toContain('lint');
    });

    it('should handle function commands', () => {
        const fn = () => 'generated-command';
        const result = formatCommand(fn);
        expect(typeof result).toBe('string');
        expect(result).toContain('generated-command');
    });

    it('should format for current project context', () => {
        const result = formatCommand('lint', { isCurrentProject: true });
        expect(result).toContain('src/node/cli/index.ts');
    });

    it('should format for non-current project context', () => {
        const result = formatCommand('lint', { isCurrentProject: false });
        expect(result).toContain('cyberskill');
    });

    it('should pass context to function commands', () => {
        const fn = vi.fn((ctx?: { isCurrentProject: boolean }) =>
            ctx?.isCurrentProject ? 'local-cmd' : 'global-cmd',
        );
        const result = formatCommand(fn, { isCurrentProject: true });
        expect(fn).toHaveBeenCalledWith({ isCurrentProject: true });
        expect(result).toContain('local-cmd');
    });

    it('should return undefined-ish for undefined input', () => {
        const result = formatCommand(undefined as any);
        expect(result).toBeUndefined();
    });
});

describe('getStoredErrorLists', () => {
    it('should return empty array when storage has no data', async () => {
        (storage.get as any).mockResolvedValueOnce(null);
        const result = await getStoredErrorLists();
        expect(result).toEqual([]);
    });

    it('should return stored error entries', async () => {
        const errors = [{ file: 'test.ts', type: 'error', message: 'fail' }];
        (storage.get as any).mockResolvedValueOnce(errors);
        const result = await getStoredErrorLists();
        expect(result).toEqual(errors);
    });

    it('should return empty array on storage error', async () => {
        (storage.get as any).mockRejectedValueOnce(new Error('storage fail'));
        const result = await getStoredErrorLists();
        expect(result).toEqual([]);
    });
});

describe('clearAllErrorLists', () => {
    it('should call storage.remove', async () => {
        await clearAllErrorLists();
        expect(storage.remove).toHaveBeenCalled();
    });

    it('should not throw on storage error', async () => {
        (storage.remove as any).mockRejectedValueOnce(new Error('fail'));
        await expect(clearAllErrorLists()).resolves.toBeUndefined();
    });
});

describe('resolveCommands', () => {
    it('should resolve static command map', async () => {
        const result = await resolveCommands({ lint: 'lint', test: 'test:unit' });
        expect(result).toBeDefined();
        expect(result!['lint']).toContain('lint');
        expect(result!['test']).toContain('test:unit');
    });

    it('should resolve dynamic command map (function)', async () => {
        const factory = vi.fn((_ctx: any) => ({ build: 'build' }));
        const result = await resolveCommands(factory);
        expect(factory).toHaveBeenCalled();
        expect(result!['build']).toContain('build');
    });

    it('should handle raw commands in map', async () => {
        const result = await resolveCommands({ echo: rawCommand('echo hi') });
        expect(result!['echo']).toBe('echo hi');
    });
});

describe('runCommand', () => {
    it('should call log.start on successful command', async () => {
        await runCommand('test label', rawCommand('echo hello').cmd);
        expect(log.start).toHaveBeenCalledWith('test label');
    });

    it('should not throw on command failure without throwOnError', async () => {
        await expect(
            runCommand('failing cmd', rawCommand('false').cmd),
        ).resolves.toBeUndefined();
    });

    it('should catch errors and call catchError', async () => {
        await runCommand('fail gracefully', rawCommand('exit 1').cmd);
        // Should not throw, catchError is used
    });

    it('should log DEBUG info when DEBUG is true', async () => {
        const cmd = rawCommand('echo debug').cmd;
        await runCommand('debug test', cmd);
        expect(log.info).toHaveBeenCalledWith(expect.stringContaining(cmd));
    });

    it('should handle void command gracefully', async () => {
        await runCommand('no-op', undefined);
        expect(log.start).toHaveBeenCalledWith('no-op');
        expect(log.success).toHaveBeenCalledWith('no-op done.');
    });

    it('should set and clear progress timer when DEBUG is false', async () => {
        const { getEnv } = await import('#config/env/index.js');
        vi.mocked(getEnv).mockReturnValueOnce({ DEBUG: false } as any);

        vi.useFakeTimers();
        const spyStdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

        const promise = runCommand('timer test', rawCommand('echo hi').cmd);

        // Wait for the setInterval to advance past 1 second
        vi.advanceTimersByTime(1100);
        expect(spyStdout).toHaveBeenCalledWith(expect.stringContaining('timer test... 1s'));

        // Let the test finish
        vi.useRealTimers();
        await promise;

        // verify clearing character written
        expect(spyStdout).toHaveBeenCalledWith('\r\x1B[K');

        spyStdout.mockRestore();
    });

    it('should throw when throwOnError is true', async () => {
        await expect(
            runCommand('throws', rawCommand('false').cmd, { throwOnError: true }),
        ).rejects.toThrow();
    });

    it('should parse JSON ESLint errors via runCommand output', async () => {
        const json = [{
            filePath: '/root/test.ts',
            messages: [{ severity: 2, line: 2, column: 4, ruleId: 'no-console', message: 'error msg' }],
        }];
        const cmdString = `node -e "console.log(JSON.stringify(${JSON.stringify(json).replace(RE_QUOTE, '\\"')}))"`;
        await runCommand('test json parse', cmdString);

        expect(storage.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining([
                expect.objectContaining({ file: '/root/test.ts', type: 'error', rule: 'no-console' }),
            ]),
        );
    });

    it('should parse text-based ESLint errors', async () => {
        const output = `\\n/root/other.ts\\n  10:5 error  Missing semi  semi\\n`;
        const cmdString = `node -e "console.log(\\"${output}\\")"`;
        await runCommand('test text parse', cmdString);

        expect(storage.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining([
                expect.objectContaining({ file: '/root/other.ts', type: 'error', message: 'Missing semi' }),
            ]),
        );
    });

    it('should parse text-based TypeScript errors', async () => {
        const output = `\\n/root/tsfile.ts(15,20): error TS2322: Type error msg\\n`;
        const cmdString = `node -e "console.log(\\"${output}\\")"`;
        await runCommand('test ts parse', cmdString);

        expect(storage.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining([
                expect.objectContaining({ file: '/root/tsfile.ts', type: 'error', message: 'Type error msg' }),
            ]),
        );
    });

    it('should parse commitlint errors', async () => {
        const output = `✖   subject may not be empty   [subject-empty]`;
        const cmdString = `node -e "console.log(\\"${output}\\")"`;
        await runCommand('test commitlint', cmdString);

        expect(storage.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining([
                expect.objectContaining({ file: 'commitlint', type: 'error', message: 'subject may not be empty' }),
            ]),
        );
    });

    it('should log the storage issue directory link on error', async () => {
        (storage.getLogLink as any).mockResolvedValueOnce('/fake/storage/.agent');
        const output = `\\n/root/other.ts\\n  10:5 error  Missing semi  semi\\n`;
        const cmdString = `node -e "console.log(\\"${output}\\")"`;
        await runCommand('test text parse', cmdString);

        expect(log.info).toHaveBeenCalledWith(expect.stringContaining('/fake/storage/.agent'));
    });

    it('should handle SIGINT gracefully', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        const cmdString = `node -e "setTimeout(() => {}, 100)"`;

        const promise = runCommand('test sigint', cmdString);
        await new Promise(r => setTimeout(r, 20));
        process.emit('SIGINT');
        await promise.catch(() => {});

        expect(log.warn).toHaveBeenCalledWith('Process interrupted. Terminating...');
        expect(exitSpy).toHaveBeenCalledWith(130);
        exitSpy.mockRestore();
    });
});

describe('resolveCommands - failure path', () => {
    it('should return undefined when getPackage fails', async () => {
        const { getPackage } = await import('../package/index.js');
        vi.mocked(getPackage).mockResolvedValueOnce({ success: false, message: 'fail', code: 500 });
        const result = await resolveCommands({ lint: 'lint' });
        expect(result).toBeUndefined();
    });
});

// ---------- S-03: Adversarial injection test suite ----------

describe('rawCommand — control character rejection (CWE-78)', () => {
    it.each([
        ['null byte', 'echo\x00injected'],
        ['newline', 'echo\ninjected'],
        ['carriage return', 'echo\rinjected'],
        ['CRLF', 'echo\r\ninjected'],
        ['vertical tab', 'echo\x0Binjected'],
        ['form feed', 'echo\x0Cinjected'],
        ['escape (ESC)', 'echo\x1Binjected'],
        ['tab', 'echo\tinjected'],
        ['DEL (0x7F)', 'echo\x7Finjected'],
        ['bell (0x07)', 'echo\x07injected'],
        ['backspace (0x08)', 'echo\x08injected'],
    ])('should reject %s in command string', (_label, cmd) => {
        expect(() => rawCommand(cmd)).toThrow('control characters');
    });

    it('should accept a clean command string', () => {
        expect(() => rawCommand('echo hello world')).not.toThrow();
    });

    it('should accept commands with printable special characters', () => {
        // These are shell metacharacters but NOT control characters — rawCommand
        // is intentionally permissive here since it bypasses formatCommand.
        expect(() => rawCommand('echo "hello" | grep world')).not.toThrow();
    });
});

describe('formatCommand — shell metacharacter detection', () => {
    // formatCommand routes commands through formatCLI, which prepends the CLI prefix.
    // Commands with shell metacharacters should still format (they go through exec, not execFile).
    it('should format a string command as CLI', () => {
        const result = formatCommand('lint');
        expect(typeof result).toBe('string');
        expect(result).toContain('cyberskill');
    });

    it('should return raw command verbatim regardless of metacharacters', () => {
        const cmd = rawCommand('echo "hello" && echo "world"');
        const result = formatCommand(cmd);
        expect(result).toBe('echo "hello" && echo "world"');
    });
});
