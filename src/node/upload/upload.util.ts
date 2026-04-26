import { Buffer } from 'node:buffer';
import nodePath from 'node:path';
import { Transform } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import type { I_Return } from '#typescript/index.js';

import { RESPONSE_STATUS } from '#constant/index.js';

import type { I_UploadConfig, I_UploadFile, I_UploadFileData, I_UploadOptions, I_UploadTypeConfig, I_UploadValidationConfig } from './upload.type.js';

import { createWriteStream, mkdirSync, pathExistsSync } from '../fs/index.js';
import { log } from '../log/index.js';
import { dirname } from '../path/index.js';
import { BYTES_PER_MB, DEFAULT_UPLOAD_CONFIG } from './upload.constant.js';
import { E_UploadType } from './upload.type.js';

/**
 * Calculates the size of a file from a readable stream.
 * This function reads through the entire stream to determine the total byte size
 * by accumulating the length of each data chunk.
 *
 * @param stream - The readable stream to calculate the size for.
 * @returns A promise that resolves to the total size of the stream in bytes.
 */
export async function getFileSizeFromStream(stream: NodeJS.ReadableStream): Promise<number> {
    return new Promise((resolve, reject) => {
        let size = 0;
        stream.on('data', (chunk) => {
            size += chunk.length;
        });
        stream.on('end', () => resolve(size));
        stream.on('error', reject);
    });
}

/**
 * Extracts and validates file data from an upload file.
 * This function processes upload files by:
 * - Extracting file metadata and creating a readable stream
 * - Calculating the file size from the stream
 * - Validating file size and extension against upload configuration
 * - Returning a standardized response with success status and error codes
 * - Providing validated file data for further processing
 *
 * @param type - The type of upload being processed (IMAGE, VIDEO, DOCUMENT, OTHER).
 * @param file - The upload file object containing file metadata and stream creation method.
 * @param config - Optional upload configuration. If not provided, uses default configuration.
 * @returns A promise that resolves to a standardized response containing validated file data or error information.
 */
export async function getAndValidateFile(type: E_UploadType, file: I_UploadFile, config?: I_UploadConfig): Promise<I_Return<I_UploadFileData>> {
    const fileData = await (await file).file;
    const stream = fileData.createReadStream();
    // Stream is consumed here for validation; callers use createReadStream() again for the actual write.
    // This is intentional — createReadStream() is a factory that yields a new stream per call.
    const fileSize = await getFileSizeFromStream(stream);
    const uploadConfig = config ?? createUploadConfig();

    const validationResult = validateUpload(
        { filename: fileData.filename, fileSize, mimetype: fileData.mimetype },
        uploadConfig,
        type,
    );

    if (!validationResult.isValid) {
        return {
            success: false,
            message: validationResult.error || 'File validation failed',
            code: RESPONSE_STATUS.BAD_REQUEST.CODE,
        };
    }

    return {
        success: true,
        result: fileData,
        message: 'File validated successfully',
    };
}

/**
 * Creates a validated web-readable stream from an upload file with size validation.
 * This function processes file uploads for web environments by:
 * - Validating file data using getAndValidateFile function
 * - Creating a size validation transform stream to monitor upload progress
 * - Returning a web-compatible ReadableStream with real-time validation
 * - Providing standardized error responses for validation failures
 * - Wrapping the stream in a standardized response format
 *
 * @param type - The type of upload being processed (IMAGE, VIDEO, DOCUMENT, OTHER).
 * @param file - The upload file object containing file metadata and stream creation method.
 * @param config - Optional upload configuration. If not provided, uses default configuration.
 * @returns A promise that resolves to a standardized response containing either a web ReadableStream or error information.
 */
export async function getFileWebStream(type: E_UploadType, file: I_UploadFile, config?: I_UploadConfig): Promise<I_Return<ReadableStream<Uint8Array>>> {
    const uploadConfig = config ?? createUploadConfig();
    const typeConfig = uploadConfig[type];

    const fileData = await getAndValidateFile(type, file, config);

    if (!fileData.success) {
        return fileData;
    }

    const { createReadStream } = fileData.result;

    let remainingBytes = typeConfig.sizeLimit;

    const sizeValidationStream = new Transform({
        transform(chunk: Buffer, _enc: BufferEncoding, cb) {
            remainingBytes -= chunk.length;

            if (remainingBytes < 0) {
                cb(new Error(`File size exceeds limit of ${typeConfig.sizeLimit / BYTES_PER_MB}MB`));
            }
            else {
                cb(null, chunk);
            }
        },
    });
    const originalStream = createReadStream();

    // Destroy the source stream when the transform errors (e.g., size overflow)
    // to release the file descriptor immediately instead of waiting for GC.
    sizeValidationStream.on('error', () => {
        if ('destroy' in originalStream && typeof originalStream.destroy === 'function') {
            originalStream.destroy();
        }
    });

    const validatedStream = originalStream.pipe(sizeValidationStream);

    return {
        success: true,
        result: new ReadableStream<Uint8Array>({
            start(controller) {
                validatedStream.on('data', (chunk: Buffer | string) => {
                    controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                });
                validatedStream.on('end', () => controller.close());
                validatedStream.on('error', (err: unknown) => controller.error(err));
            },
        }),
    };
}

/**
 * Validates if a file has an allowed extension.
 * This function extracts the file extension from the filename and checks if it's
 * included in the list of allowed extensions (case-insensitive comparison).
 *
 * @param filename - The filename to check for valid extension.
 * @param allowedExtensions - An array of allowed file extensions (without dots).
 * @returns True if the file extension is allowed, false otherwise.
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
    const lastDotIndex = filename.lastIndexOf('.');

    if (lastDotIndex === -1) {
        return false;
    }

    const extension = filename.substring(lastDotIndex + 1).toLowerCase();

    return allowedExtensions.includes(extension);
}

/**
 * Validates an upload against the specified configuration.
 * This function performs comprehensive validation including:
 * - File extension validation against allowed extensions
 * - File size validation against size limits
 * - Returns detailed error messages for validation failures
 *
 * @param config - The validation configuration including filename and optional file size.
 * @param uploadConfig - The upload configuration containing allowed extensions and size limits.
 * @param uploadType - The type of upload being validated.
 * @returns An object indicating validation success and optional error message.
 */
export function validateUpload(
    config: I_UploadValidationConfig,
    uploadConfig: I_UploadConfig,
    uploadType: E_UploadType,
): { isValid: boolean; error?: string } {
    const { filename, fileSize, mimetype } = config;
    const typeConfig: I_UploadTypeConfig = uploadConfig[uploadType];

    const { allowedExtensions, sizeLimit } = typeConfig;

    if (!validateFileExtension(filename, allowedExtensions)) {
        return {
            isValid: false,
            error: `File extension not allowed for ${uploadType.toLowerCase()} files. Allowed extensions: ${allowedExtensions.join(', ')}`,
        };
    }

    if (fileSize !== undefined && fileSize > sizeLimit) {
        const maxSizeMB = Math.round(sizeLimit / (1024 * 1024));

        return {
            isValid: false,
            error: `File size exceeds limit for ${uploadType.toLowerCase()} files. Maximum size: ${maxSizeMB}MB`,
        };
    }

    if (mimetype) {
        let expectedPrefix = '';

        if (uploadType === E_UploadType.IMAGE) {
            expectedPrefix = 'image/';
        }
        else if (uploadType === E_UploadType.VIDEO) {
            expectedPrefix = 'video/';
        }
        else if (uploadType === E_UploadType.AUDIO) {
            expectedPrefix = 'audio/';
        }

        if (expectedPrefix && !mimetype.startsWith(expectedPrefix)) {
            // Security: Reject MIME type mismatches by default to prevent file type spoofing (CWE-434).
            // Consumers can opt out by passing strictMimeValidation: false.
            if (config.strictMimeValidation !== false) {
                return {
                    isValid: false,
                    error: `MIME type mismatch: File '${filename}' has mimetype '${mimetype}', expected prefix '${expectedPrefix}'. Set strictMimeValidation: false to allow advisory-only MIME checking.`,
                };
            }

            log.warn(`Advisory Mimetype Warning: File '${filename}' (type: ${uploadType}) has unexpected mimetype '${mimetype}'. Expected prefix: '${expectedPrefix}'`);
        }
    }

    return { isValid: true };
}

/**
 * Creates a default upload configuration with predefined settings for different file types.
 * This function provides sensible defaults for image, video, document, and other file types,
 * including allowed extensions and size limits. The configuration can be customized with overrides.
 *
 * @param overrides - Optional configuration overrides to merge with the default configuration.
 * @returns A complete upload configuration object with defaults and any provided overrides.
 * @since 3.13.0
 */
export function createUploadConfig(overrides?: Partial<I_UploadConfig>): I_UploadConfig {
    return { ...DEFAULT_UPLOAD_CONFIG, ...overrides };
}

/**
 * Uploads a file with comprehensive validation and error handling.
 * This function processes file uploads with the following features:
 * - Input validation for path and file parameters
 * - Configuration validation for all upload types
 * - File validation using getAndValidateFile function
 * - Automatic directory creation
 * - Stream-based file writing
 * - Comprehensive error handling with standardized response codes
 *
 * @param options - Upload configuration including file, path, type, and optional validation config.
 * @returns A promise that resolves to a standardized response with success status, message, file path, and response codes.
 */
export async function upload(options: I_UploadOptions): Promise<I_Return<string>> {
    const { path, file, config, type, baseDir } = options;

    if (!path || typeof path !== 'string') {
        return {
            success: false,
            message: 'Invalid path provided',
            code: RESPONSE_STATUS.BAD_REQUEST.CODE,
        };
    }

    // Security: Validate path is within allowed base directory to prevent path traversal.
    // When baseDir is provided, the resolved path must start with it.
    // When baseDir is not provided, reject any path containing ".." segments.
    const resolvedPath = nodePath.resolve(path);

    if (baseDir) {
        const resolvedBase = nodePath.resolve(baseDir) + nodePath.sep;
        if (!resolvedPath.startsWith(resolvedBase) && resolvedPath !== nodePath.resolve(baseDir)) {
            return {
                success: false,
                message: 'Path traversal detected: path resolves outside the allowed base directory',
                code: RESPONSE_STATUS.BAD_REQUEST.CODE,
            };
        }
    }
    else if (path.includes('..')) {
        return {
            success: false,
            message: 'Path traversal detected: ".." segments are not allowed',
            code: RESPONSE_STATUS.BAD_REQUEST.CODE,
        };
    }
    else if (nodePath.isAbsolute(path)) {
        // Security: Reject absolute paths when no baseDir is provided (CWE-22).
        // Without a baseDir anchor, an absolute path like '/etc/shadow' bypasses the '..' check
        // and writes to arbitrary filesystem locations.
        return {
            success: false,
            message: 'Path traversal detected: absolute paths are not allowed without a baseDir',
            code: RESPONSE_STATUS.BAD_REQUEST.CODE,
        };
    }

    if (!file || typeof file !== 'object') {
        return {
            success: false,
            message: 'Invalid file provided',
            code: RESPONSE_STATUS.BAD_REQUEST.CODE,
        };
    }

    if (config) {
        const requiredTypes = [E_UploadType.IMAGE, E_UploadType.VIDEO, E_UploadType.DOCUMENT, E_UploadType.OTHER];

        for (const requiredType of requiredTypes) {
            if (!config[requiredType] || !Array.isArray(config[requiredType].allowedExtensions) || config[requiredType].allowedExtensions.length === 0) {
                return {
                    success: false,
                    message: `Invalid config for ${requiredType.toLowerCase()} files`,
                    code: RESPONSE_STATUS.BAD_REQUEST.CODE,
                };
            }
            if (typeof config[requiredType].sizeLimit !== 'number' || config[requiredType].sizeLimit <= 0) {
                return {
                    success: false,
                    message: `Invalid size limit for ${requiredType.toLowerCase()} files`,
                    code: RESPONSE_STATUS.BAD_REQUEST.CODE,
                };
            }
        }
    }

    try {
        const fileData = await getAndValidateFile(type, await file, config);

        if (!fileData.success) {
            return fileData;
        }

        const { createReadStream } = fileData.result;

        const dir = dirname(path);

        if (!pathExistsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        const readStream = createReadStream();
        const out = createWriteStream(path);
        readStream.pipe(out);

        await new Promise<void>((resolve, reject) => {
            out.on('finish', () => resolve());
            out.on('error', (err) => {
                // Destroy the read stream to release resources if write fails
                if ('destroy' in readStream && typeof readStream.destroy === 'function') {
                    readStream.destroy();
                }
                reject(err);
            });
            readStream.on('error', (err) => {
                out.destroy();
                reject(err);
            });
        });

        return {
            success: true,
            result: path,
            message: 'File uploaded successfully',
            code: RESPONSE_STATUS.OK.CODE,
        };
    }
    catch (error: unknown) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'File upload failed',
            code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
        };
    }
}
