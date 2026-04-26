/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import { addGitIgnoreEntry, writeFileSync } from '../fs/index.js';
import { convertEnumToModelName, mongo } from './mongo.util.js';

const RE_LOWERCASE = /^[a-z]+$/;
const RE_MIN_3_CHARS = /^.{3,}$/;
const RE_MIN_5_CHARS = /^.{5,}$/;

vi.mock('../fs/index.js', () => ({
    writeFileSync: vi.fn(),
    addGitIgnoreEntry: vi.fn(),
}));

vi.mock('../path/index.js', () => ({
    MIGRATE_MONGO_CONFIG: 'migrate-mongo-config.js',
    PATH: { MIGRATE_MONGO_CONFIG: 'migrate-mongo-config.js', GIT_IGNORE: '.gitignore' },
}));

describe('convertEnumToModelName', () => {
    it('should convert all-uppercase to PascalCase', () => {
        expect(convertEnumToModelName('USER')).toBe('User');
        expect(convertEnumToModelName('POST')).toBe('Post');
    });

    it('should return mixed-case as-is', () => {
        expect(convertEnumToModelName('User')).toBe('User');
        expect(convertEnumToModelName('BlogPost')).toBe('BlogPost');
    });

    it('should handle single char', () => {
        expect(convertEnumToModelName('A')).toBe('A');
    });
});

describe('mongo', () => {
    describe('createGenericFields', () => {
        it('should create generic fields with id, isDel, createdAt, updatedAt', () => {
            const fields = mongo.createGenericFields();
            expect(fields).toHaveProperty('id');
            expect(fields).toHaveProperty('isDel', false);
            expect(fields).toHaveProperty('createdAt');
            expect(fields).toHaveProperty('updatedAt');
            expect(fields.createdAt).toBeInstanceOf(Date);
            expect(fields.updatedAt).toBeInstanceOf(Date);
        });

        it('should generate unique ids', () => {
            const a = mongo.createGenericFields();
            const b = mongo.createGenericFields();
            expect(a.id).not.toBe(b.id);
        });
    });

    describe('isDynamicVirtual', () => {
        it('should return true when ref is a function', () => {
            expect(mongo.isDynamicVirtual({ ref: () => 'User', localField: 'id', foreignField: 'entityId' } as any)).toBe(true);
        });

        it('should return false when ref is a string', () => {
            expect(mongo.isDynamicVirtual({ ref: 'User', localField: 'id', foreignField: 'entityId' } as any)).toBe(false);
        });

        it('should return false when options is undefined', () => {
            expect(mongo.isDynamicVirtual(undefined)).toBe(false);
        });

        it('should return false when no ref', () => {
            expect(mongo.isDynamicVirtual({ localField: 'id' } as any)).toBe(false);
        });
    });

    describe('applyPlugins', () => {
        it('should call schema.plugin for each valid plugin', () => {
            const schema = { plugin: vi.fn() } as any;
            const pluginA = vi.fn();
            const pluginB = vi.fn();
            mongo.applyPlugins(schema, [pluginA, false, pluginB]);
            expect(schema.plugin).toHaveBeenCalledTimes(2);
            expect(schema.plugin).toHaveBeenCalledWith(pluginA);
            expect(schema.plugin).toHaveBeenCalledWith(pluginB);
        });

        it('should handle all false plugins', () => {
            const schema = { plugin: vi.fn() } as any;
            mongo.applyPlugins(schema, [false, false]);
            expect(schema.plugin).not.toHaveBeenCalled();
        });
    });

    describe('applyMiddlewares', () => {
        it('should call schema.pre for pre middleware', () => {
            const schema = { pre: vi.fn(), post: vi.fn() } as any;
            const preFn = vi.fn();
            mongo.applyMiddlewares(schema, [{ method: 'save', pre: preFn }]);
            expect(schema.pre).toHaveBeenCalledWith('save', preFn);
        });

        it('should call schema.post for post middleware', () => {
            const schema = { pre: vi.fn(), post: vi.fn() } as any;
            const postFn = vi.fn();
            mongo.applyMiddlewares(schema, [{ method: 'save', post: postFn }]);
            expect(schema.post).toHaveBeenCalledWith('save', postFn);
        });

        it('should handle both pre and post', () => {
            const schema = { pre: vi.fn(), post: vi.fn() } as any;
            const preFn = vi.fn();
            const postFn = vi.fn();
            mongo.applyMiddlewares(schema, [{ method: 'save', pre: preFn, post: postFn }]);
            expect(schema.pre).toHaveBeenCalledWith('save', preFn);
            expect(schema.post).toHaveBeenCalledWith('save', postFn);
        });

        it('should skip when method is missing', () => {
            const schema = { pre: vi.fn(), post: vi.fn() } as any;
            mongo.applyMiddlewares(schema, [{ pre: vi.fn() } as any]);
            expect(schema.pre).not.toHaveBeenCalled();
        });
    });

    describe('validator.isRequired', () => {
        it('should return true for non-empty value', async () => {
            const validator = mongo.validator.isRequired();
            expect(await validator.call({}, 'hello')).toBe(true);
        });

        it('should return false for empty string', async () => {
            const validator = mongo.validator.isRequired();
            expect(await validator.call({}, '')).toBe(false);
        });

        it('should return false for null', async () => {
            const validator = mongo.validator.isRequired();
            expect(await validator.call({}, null)).toBe(false);
        });
    });

    describe('validator.isUnique', () => {
        it('should return true when no existing document', async () => {
            const validator = mongo.validator.isUnique(['email']);
            const context = { constructor: { exists: vi.fn().mockResolvedValue(null) } };
            expect(await validator.call(context as any, 'test@example.com')).toBe(true);
        });

        it('should return false when document already exists', async () => {
            const validator = mongo.validator.isUnique(['email']);
            const context = { constructor: { exists: vi.fn().mockResolvedValue({ _id: '1' }) } };
            expect(await validator.call(context as any, 'test@example.com')).toBe(false);
        });

        it('should throw for empty fields array', async () => {
            const validator = mongo.validator.isUnique([]);
            const context = { constructor: { exists: vi.fn() } };
            await expect(validator.call(context as any, 'test')).rejects.toThrow('Fields must be a non-empty array');
        });

        it('should wrap value in $eq to prevent NoSQL injection', async () => {
            const validator = mongo.validator.isUnique(['email']);
            const existsSpy = vi.fn().mockResolvedValue(null);
            const context = { constructor: { exists: existsSpy } };

            await validator.call(context as any, { $ne: null });

            expect(existsSpy).toHaveBeenCalledWith({
                $or: [{ email: { $eq: { $ne: null } } }],
            });
        });
    });

    describe('validator.matchesRegex', () => {
        it('should return true when all patterns match', async () => {
            const validator = mongo.validator.matchesRegex([RE_LOWERCASE, RE_MIN_3_CHARS]);
            expect(await validator('abc')).toBe(true);
        });

        it('should return false when any pattern fails', async () => {
            const validator = mongo.validator.matchesRegex([RE_LOWERCASE, RE_MIN_5_CHARS]);
            expect(await validator('abc')).toBe(false);
        });

        it('should throw for invalid regex array', async () => {
            const validator = mongo.validator.matchesRegex(['not-regex' as any]);
            await expect(validator('test')).rejects.toThrow('regexArray must be an array of valid RegExp');
        });
    });

    describe('regexify', () => {
        it('should convert string values to regex', () => {
            const filter = { name: 'test' };
            const result = mongo.regexify(filter, ['name']) as any;
            expect(result.name).toEqual({
                $regex: expect.stringContaining('t(e|è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ)st'),
                $options: 'i',
            });
        });

        it('should return empty object for undefined filter', () => {
            expect(mongo.regexify(undefined)).toEqual({});
        });

        it('should return filter unchanged when no fields provided', () => {
            const filter = { name: 'test' };
            expect(mongo.regexify(filter)).toEqual(filter);
            expect(mongo.regexify(filter, [])).toEqual(filter);
        });

        it('should ignore fields not in the list', () => {
            const filter = { name: 'test', age: 10 };
            const result = mongo.regexify(filter, ['name']) as any;
            expect(result.age).toBe(10);
        });

        it('should skip non-string field values', () => {
            const filter = { count: 5 };
            const result = mongo.regexify(filter, ['count']) as any;
            expect(result.count).toBe(5);
        });

        it('should skip empty string values', () => {
            const filter = { name: '' };
            const result = mongo.regexify(filter, ['name']) as any;
            expect(result.name).toBe('');
        });
    });

    describe('migrate.setConfig', () => {
        it('should write config and update gitignore', () => {
            mongo.migrate.setConfig({ migrationsDir: 'migrations' } as any);
            expect(writeFileSync).toHaveBeenCalled();
            expect(addGitIgnoreEntry).toHaveBeenCalled();
        });
    });

    describe('migrate.getModule', () => {
        it('should dynamically import migrate-mongo', async () => {
            const module = await mongo.migrate.getModule();
            expect(module).toBeDefined();
        });
    });

    describe('getNewRecords', () => {
        it('should throw when findAll fails', async () => {
            const controller = { findAll: vi.fn().mockResolvedValue({ success: false }) } as any;
            const records = [{ id: '1' }, { id: '2' }] as any[];
            await expect(mongo.getNewRecords(controller, records, () => false)).rejects.toThrow('Failed to query records');
        });

        it('should filter out existing records', async () => {
            const controller = {
                findAll: vi.fn().mockResolvedValue({
                    success: true,
                    result: [{ id: '1', name: 'existing' }],
                }),
            } as any;
            const records = [{ id: '1', name: 'existing' }, { id: '2', name: 'new' }] as any[];
            const result = await mongo.getNewRecords(controller, records, (existing, newRec) => existing.id === newRec.id);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });
    });

    describe('getExistingRecords', () => {
        it('should throw when findAll fails', async () => {
            const controller = { findAll: vi.fn().mockResolvedValue({ success: false }) } as any;
            await expect(mongo.getExistingRecords(controller, [{ id: '1' }] as any[], () => true)).rejects.toThrow('Failed to query records');
        });

        it('should return matching existing records', async () => {
            const controller = {
                findAll: vi.fn().mockResolvedValue({
                    success: true,
                    result: [{ id: '1', name: 'a' }, { id: '2', name: 'b' }],
                }),
            } as any;
            const records = [{ id: '1', name: 'a' }] as any[];
            const result = await mongo.getExistingRecords(controller, records, (existing, newRec) => existing.id === newRec.id);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('createGenericSchema', () => {
        it('should create a schema with id, isDel, timestamps', () => {
            const mockSchema = { add: vi.fn(), statics: {}, virtual: vi.fn() };
            /**
             *
             */
            function MockSchema(definition: any) {
                if (definition?.id?.default) {
                    const uuid = definition.id.default();
                    expect(typeof uuid).toBe('string');
                    expect(uuid.length).toBeGreaterThan(10);
                }
                return mockSchema;
            }
            const mockMongoose = { Schema: MockSchema } as any;
            const result = mongo.createGenericSchema(mockMongoose);
            expect(result).toBeDefined();
            expect(result).toBe(mockSchema);
        });
    });

    /**
     * Shared mock factory for mongoose-like objects used across createSchema and createModel tests.
     */
    function createBaseMockMongoose(schemaOverrides: Record<string, unknown> = {}) {
        const mockVirtual = { get: vi.fn().mockReturnThis() };
        const mockSchema = {
            add: vi.fn(),
            statics: {} as Record<string, unknown>,
            virtual: vi.fn(() => mockVirtual),
            ...schemaOverrides,
        };
        /**
         *
         */
        function MockSchema() {
            return mockSchema;
        }
        return { MockSchema, mockSchema, mockVirtual };
    }

    describe('createSchema', () => {
        /**
         *
         */
        function createMockMongoose() {
            const { MockSchema, mockSchema, mockVirtual } = createBaseMockMongoose();
            return {
                mongoose: { Schema: MockSchema } as any,
                mockSchema,
                mockVirtual,
            };
        }

        it('should create schema with toJSON and toObject virtuals enabled', () => {
            const { mongoose, mockSchema } = createMockMongoose();
            const result = mongo.createSchema({ mongoose, schema: { name: String } as any });
            // The schema returned should be the mockSchema from our constructor
            expect(result).toBe(mockSchema);
        });

        it('should add generic schema when standalone is false', () => {
            const { mongoose, mockSchema } = createMockMongoose();
            mongo.createSchema({ mongoose, schema: { name: String } as any, standalone: false });
            expect(mockSchema.add).toHaveBeenCalled();
        });

        it('should not add generic schema when standalone is true', () => {
            const { mongoose, mockSchema } = createMockMongoose();
            mongo.createSchema({ mongoose, schema: { name: String } as any, standalone: true });
            expect(mockSchema.add).not.toHaveBeenCalled();
        });

        it('should set up static virtuals (non-dynamic)', () => {
            const { mongoose, mockSchema, mockVirtual } = createMockMongoose();
            const getFn = vi.fn();
            mongo.createSchema({
                mongoose,
                schema: {} as any,
                virtuals: [{ name: 'fullName', options: { ref: 'User', localField: 'id', foreignField: 'userId' }, get: getFn }],
            });
            expect(mockSchema.virtual).toHaveBeenCalledWith('fullName', expect.any(Object));
            expect(mockVirtual.get).toHaveBeenCalledWith(getFn);
        });

        it('should set up dynamic virtuals (ref is function)', () => {
            const { mongoose, mockSchema, mockVirtual } = createMockMongoose();
            mongo.createSchema({
                mongoose,
                schema: {} as any,
                virtuals: [{ name: 'entity', options: { ref: () => 'User', localField: 'id', foreignField: 'entityId' } }],
            });
            expect(mockSchema.virtual).toHaveBeenCalledWith('entity');
            expect(mockSchema.statics['_dynamicVirtuals']).toBeDefined();
            expect(mockVirtual.get).toHaveBeenCalled(); // Getter registered
        });

        it('should use custom get for dynamic virtuals', () => {
            const { mongoose, mockVirtual } = createMockMongoose();
            const customGet = vi.fn();
            mongo.createSchema({
                mongoose,
                schema: {} as any,
                virtuals: [{ name: 'entity', options: { ref: () => 'User', localField: 'id', foreignField: 'entityId' }, get: customGet }],
            });
            expect(mockVirtual.get).toHaveBeenCalledWith(customGet);
        });

        it('should set up static virtuals without get', () => {
            const { mongoose, mockSchema, mockVirtual } = createMockMongoose();
            mongo.createSchema({
                mongoose,
                schema: {} as any,
                virtuals: [{ name: 'fullName', options: { ref: 'User', localField: 'id', foreignField: 'userId' } }],
            });
            expect(mockSchema.virtual).toHaveBeenCalledWith('fullName', expect.any(Object));
            expect(mockVirtual.get).not.toHaveBeenCalled();
        });

        it('should setup dynamic virtual without get using fallback logic', () => {
            const { mongoose, mockVirtual } = createMockMongoose();
            mongo.createSchema({
                mongoose,
                schema: {} as any,
                virtuals: [{ name: 'entity', options: { ref: () => 'User', localField: 'id', foreignField: 'entityId' } }],
            });

            expect(mockVirtual.get).toHaveBeenCalled();
            const getFn = mockVirtual.get.mock.calls[0]?.[0] as any;

            // when no populated object
            expect(getFn.call({})).toEqual([]);
            // when array expected
            expect(getFn.call({ _populated: { entity: ['1'] } })).toEqual(['1']);

            mongo.createSchema({
                mongoose,
                schema: {} as any,
                virtuals: [{ name: 'entityOne', options: { justOne: true, ref: () => 'User', localField: 'id', foreignField: 'entityId' } }],
            });
            const getFnOne = mockVirtual.get.mock.calls[1]?.[0] as any;
            expect(getFnOne.call({})).toBeNull();
        });
    });

    describe('createModel', () => {
        /**
         *
         */
        function createMockMongoose(existingModels: Record<string, any> = {}) {
            const { MockSchema, mockSchema } = createBaseMockMongoose({
                plugin: vi.fn(),
                pre: vi.fn(),
                post: vi.fn(),
            });
            return {
                mongoose: {
                    Schema: MockSchema,
                    model: vi.fn(() => ({ modelName: 'Test', schema: mockSchema })),
                    models: { ...existingModels },
                } as any,
                mockSchema: mockSchema as any,
            };
        }

        it('should throw when name is not provided', () => {
            const { mongoose } = createMockMongoose();
            expect(() => mongo.createModel({ mongoose, name: '', schema: {} as any })).toThrow('Model name is required.');
        });

        it('should return existing model if already registered', () => {
            const existingModel = { modelName: 'User' };
            const { mongoose } = createMockMongoose({ User: existingModel });
            const result = mongo.createModel({ mongoose, name: 'User', schema: {} as any });
            expect(result).toBe(existingModel);
        });

        it('should create a new model with schema and plugins', () => {
            const { mongoose, mockSchema } = createMockMongoose();
            const result = mongo.createModel({ mongoose, name: 'Post', schema: {} as any });
            expect(mongoose.model).toHaveBeenCalledWith('Post', mockSchema);
            expect(mockSchema.plugin).toHaveBeenCalled(); // pagination + aggregate
            expect(result).toBeDefined();
        });

        it('should not apply plugins when pagination and aggregate are false', () => {
            const { mongoose, mockSchema } = createMockMongoose();
            mongo.createModel({ mongoose, name: 'Simple', schema: {} as any, pagination: false, aggregate: false });
            expect(mockSchema.plugin).not.toHaveBeenCalled();
        });

        it('should apply middlewares', () => {
            const { mongoose, mockSchema } = createMockMongoose();
            const preFn = vi.fn();
            mongo.createModel({ mongoose, name: 'Hooked', schema: {} as any, middlewares: [{ method: 'save', pre: preFn }] });
            expect(mockSchema.pre).toHaveBeenCalledWith('save', preFn);
        });

        it('should store virtual configs on model when virtuals provided', () => {
            const { mongoose } = createMockMongoose();
            const virtuals = [{ name: 'avatar', options: { ref: 'Media', localField: 'id', foreignField: 'entityId' } }];
            const result = mongo.createModel({ mongoose, name: 'WithVirtuals', schema: {} as any, virtuals: virtuals as any });
            expect((result as any)._virtualConfigs).toEqual(virtuals);
        });
    });

    describe('health', () => {
        /**
         * Creates a mock mongoose instance with configurable connection state.
         */
        function createMockMongooseForHealth(overrides: Record<string, unknown> = {}) {
            return {
                connection: {
                    readyState: 1,
                    host: 'localhost',
                    name: 'testdb',
                    ...overrides,
                },
                models: { User: {}, Post: {} },
            } as any;
        }

        it('should return basic health stats', () => {
            const mockMongoose = createMockMongooseForHealth();
            const result = mongo.health(mockMongoose);
            expect(result['readyState']).toBe(1);
            expect(result['host']).toBe('localhost');
            expect(result['name']).toBe('testdb');
            expect(result['models']).toBe(2);
            expect(result['pool']).toBeNull();
            expect(result['poolMetricsAvailable']).toBe(false);
        });

        it('should extract pool metrics from topology servers', () => {
            const serversMap = new Map();
            serversMap.set('srv1', {
                s: {
                    pool: {
                        totalConnectionCount: 10,
                        availableConnectionCount: 7,
                    },
                },
            });
            serversMap.set('srv2', {
                s: {
                    pool: {
                        totalConnectionCount: 5,
                        availableConnectionCount: 3,
                    },
                },
            });

            const mockMongoose = createMockMongooseForHealth({
                getClient: () => ({
                    topology: { s: { servers: serversMap } },
                }),
            });

            const result = mongo.health(mockMongoose);
            expect(result['pool']).toEqual({ totalConnections: 15, availableConnections: 10 });
            expect(result['poolMetricsAvailable']).toBe(true);
        });

        it('should handle servers with missing pool data', () => {
            const serversMap = new Map();
            serversMap.set('srv1', { s: {} }); // No pool on this server

            const mockMongoose = createMockMongooseForHealth({
                getClient: () => ({
                    topology: { s: { servers: serversMap } },
                }),
            });

            const result = mongo.health(mockMongoose);
            expect(result['pool']).toEqual({ totalConnections: 0, availableConnections: 0 });
            expect(result['poolMetricsAvailable']).toBe(true);
        });

        it('should return null pool when topology is unavailable', () => {
            const mockMongoose = createMockMongooseForHealth({
                getClient: () => ({ topology: null }),
            });

            const result = mongo.health(mockMongoose);
            expect(result['pool']).toBeNull();
            expect(result['poolMetricsAvailable']).toBe(false);
        });

        it('should fallback to .client when getClient is unavailable', () => {
            const serversMap = new Map();
            serversMap.set('srv1', {
                s: {
                    pool: {
                        totalConnectionCount: 3,
                        availableConnectionCount: 2,
                    },
                },
            });

            const mockMongoose = createMockMongooseForHealth({
                client: {
                    topology: { s: { servers: serversMap } },
                },
            });

            const result = mongo.health(mockMongoose);
            expect(result['pool']).toEqual({ totalConnections: 3, availableConnections: 2 });
            expect(result['poolMetricsAvailable']).toBe(true);
        });

        it('should gracefully handle errors during pool metric extraction', () => {
            const mockMongoose = createMockMongooseForHealth({
                getClient: () => {
                    throw new Error('driver internal error');
                },
            });

            const result = mongo.health(mockMongoose);
            expect(result['pool']).toBeNull();
            expect(result['poolMetricsAvailable']).toBe(false);
            expect(result['readyState']).toBe(1);
        });

        it('should handle disconnected state', () => {
            const mockMongoose = createMockMongooseForHealth({ readyState: 0 });
            const result = mongo.health(mockMongoose);
            expect(result['readyState']).toBe(0);
        });

        it('should handle pool with partial metrics (missing availableConnectionCount)', () => {
            const serversMap = new Map();
            serversMap.set('srv1', {
                s: {
                    pool: {
                        totalConnectionCount: 5,
                        // availableConnectionCount is undefined
                    },
                },
            });

            const mockMongoose = createMockMongooseForHealth({
                getClient: () => ({
                    topology: { s: { servers: serversMap } },
                }),
            });

            const result = mongo.health(mockMongoose);
            expect(result['pool']).toEqual({ totalConnections: 5, availableConnections: 0 });
        });
    });
    describe('fetchAllRecords', () => {
        it('should increment skip when truncated and result equals batchSize', async () => {
            let callCount = 0;
            const controller = {
                findAll: vi.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        return Promise.resolve({ success: true, result: Array.from({ length: 2 }).fill({ id: '1' }), truncated: true });
                    }
                    return Promise.resolve({ success: true, result: [], truncated: false });
                }),
            } as any;

            const records = await mongo.fetchAllRecords(controller, {}, 2);
            expect(controller.findAll).toHaveBeenCalledTimes(2);
            expect(controller.findAll).toHaveBeenNthCalledWith(1, {}, { skip: 0, limit: 2 });
            expect(controller.findAll).toHaveBeenNthCalledWith(2, {}, { skip: 2, limit: 2 });
            expect(records).toHaveLength(2);
        });
    });
});
