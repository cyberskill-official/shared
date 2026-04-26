export type T_SerializerKnownTypes = 'Date' | 'Map' | 'Set' | 'RegExp' | 'BigInt';

export interface I_SerializerValueMap {
    Date: Date;
    Map: Map<unknown, unknown>;
    Set: Set<unknown>;
    RegExp: RegExp;
    BigInt: bigint;
}

export interface I_SerializerTypeWrapper<T extends T_SerializerKnownTypes = T_SerializerKnownTypes> {
    __type: T;
    value: unknown;
}

export interface I_Serializer<T = unknown> {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
}
