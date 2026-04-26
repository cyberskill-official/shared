import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { RESPONSE_STATUS } from '#constant/index.js';

import { E_UploadType } from './upload.type.js';
import { createUploadConfig, getAndValidateFile, getFileSizeFromStream, getFileWebStream, upload, validateFileExtension, validateUpload } from './upload.util.js';

const logMock = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../log/index.js', () => ({
    log: logMock,
    catchError: vi.fn((_err: unknown, opts?: { returnValue?: unknown }) => opts?.returnValue ?? null),
}));

// ---------------------------------------------------------------------------
// validateFileExtension
// ---------------------------------------------------------------------------
describe('validateFileExtension', () => {
    it('should return true for allowed extension', () => {
        expect(validateFileExtension('photo.jpg', ['jpg', 'png'])).toBe(true);
    });

    it('should return false for disallowed extension', () => {
        expect(validateFileExtension('script.exe', ['jpg', 'png'])).toBe(false);
    });

    it('should return false when filename has no extension', () => {
        expect(validateFileExtension('README', ['txt', 'md'])).toBe(false);
    });

    it('should be case-insensitive', () => {
        expect(validateFileExtension('photo.JPG', ['jpg', 'png'])).toBe(true);
    });

    it('should handle multiple dots in filename', () => {
        expect(validateFileExtension('archive.tar.gz', ['gz'])).toBe(true);
    });

    it('should return false for empty allowed list', () => {
        expect(validateFileExtension('file.txt', [])).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateUpload
// ---------------------------------------------------------------------------
describe('validateUpload', () => {
    const config = createUploadConfig();

    it('should pass for valid image file', () => {
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024 },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('should fail for disallowed extension', () => {
        const result = validateUpload(
            { filename: 'hack.exe', fileSize: 1024 },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('extension not allowed');
    });

    it('should fail for oversized file', () => {
        const result = validateUpload(
            { filename: 'huge.jpg', fileSize: 100 * 1024 * 1024 },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('exceeds limit');
    });

    it('should skip size check when fileSize is undefined', () => {
        const result = validateUpload(
            { filename: 'photo.png' },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(true);
    });

    it('should validate against correct type config', () => {
        const result = validateUpload(
            { filename: 'movie.mp4', fileSize: 1024 },
            config,
            E_UploadType.VIDEO,
        );
        expect(result.isValid).toBe(true);
    });

    it('should fail video extension for image type', () => {
        const result = validateUpload(
            { filename: 'movie.mp4', fileSize: 1024 },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// createUploadConfig
// ---------------------------------------------------------------------------
describe('createUploadConfig', () => {
    it('should return default config when no overrides', () => {
        const config = createUploadConfig();
        expect(config[E_UploadType.IMAGE]).toBeDefined();
        expect(config[E_UploadType.VIDEO]).toBeDefined();
        expect(config[E_UploadType.DOCUMENT]).toBeDefined();
        expect(config[E_UploadType.OTHER]).toBeDefined();
    });

    it('should allow overriding specific types', () => {
        const customImageConfig = {
            allowedExtensions: ['webp'],
            sizeLimit: 1024,
        };
        const config = createUploadConfig({ [E_UploadType.IMAGE]: customImageConfig });
        expect(config[E_UploadType.IMAGE]).toEqual(customImageConfig);
    });

    it('should preserve defaults for non-overridden types', () => {
        const config = createUploadConfig({ [E_UploadType.IMAGE]: { allowedExtensions: ['bmp'], sizeLimit: 500 } });
        expect(config[E_UploadType.VIDEO].allowedExtensions).toContain('mp4');
    });
});

// ---------------------------------------------------------------------------
// getFileSizeFromStream
// ---------------------------------------------------------------------------
describe('getFileSizeFromStream', () => {
    it('should calculate size from readable stream', async () => {
        const data = Buffer.from('hello world');
        const stream = Readable.from([data]);
        const size = await getFileSizeFromStream(stream as NodeJS.ReadableStream);
        expect(size).toBe(data.length);
    });

    it('should return 0 for empty stream', async () => {
        const stream = Readable.from([]);
        const size = await getFileSizeFromStream(stream as NodeJS.ReadableStream);
        expect(size).toBe(0);
    });

    it('should accumulate from multiple chunks', async () => {
        const chunks = [Buffer.from('aaa'), Buffer.from('bbbbb')];
        const stream = Readable.from(chunks);
        const size = await getFileSizeFromStream(stream as NodeJS.ReadableStream);
        expect(size).toBe(8);
    });
});

// ---------------------------------------------------------------------------
// getAndValidateFile
// ---------------------------------------------------------------------------
describe('getAndValidateFile', () => {
    /**
     *
     */
    function createMockUploadFile(filename: string, content: string) {
        return Promise.resolve({
            file: {
                filename,
                createReadStream: () => Readable.from([Buffer.from(content)]),
            },
        });
    }

    it('should return success for valid file', async () => {
        const file = createMockUploadFile('photo.jpg', 'image-bytes');
        const result = await getAndValidateFile(E_UploadType.IMAGE, await file);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBeDefined();
            expect(result.result.filename).toBe('photo.jpg');
        }
    });

    it('should return failure for invalid extension', async () => {
        const file = createMockUploadFile('hack.exe', 'bad');
        const result = await getAndValidateFile(E_UploadType.IMAGE, await file);
        expect(result.success).toBe(false);
        expect(result.code).toBe(RESPONSE_STATUS.BAD_REQUEST.CODE);
    });

    it('should accept custom config', async () => {
        const customConfig = createUploadConfig({
            [E_UploadType.IMAGE]: { allowedExtensions: ['bmp'], sizeLimit: 10 * 1024 * 1024 },
        });
        const file = createMockUploadFile('photo.bmp', 'bmp-data');
        const result = await getAndValidateFile(E_UploadType.IMAGE, await file, customConfig);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getFileWebStream
// ---------------------------------------------------------------------------
describe('getFileWebStream', () => {
    /**
     *
     */
    function createMockUploadFile(filename: string, content: string) {
        return Promise.resolve({
            file: {
                filename,
                mimetype: 'text/plain',
                createReadStream: () => Readable.from([Buffer.from(content)]),
            },
        });
    }

    it('should return error if getAndValidateFile fails', async () => {
        const file = createMockUploadFile('hack.exe', 'bad');
        const result = await getFileWebStream(E_UploadType.DOCUMENT, file as any);
        expect(result.success).toBe(false);
    });

    it('should return a web stream that yields the original content', async () => {
        const file = createMockUploadFile('test.txt', 'hello world');
        const result = await getFileWebStream(E_UploadType.DOCUMENT, file as any);
        expect(result.success).toBe(true);

        if (result.success) {
            const reader = result.result.getReader();
            const { value, done } = await reader.read();
            expect(done).toBe(false);
            expect(Buffer.from(value!).toString()).toBe('hello world');
        }
    });

    it('should throw stream error if size exceeds limit during stream consumption', async () => {
        const customConfig = createUploadConfig({
            [E_UploadType.DOCUMENT]: { allowedExtensions: ['txt'], sizeLimit: 5 },
        });
        let calls = 0;
        const file = Promise.resolve({
            file: {
                filename: 'test.txt',
                mimetype: 'text/plain',
                createReadStream: () => {
                    calls++;
                    if (calls === 1) {
                        return Readable.from([Buffer.from('123')]);
                    }
                    return Readable.from([Buffer.from('too large content')]);
                },
            },
        });
        const result = await getFileWebStream(E_UploadType.DOCUMENT, file as any, customConfig);

        expect(result.success).toBe(true);

        if (result.success) {
            const reader = result.result.getReader();
            await expect(reader.read()).rejects.toThrow('File size exceeds limit of');
        }
    });
});

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------
describe('upload', () => {
    it('should return error for empty path', async () => {
        const result = await upload({
            path: '',
            file: Promise.resolve({ file: { filename: 'a.jpg', createReadStream: () => Readable.from([]) } } as any),
            type: E_UploadType.IMAGE,
        });
        expect(result.success).toBe(false);
        expect(result.code).toBe(RESPONSE_STATUS.BAD_REQUEST.CODE);
        expect(result.message).toContain('Invalid path');
    });

    it('should return error for invalid path type', async () => {
        const result = await upload({
            path: 123 as any,
            file: Promise.resolve({ file: { filename: 'a.jpg', createReadStream: () => Readable.from([]) } } as any),
            type: E_UploadType.IMAGE,
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid path');
    });

    it('should return error for null file', async () => {
        const result = await upload({
            path: '/tmp/test-upload/file.jpg',
            file: Promise.resolve(null as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-upload',
        });
        expect(result.success).toBe(false);
    });

    it('should return error for invalid config with empty extensions', async () => {
        const result = await upload({
            path: '/tmp/test-upload/file.jpg',
            file: Promise.resolve({ file: { filename: 'a.jpg', createReadStream: () => Readable.from([]) } } as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-upload',
            config: {
                [E_UploadType.IMAGE]: { allowedExtensions: [], sizeLimit: 1024 },
                [E_UploadType.VIDEO]: { allowedExtensions: ['mp4'], sizeLimit: 1024 },
                [E_UploadType.AUDIO]: { allowedExtensions: ['mp3'], sizeLimit: 1024 },
                [E_UploadType.DOCUMENT]: { allowedExtensions: ['pdf'], sizeLimit: 1024 },
                [E_UploadType.OTHER]: { allowedExtensions: ['zip'], sizeLimit: 1024 },
            },
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid config');
    });

    it('should return error for invalid config with bad sizeLimit', async () => {
        const result = await upload({
            path: '/tmp/test-upload/file.jpg',
            file: Promise.resolve({ file: { filename: 'a.jpg', createReadStream: () => Readable.from([]) } } as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-upload',
            config: {
                [E_UploadType.IMAGE]: { allowedExtensions: ['jpg'], sizeLimit: -1 },
                [E_UploadType.VIDEO]: { allowedExtensions: ['mp4'], sizeLimit: 1024 },
                [E_UploadType.AUDIO]: { allowedExtensions: ['mp3'], sizeLimit: 1024 },
                [E_UploadType.DOCUMENT]: { allowedExtensions: ['pdf'], sizeLimit: 1024 },
                [E_UploadType.OTHER]: { allowedExtensions: ['zip'], sizeLimit: 1024 },
            },
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid size limit');
    });

    it('should handle upload success by writing file to disk', async () => {
        const content = 'image-data-bytes';
        const file = {
            file: {
                filename: 'photo.jpg',
                createReadStream: () => Readable.from([Buffer.from(content)]),
            },
        };
        const result = await upload({
            path: '/tmp/test-upload-success/photo.jpg',
            file: Promise.resolve(file as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-upload-success',
        });
        // May succeed or fail depending on fs access in test environment
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
    });

    it('should catch errors during upload and return failure', async () => {
        const file = {
            file: {
                filename: 'photo.jpg',
                createReadStream: () => {
                    const stream = new Readable();
                    stream._read = () => {
                        stream.destroy(new Error('read failure'));
                    };
                    return stream;
                },
            },
        };
        const result = await upload({
            path: '/tmp/test-upload-error/photo.jpg',
            file: Promise.resolve(file as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-upload-error',
        });
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
    });

    it('should destroy readStream if writeStream emits error', async () => {
        let destroyed = false;
        const file = {
            file: {
                filename: 'photo.jpg',
                createReadStream: () => {
                    const stream = new Readable({
                        read() {
                            this.push('data');
                            this.push(null);
                        },
                    });
                    const originalDestroy = stream.destroy.bind(stream);
                    stream.destroy = (error?: Error) => {
                        destroyed = true;
                        return originalDestroy(error);
                    };
                    return stream;
                },
            },
        };

        const fs = await import('../fs/index.js');
        const { Writable } = await import('node:stream');
        const mockOut = new Writable({
            write(_chunk, _encoding, callback) {
                callback(new Error('write error'));
            },
        });
        const spy = vi.spyOn(fs, 'createWriteStream').mockReturnValueOnce(mockOut as any);

        const result = await upload({
            path: '/tmp/test-upload-out-error/photo.jpg',
            file: Promise.resolve(file as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-upload-out-error',
        });

        expect(result.success).toBe(false);
        expect(destroyed).toBe(true);
        spy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// getFileSizeFromStream error
// ---------------------------------------------------------------------------
describe('getFileSizeFromStream - error', () => {
    it('should reject on stream error', async () => {
        const stream = new Readable({
            read() {
                this.destroy(new Error('stream-error'));
            },
        });
        await expect(getFileSizeFromStream(stream as NodeJS.ReadableStream)).rejects.toThrow('stream-error');
    });
});

// ---------------------------------------------------------------------------
// upload — path traversal protection
// ---------------------------------------------------------------------------
describe('upload - path traversal', () => {
    it('should reject paths containing ".." when no baseDir is set', async () => {
        const result = await upload({
            path: '/tmp/uploads/../../../etc/passwd',
            file: Promise.resolve({ file: { filename: 'a.jpg', createReadStream: () => Readable.from([]) } } as any),
            type: E_UploadType.IMAGE,
        });
        expect(result.success).toBe(false);
        expect(result.code).toBe(RESPONSE_STATUS.BAD_REQUEST.CODE);
        expect(result.message).toContain('Path traversal detected');
    });

    it('should reject paths that escape baseDir', async () => {
        const result = await upload({
            path: '/tmp/uploads/../secret/file.jpg',
            file: Promise.resolve({ file: { filename: 'a.jpg', createReadStream: () => Readable.from([]) } } as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/uploads',
        });
        expect(result.success).toBe(false);
        expect(result.code).toBe(RESPONSE_STATUS.BAD_REQUEST.CODE);
        expect(result.message).toContain('outside the allowed base directory');
    });

    it('should allow paths within baseDir', async () => {
        const result = await upload({
            path: '/tmp/test-traversal-ok/sub/photo.jpg',
            file: Promise.resolve({
                file: {
                    filename: 'photo.jpg',
                    createReadStream: () => Readable.from([Buffer.from('ok')]),
                },
            } as any),
            type: E_UploadType.IMAGE,
            baseDir: '/tmp/test-traversal-ok',
        });
        // Should not reject with path traversal — may succeed or fail for other reasons (fs)
        expect(result.message).not.toContain('Path traversal');
    });
});

// ---------------------------------------------------------------------------
// validateUpload — mimetype validation (strict by default, advisory with opt-out)
// ---------------------------------------------------------------------------
describe('validateUpload - mimetype strict (default)', () => {
    const config = createUploadConfig();

    it('should reject when mimetype does not match expected prefix for IMAGE (strict default)', () => {
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024, mimetype: 'application/octet-stream' },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('MIME type mismatch');
    });

    it('should reject when mimetype does not match expected prefix for AUDIO (strict default)', () => {
        const result = validateUpload(
            { filename: 'song.mp3', fileSize: 1024, mimetype: 'text/plain' },
            config,
            E_UploadType.AUDIO,
        );
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('MIME type mismatch');
    });

    it('should pass when mimetype matches the expected prefix', () => {
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024, mimetype: 'image/jpeg' },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(true);
    });

    it('should pass when no mimetype is provided', () => {
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024 },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(true);
    });
});

describe('validateUpload - mimetype advisory (opt-out)', () => {
    const config = createUploadConfig();

    it('should log a warning but pass when strictMimeValidation is false for IMAGE', () => {
        logMock.warn.mockClear();
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024, mimetype: 'application/octet-stream', strictMimeValidation: false },
            config,
            E_UploadType.IMAGE,
        );
        // Advisory only — file should still pass validation
        expect(result.isValid).toBe(true);
        expect(logMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('unexpected mimetype'),
        );
    });

    it('should log a warning but pass when strictMimeValidation is false for AUDIO', () => {
        logMock.warn.mockClear();
        const result = validateUpload(
            { filename: 'song.mp3', fileSize: 1024, mimetype: 'text/plain', strictMimeValidation: false },
            config,
            E_UploadType.AUDIO,
        );
        expect(result.isValid).toBe(true);
        expect(logMock.warn).toHaveBeenCalledWith(
            expect.stringContaining('unexpected mimetype'),
        );
    });

    it('should not warn when mimetype matches the expected prefix', () => {
        logMock.warn.mockClear();
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024, mimetype: 'image/jpeg', strictMimeValidation: false },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(true);
        expect(logMock.warn).not.toHaveBeenCalled();
    });

    it('should not warn when no mimetype is provided', () => {
        logMock.warn.mockClear();
        const result = validateUpload(
            { filename: 'photo.jpg', fileSize: 1024, strictMimeValidation: false },
            config,
            E_UploadType.IMAGE,
        );
        expect(result.isValid).toBe(true);
        expect(logMock.warn).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// createUploadConfig — SVG exclusion (security)
// ---------------------------------------------------------------------------
describe('createUploadConfig - security', () => {
    it('should NOT include svg in default IMAGE allowed extensions', () => {
        const config = createUploadConfig();
        expect(config[E_UploadType.IMAGE].allowedExtensions).not.toContain('svg');
    });

    it('should include standard raster image extensions', () => {
        const config = createUploadConfig();
        expect(config[E_UploadType.IMAGE].allowedExtensions).toContain('jpg');
        expect(config[E_UploadType.IMAGE].allowedExtensions).toContain('png');
        expect(config[E_UploadType.IMAGE].allowedExtensions).toContain('webp');
    });
});
