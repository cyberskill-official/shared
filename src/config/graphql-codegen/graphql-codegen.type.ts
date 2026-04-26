export interface I_GraphqlCodegenConfig {
    uri: string;
    from: string;
    to: string;
    target?: 'client' | 'server';
}
