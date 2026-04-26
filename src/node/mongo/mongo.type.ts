import type {
    AnyBulkWriteOperation,
    BulkWriteResult,
    DeleteResult,
    Filter,
    InsertManyResult,
    InsertOneResult,
    OptionalUnlessRequiredId,
    UpdateResult,
    WithId,
} from 'mongodb';
import type {
    AggregatePaginateModel,
    AggregatePaginateResult,
    ClientSession,
    ErrorHandlingMiddlewareFunction,
    ErrorHandlingMiddlewareWithOption,
    InsertManyOptions,
    PaginateModel,
    PaginateOptions,
    PaginateResult,
    PipelineStage,
    PopulateOption,
    PopulateOptions,
    PostMiddlewareFunction,
    PreMiddlewareFunction,
    PreSaveMiddlewareFunction,
    ProjectionType,
    QueryFilter,
    QueryOptions,
    QueryWithHelpers,
    Schema,
    SchemaDefinition,
    UpdateQuery,
    UpdateWriteOpResult,
} from 'mongoose';
import type mongoose from 'mongoose';

import { Collection, Db } from 'mongodb';
import {
    Document,
    Model,
} from 'mongoose';

export class C_Db extends Db { }

export type T_Filter<T> = Filter<T>;

export type T_InsertOneResult<T> = InsertOneResult<T>;

export type T_InsertManyResult<T> = InsertManyResult<T>;

export type T_UpdateResult = UpdateResult | UpdateWriteOpResult;

export type T_DeleteResult = DeleteResult;

export type T_BulkWriteOperation<T extends import('mongodb').Document = import('mongodb').Document> = AnyBulkWriteOperation<T>;

export type T_BulkWriteResult = BulkWriteResult;

export type T_WithId<T> = WithId<T>;

export type T_OptionalUnlessRequiredId<T> = OptionalUnlessRequiredId<T>;

export class C_Document extends Document { }

export class C_Model extends Model { }

export class C_Collection<
    T extends Partial<C_Document>,
> extends Collection<T> { }

export interface I_ExtendedModel<T extends Partial<C_Document>>
    extends Model<T>, PaginateModel<T>,
    AggregatePaginateModel<T> { }

export type T_QueryFilter<T> = QueryFilter<T>;

export type T_ProjectionType<T> = ProjectionType<T>;

export type T_QueryOptions<T> = QueryOptions<T>;

export type T_PaginateOptions = PaginateOptions;

export type T_PopulateOption = PopulateOption;

export type T_PopulateOptions = PopulateOptions;

export type T_PipelineStage = PipelineStage;

export type T_PaginateResult<T> = PaginateResult<T>;

export type T_AggregatePaginateResult<T> = AggregatePaginateResult<T>;

export type T_InsertManyOptions = InsertManyOptions;

export type T_UpdateQuery<T> = UpdateQuery<T>;

export type T_QueryWithHelpers<T> = QueryWithHelpers<T, T>;

export type T_PreMiddlewareFunction<T> = PreMiddlewareFunction<T>;

export type T_PreSaveMiddlewareFunction<T> = PreSaveMiddlewareFunction<T>;

export type T_PostMiddlewareFunction<T> = PostMiddlewareFunction<T>;

export type T_ErrorHandlingMiddlewareFunction<T> = ErrorHandlingMiddlewareFunction<T>;

export type T_ErrorHandlingMiddlewareWithOption<T> = ErrorHandlingMiddlewareWithOption<T>;

export type T_MongooseSchema<T> = mongoose.Schema<T>;

export type T_Input_MongooseSchema<T> = SchemaDefinition<T>;

export type T_MongoosePlugin = (schema: Schema, options?: Record<string, unknown>) => void;

export interface I_GenericDocument extends Partial<C_Document> {
    id: string;
    isDel: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export type T_Omit_Create = 'id' | 'isDel' | 'createdAt' | 'updatedAt';

export type T_Omit_Update = 'id' | 'createdAt' | 'updatedAt';

interface I_VirtualNestedOptions {
    [key: string]: I_VirtualNestedOptions | number | string | boolean;
}

/**
 * Function type for dynamically determining the reference model name.
 * Can return either a string (model name) or an enum value that represents the model.
 * The function can also return undefined, which will be handled gracefully.
 * This allows for optional properties in documents without requiring non-null assertions.
 *
 * @template T - The document type
 * @template R - The return type (string or enum)
 */
type T_DynamicRefFunction<T = unknown, R extends string = string> = (doc: T) => R | undefined;

interface I_VirtualBaseOptions {
    localField: string;
    foreignField: string;
    count?: boolean;
    justOne?: boolean;
    options?: I_VirtualNestedOptions;
}

interface I_VirtualOptions extends I_VirtualBaseOptions {
    ref: string;
}

export interface I_DynamicVirtualOptions<T, R extends string = string> extends I_VirtualBaseOptions {
    ref: T_DynamicRefFunction<T, R>;
}

export type T_VirtualOptions<T, R extends string = string> = I_VirtualOptions | I_DynamicVirtualOptions<T, R>;

export interface I_DynamicVirtualConfig<T, R extends string = string> {
    name: string;
    options: I_DynamicVirtualOptions<T, R>;
}

interface I_MongooseOptions<T, R extends string = string> {
    mongoose: typeof mongoose;
    virtuals?: {
        name: keyof T | string;
        options?: T_VirtualOptions<T, R>;
        get?: (this: T) => void;
    }[];
}

export interface I_CreateSchemaOptions<T, R extends string = string>
    extends I_MongooseOptions<T, R> {
    schema: T_Input_MongooseSchema<T>;
    standalone?: boolean;
}

export type T_MongooseMiddlewareMethod = string | RegExp;

export type T_MongooseMiddlewarePreFunction<T> = T_PreMiddlewareFunction<T> & T_PreSaveMiddlewareFunction<T>;

export type T_MongooseMiddlewarePostFunction<T> = T_PostMiddlewareFunction<T> & T_ErrorHandlingMiddlewareFunction<T> & T_ErrorHandlingMiddlewareWithOption<T>;

export interface I_MongooseModelMiddleware<T extends Partial<C_Document>> {
    method: T_MongooseMiddlewareMethod;
    pre?: T_MongooseMiddlewarePreFunction<T & T_QueryWithHelpers<T>>;
    post?: T_MongooseMiddlewarePostFunction<T>;
}

export interface I_CreateModelOptions<T extends Partial<C_Document>, R extends string = string>
    extends I_MongooseOptions<T, R> {
    schema: T_Input_MongooseSchema<T>;
    name: string;
    pagination?: boolean;
    aggregate?: boolean;
    middlewares?: I_MongooseModelMiddleware<T>[];
}

export type T_Input_Populate = string | string[] | T_PopulateOptions | T_PopulateOptions[];

export interface I_PaginateOptionsWithPopulate
    extends T_PaginateOptions,
    Omit<T_PopulateOption, 'populate'> {
    populate?: T_Input_Populate;
}

export interface I_Input_FindOne<T> extends T_PopulateOption {
    filter: T_QueryFilter<T>;
    projection?: T_ProjectionType<T>;
    options?: T_QueryOptions<T>;
}

export interface I_Input_FindAll<T> extends T_PopulateOption {
    filter: T_QueryFilter<T>;
    projection?: T_ProjectionType<T>;
    options?: T_QueryOptions<T>;
}

export interface I_Input_FindPaging<T = undefined> {
    filter?: T_QueryFilter<T>;
    options?: I_PaginateOptionsWithPopulate;
};

export interface I_Input_FindPagingAggregate {
    pipeline: T_PipelineStage[];
    options?: I_PaginateOptionsWithPopulate;
}

export interface I_Input_CreateOne<T> {
    doc: T;
}

export interface I_Input_CreateMany<T> {
    docs: T[];
}

export interface I_UpdateOptionsExtended extends Omit<QueryOptions, 'session'> {
    session?: ClientSession;
}

export interface I_Input_UpdateOne<T> extends T_PopulateOption {
    filter: T_QueryFilter<T>;
    update: T_UpdateQuery<T>;
    options?: I_UpdateOptionsExtended;
}

export interface I_Input_UpdateMany<T> extends T_PopulateOption {
    filter: T_QueryFilter<T>;
    update: T_UpdateQuery<T>;
    options?: I_UpdateOptionsExtended;
}

export interface I_DeleteOptionsExtended extends Omit<QueryOptions, 'session'> {
    session?: ClientSession;
}

export interface I_Input_DeleteOne<T> {
    filter: T_QueryFilter<T>;
    options?: I_DeleteOptionsExtended;
}

export interface I_Input_DeleteMany<T> {
    filter: T_QueryFilter<T>;
    options?: I_DeleteOptionsExtended;
}

export interface I_InputSlug<T> {
    field: string;
    filter?: T_QueryFilter<T>;
    haveHistory?: boolean;
}

export interface I_Input_CreateSlug<T> extends I_InputSlug<T> {
    from: T;
}

export interface I_Input_CheckSlug<T> extends I_InputSlug<T> {
    slug: string;
    from: T;
}

export interface I_Input_GenerateSlug<T> extends I_InputSlug<T> {
    slug: string;
    isObject: boolean;
    haveHistory?: boolean;
}
