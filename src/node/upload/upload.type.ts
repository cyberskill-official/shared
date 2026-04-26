export enum E_UploadType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    AUDIO = 'AUDIO',
    DOCUMENT = 'DOCUMENT',
    OTHER = 'OTHER',
}

export interface I_UploadValidationConfig {
    filename: string;
    fileSize?: number;
    mimetype?: string;
    /**
     * When `true` (the default), reject files whose MIME type does not match the expected
     * upload type prefix (e.g., `image/` for IMAGE). Set to `false` for advisory-only
     * MIME checking (logs a warning instead of rejecting).
     *
     * @security Disabling strict validation weakens defense against file-type spoofing (CWE-434).
     * @default true
     */
    strictMimeValidation?: boolean;
}

export interface I_UploadTypeConfig {
    allowedExtensions: string[];
    sizeLimit: number;
}

export interface I_UploadConfig {
    [E_UploadType.IMAGE]: I_UploadTypeConfig;
    [E_UploadType.VIDEO]: I_UploadTypeConfig;
    [E_UploadType.AUDIO]: I_UploadTypeConfig;
    [E_UploadType.DOCUMENT]: I_UploadTypeConfig;
    [E_UploadType.OTHER]: I_UploadTypeConfig;
}

export interface I_UploadFileData {
    createReadStream: () => NodeJS.ReadableStream;
    filename: string;
    mimetype?: string;
}

export interface I_UploadFile {
    file: I_UploadFileData;
}

export interface I_UploadOptions {
    file: Promise<I_UploadFile>;
    path: string;
    type: E_UploadType;
    config?: I_UploadConfig;
    /** Base directory for path containment validation. When set, the resolved `path` must reside within this directory. */
    baseDir?: string;
}
