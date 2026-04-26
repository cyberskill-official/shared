export interface I_NodeEnvInput {
    NODE_ENV?: string;
    NODE_ENV_MODE?: string;
}

export interface I_EnvFlags {
    IS_DEV: boolean;
    IS_STAG: boolean;
    IS_PROD: boolean;
}
