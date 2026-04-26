export * from './mongo.controller.mongoose.js';
/**
 * Re-exports both MongoDB controller implementations and the shared interface.
 * - I_MongoController: Shared interface for both controller types
 * - MongoController: Native MongoDB driver operations
 * - MongooseController: Mongoose ORM with pagination, aggregation, and slug generation
 */
export * from './mongo.controller.native.js';
export * from './mongo.controller.type.js';
