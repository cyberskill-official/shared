import { E_UploadType } from './upload.type.js';

export const BYTES_PER_MB = 1024 * 1024;

export const DEFAULT_UPLOAD_CONFIG = {
    [E_UploadType.IMAGE]: {
        allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        sizeLimit: 5 * 1024 * 1024, // 5MB
    },
    [E_UploadType.VIDEO]: {
        allowedExtensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
        sizeLimit: 500 * 1024 * 1024, // 500MB
    },
    [E_UploadType.AUDIO]: {
        allowedExtensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
        sizeLimit: 50 * 1024 * 1024, // 50MB
    },
    [E_UploadType.DOCUMENT]: {
        allowedExtensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
        sizeLimit: 10 * 1024 * 1024, // 10MB
    },
    [E_UploadType.OTHER]: {
        allowedExtensions: ['zip', 'rar', 'tar', 'gz'],
        sizeLimit: 5 * 1024 * 1024, // 5MB
    },
};
