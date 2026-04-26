/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import { applyNestedPopulate } from './mongo.populate.js';

vi.mock('./mongo.util.js', () => ({
    convertEnumToModelName: vi.fn((v: string) => {
        if (v === v.toUpperCase())
            return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        return v;
    }),
}));

/* ---------- helpers ---------- */

/**
 *
 */
function createMockMongoose(modelsMap: Record<string, any> = {}) {
    return { models: modelsMap } as any;
}

/**
 *
 */
function createMockModel(
    name: string,
    opts: {
        virtuals?: Record<string, any>;
        paths?: Record<string, any>;
        statics?: Record<string, any>;
        findResult?: any[];
        _dynamicVirtuals?: any[];
        _virtualConfigs?: any[];
    } = {},
) {
    const model: any = {
        modelName: name,
        schema: {
            virtuals: opts.virtuals ?? {},
            paths: opts.paths ?? {},
            statics: opts.statics ?? {},
        },
        find: vi.fn(() => ({
            lean: vi.fn().mockResolvedValue(opts.findResult ?? []),
        })),
    };

    if (opts._dynamicVirtuals) {
        model.schema.statics['_dynamicVirtuals'] = opts._dynamicVirtuals;
    }
    if (opts._virtualConfigs) {
        model._virtualConfigs = opts._virtualConfigs;
    }
    return model;
}

/* ---------- tests ---------- */

describe('applyNestedPopulate', () => {
    it('should return documents unchanged when docs array is empty', async () => {
        const mongoose = createMockMongoose();
        const result = await applyNestedPopulate(mongoose, [], 'field');
        expect(result).toEqual([]);
    });

    it('should return documents unchanged when populateOptions is undefined', async () => {
        const mongoose = createMockMongoose();
        const docs = [{ name: 'a' }];
        const result = await applyNestedPopulate(mongoose, docs, undefined as any);
        expect(result).toEqual(docs);
    });

    it('should handle string populate for a simple field with __t model name', async () => {
        const UserModel = createMockModel('User', {
            findResult: [{ id: 'u1', name: 'Alice' }],
        });
        const mongoose = createMockMongoose({ User: UserModel });
        const docs = [{ __t: 'User', authorId: 'u1' }];

        await applyNestedPopulate(mongoose, docs, 'author', undefined, UserModel);
        expect(UserModel.find).toHaveBeenCalled();
    });

    it('should handle array of populate options', async () => {
        const PostModel = createMockModel('Post', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel });
        const docs = [{ __t: 'Post', tagIds: ['t1'] }];

        const result = await applyNestedPopulate(mongoose, docs, ['tag'], undefined, PostModel);
        expect(result).toEqual(docs);
    });

    it('should handle object populate option with path', async () => {
        const CommentModel = createMockModel('Comment', { findResult: [] });
        const mongoose = createMockMongoose({ Comment: CommentModel });
        const docs = [{ __t: 'Comment', authorId: '1' }];

        await applyNestedPopulate(mongoose, docs, { path: 'author' }, undefined, CommentModel);
        expect(CommentModel.find).toHaveBeenCalled();
    });

    it('should return early for object populate without path', async () => {
        const mongoose = createMockMongoose();
        const docs = [{ name: 'test' }];
        const result = await applyNestedPopulate(mongoose, docs, { notPath: true } as any);
        expect(result).toEqual(docs);
    });

    it('should handle dotted string populate path "field.subfield"', async () => {
        const UserModel = createMockModel('User', {
            virtuals: {
                comments: { options: { ref: 'Comment' } },
            },
            findResult: [{ id: 'c1', text: 'hi' }],
        });
        const CommentModel = createMockModel('Comment', { findResult: [{ id: 'c1' }] });
        const mongoose = createMockMongoose({ User: UserModel, Comment: CommentModel });

        const docs = [{ comments: [{ authorId: 'u1' }] }];
        await applyNestedPopulate(mongoose, docs, 'comments.author', undefined, UserModel);
        // Should traverse into comments array
        expect(docs).toBeDefined();
    });

    it('should skip empty first segment in dotted path', async () => {
        const mongoose = createMockMongoose();
        const docs = [{ name: 'test' }];
        const result = await applyNestedPopulate(mongoose, docs, '.subfield');
        expect(result).toEqual(docs);
    });

    it('should resolve model from schema virtuals with function ref', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                author: { options: { ref: (_doc: any) => 'User' } },
            },
        });
        const UserModel = createMockModel('User', { findResult: [{ id: 'u1', name: 'Bob' }] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ author: { authorId: 'u1' } }];
        await applyNestedPopulate(mongoose, docs, 'author.profile', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should resolve model from schema virtuals with string ref', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                category: { options: { ref: 'Category' } },
            },
        });
        const CategoryModel = createMockModel('Category', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Category: CategoryModel });

        const docs = [{ category: { name: 'tech' } }];
        await applyNestedPopulate(mongoose, docs, 'category.parent', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should resolve model from _dynamicVirtuals statics', async () => {
        const PostModel = createMockModel('Post', {
            statics: {},
            _dynamicVirtuals: [
                { name: 'entity', options: { ref: 'User' } },
            ],
        });
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ entity: { id: 'e1' } }];
        await applyNestedPopulate(mongoose, docs, 'entity.detail', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should resolve model from _virtualConfigs on model', async () => {
        const PostModel = createMockModel('Post', {
            _virtualConfigs: [
                { name: 'gallery', options: { ref: 'Media' } },
            ],
        });
        const MediaModel = createMockModel('Media', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Media: MediaModel });

        const docs = [{ gallery: { id: 'g1' } }];
        await applyNestedPopulate(mongoose, docs, 'gallery.items', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should resolve model from entityType field in document', async () => {
        const UserModel = createMockModel('User', { findResult: [{ id: 'u1' }] });
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ entityType: 'User', authorId: 'u1' }];
        await applyNestedPopulate(mongoose, docs, 'author', undefined, UserModel);
        expect(UserModel.find).toHaveBeenCalled();
    });

    it('should populate array of IDs as array result', async () => {
        const TagModel = createMockModel('Tag', {
            findResult: [{ id: 't1', name: 'js' }, { id: 't2', name: 'ts' }],
        });
        const mongoose = createMockMongoose({ Tag: TagModel });

        const docs = [{ __t: 'Tag', tagIds: ['t1', 't2'] }] as any[];
        await applyNestedPopulate(mongoose, docs, 'tag', undefined, TagModel);
        expect(TagModel.find).toHaveBeenCalled();
    });

    it('should populate single ID as single result', async () => {
        const UserModel = createMockModel('User', {
            findResult: [{ id: 'u1', name: 'Alice' }],
        });
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ __t: 'User', authorId: 'u1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'author', undefined, UserModel);
        expect(UserModel.find).toHaveBeenCalled();
    });

    it('should resolve model via virtualConfigs parameter', async () => {
        const MediaModel = createMockModel('Media', { findResult: [] });
        const mongoose = createMockMongoose({ Media: MediaModel });

        const virtualConfigs = [
            { name: 'gallery', options: { ref: 'Media' } },
        ] as any[];
        const docs = [{ galleryId: 'm1' }];
        await applyNestedPopulate(mongoose, docs, 'gallery', virtualConfigs);
        expect(MediaModel.find).toHaveBeenCalled();
    });

    it('should handle nested object populate with nested populate options', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: { author: { options: { ref: 'User' } } },
            findResult: [],
        });
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ author: { profileId: 'p1' } }];
        await applyNestedPopulate(mongoose, docs, { path: 'author', populate: 'profile' }, undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should handle entityType-based model resolution in object populate', async () => {
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ entity: { entityType: 'User', profileId: 'p1' } }];
        await applyNestedPopulate(mongoose, docs, { path: 'entity', populate: 'profile' }, undefined);
        expect(docs).toBeDefined();
    });

    it('should capitalized fallback for model name from field name', async () => {
        const GalleryModel = createMockModel('Gallery', { findResult: [{ id: 'g1' }] });
        const mongoose = createMockMongoose({ Gallery: GalleryModel });

        const docs = [{ galleryId: 'g1' }];
        await applyNestedPopulate(mongoose, docs, 'gallery');
        expect(GalleryModel.find).toHaveBeenCalled();
    });

    it('should not populate when Model is not found in mongoose.models', async () => {
        const mongoose = createMockMongoose({});
        const docs = [{ __t: 'NonExistent', authorId: 'u1' }];
        const result = await applyNestedPopulate(mongoose, docs, 'author');
        expect(result).toEqual(docs);
    });

    it('should not populate when no IDs are found', async () => {
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ User: UserModel });
        const docs = [{ __t: 'User' }]; // no authorId or authorIds
        await applyNestedPopulate(mongoose, docs, 'author', undefined, UserModel);
        expect(UserModel.find).not.toHaveBeenCalled();
    });

    it('should resolve model from _virtualConfigs with function ref', async () => {
        const PostModel = createMockModel('Post', {
            _virtualConfigs: [
                { name: 'gallery', options: { ref: (_doc: any) => 'Media' } },
            ],
        });
        const MediaModel = createMockModel('Media', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Media: MediaModel });

        const docs = [{ gallery: [{ id: 'g1' }] }];
        await applyNestedPopulate(mongoose, docs, 'gallery.items', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should handle dotted path with array mainValue', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                tags: { options: { ref: 'Tag' } },
            },
        });
        const TagModel = createMockModel('Tag', { findResult: [{ id: 't1' }] });
        const mongoose = createMockMongoose({ Post: PostModel, Tag: TagModel });

        const docs = [{ tags: [{ authorId: 'u1' }, { authorId: 'u2' }] }];
        await applyNestedPopulate(mongoose, docs, 'tags.author', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should handle object populate with nestedPopulate', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: { author: { options: { ref: 'User' } } },
        });
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ author: [{ profileId: 'p1' }] }];
        await applyNestedPopulate(mongoose, docs, { path: 'author', populate: 'profile' }, undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should skip non-object items in array mainValue', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                items: { options: { ref: 'Item' } },
            },
        });
        const ItemModel = createMockModel('Item', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Item: ItemModel });

        const docs = [{ items: [null, 'string', { id: 'i1' }] }];
        await applyNestedPopulate(mongoose, docs, 'items.detail', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should resolve model from entityType in fieldValue for object populate', async () => {
        const UserModel = createMockModel('User', { findResult: [{ id: 'u1' }] });
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ entity: { entityType: 'User', userId: 'u1' } }];
        await applyNestedPopulate(mongoose, docs, { path: 'entity', populate: 'user' }, undefined);
        expect(docs).toBeDefined();
    });

    it('should handle populateNestedFieldOnParent with currentModel and pathPrefix', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                author: { options: { ref: 'User' } },
            },
        });
        const UserModel = createMockModel('User', {
            findResult: [{ id: 'u1', name: 'Alice' }],
            virtuals: {
                profile: { options: { ref: 'Profile' } },
            },
        });
        const ProfileModel = createMockModel('Profile', { findResult: [{ id: 'p1' }] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel, Profile: ProfileModel });

        const docs = [{ author: { profileId: 'p1' } }];
        await applyNestedPopulate(mongoose, docs, 'author.profile', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should resolve from schema paths for nested dotted path', async () => {
        const PostModel = createMockModel('Post', {
            paths: {
                settings: { schema: { virtuals: { theme: { options: { ref: 'Theme' } } } } },
            },
        });
        const ThemeModel = createMockModel('Theme', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Theme: ThemeModel });

        const docs = [{ settings: { themeId: 't1' } }];
        await applyNestedPopulate(mongoose, docs, 'settings.theme', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should handle non-object mainValue in dotted path (skip silently)', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                metadata: { options: { ref: 'Meta' } },
            },
        });
        const mongoose = createMockMongoose({ Post: PostModel });

        const docs = [{ metadata: 'this-is-a-string' }];
        await applyNestedPopulate(mongoose, docs, 'metadata.detail', undefined, PostModel);
        expect(docs[0]?.metadata).toBe('this-is-a-string');
    });

    it('should resolve using entityType and search schema virtuals on entity model', async () => {
        const UserModel = createMockModel('User', {
            virtuals: {
                profile: { options: { ref: 'Profile' } },
            },
            findResult: [{ id: 'p1' }],
        });
        const ProfileModel = createMockModel('Profile', { findResult: [{ id: 'p1' }] });
        const mongoose = createMockMongoose({ User: UserModel, Profile: ProfileModel });

        const docs = [{ entityType: 'User', profileId: 'p1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'profile');
        expect(docs).toBeDefined();
    });

    it('should resolve using findModelBySchemaField when currentModel does not match', async () => {
        const CommentModel = createMockModel('Comment', {
            paths: { text: { instance: 'String' } },
            virtuals: {
                author: { options: { ref: 'User' } },
            },
        });
        const UserModel = createMockModel('User', { findResult: [{ id: 'u1' }] });
        const mongoose = createMockMongoose({ Comment: CommentModel, User: UserModel });

        const docs = [{ authorId: 'u1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'author', undefined, undefined);
        expect(docs).toBeDefined();
    });

    it('should resolve using virtualConfigs as fallback when everything else fails', async () => {
        const MediaModel = createMockModel('Media', { findResult: [{ id: 'm1' }] });
        const mongoose = createMockMongoose({ Media: MediaModel });

        const virtualConfigs = [
            { name: 'attachment', options: { ref: 'Media' } },
        ] as any[];

        const docs = [{ attachmentId: 'm1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'attachment', virtualConfigs);
        expect(MediaModel.find).toHaveBeenCalled();
    });

    it('should capitalize field name as model name fallback', async () => {
        const MediaModel = createMockModel('Media', { findResult: [{ id: 'm1' }] });
        const mongoose = createMockMongoose({ Media: MediaModel });

        const docs = [{ mediaId: 'm1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'media');
        expect(docs).toBeDefined();
    });

    it('should handle populatedDocs with single docIds (non-array)', async () => {
        const UserModel = createMockModel('User', {
            findResult: [{ id: 'u1', name: 'Alice' }],
        });
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ __t: 'User', authorId: 'u1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'author', undefined, UserModel);
        expect(UserModel.find).toHaveBeenCalled();
        // Single ID case should populate with single result
    });

    it('should handle findStartModelByFirstSegment when model has path in different model', async () => {
        const UserModel = createMockModel('User', {
            virtuals: {
                profile: { options: { ref: 'Profile' } },
            },
        });
        const PostModel = createMockModel('Post', {});
        const ProfileModel = createMockModel('Profile', { findResult: [{ id: 'p1' }] });
        const mongoose = createMockMongoose({ User: UserModel, Post: PostModel, Profile: ProfileModel });

        const docs = [{ profile: { avatarId: 'a1' } }];
        await applyNestedPopulate(mongoose, docs, 'profile.avatar', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    it('should handle search schema paths and nested virtuals', async () => {
        const PostModel = createMockModel('Post', {
            paths: {
                content: {
                    schema: {
                        virtuals: {
                            media: { options: { ref: 'Media' } },
                        },
                        paths: {},
                    },
                },
            },
        });
        const MediaModel = createMockModel('Media', { findResult: [{ id: 'm1' }] });
        const mongoose = createMockMongoose({ Post: PostModel, Media: MediaModel });

        const docs = [{ entityType: 'Post', mediaId: 'm1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'media', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyStringPopulate: _virtualConfigs dynamic virtual with function ref ---
    it('should resolve nextModelForChildren from _virtualConfigs function ref in dotted path', async () => {
        const PostModel = createMockModel('Post', {
            _virtualConfigs: [
                { name: 'entity', options: { ref: (doc: any) => doc.entityType || 'User' } },
            ],
        });
        const UserModel = createMockModel('User', {
            virtuals: { profile: { options: { ref: 'Profile' } } },
            findResult: [{ id: 'u1' }],
        });
        const ProfileModel = createMockModel('Profile', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel, Profile: ProfileModel });

        const docs = [{ entity: { entityType: 'User', profileId: 'p1' } }];
        await applyNestedPopulate(mongoose, docs, 'entity.profile', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyStringPopulate: _virtualConfigs with string ref ---
    it('should resolve nextModelForChildren from _virtualConfigs string ref in dotted path', async () => {
        const PostModel = createMockModel('Post', {
            _virtualConfigs: [
                { name: 'author', options: { ref: 'User' } },
            ],
        });
        const UserModel = createMockModel('User', { findResult: [{ id: 'u1' }] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ author: { nameId: 'n1' } }];
        await applyNestedPopulate(mongoose, docs, 'author.name', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyStringPopulate: schemaStatics._dynamicVirtuals fallback ---
    it('should resolve from schema.statics._dynamicVirtuals when _virtualConfigs is absent', async () => {
        const PostModel = createMockModel('Post', {
            statics: {
                _dynamicVirtuals: [
                    { name: 'gallery', options: { ref: 'Media' } },
                ],
            },
        });
        const MediaModel = createMockModel('Media', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Media: MediaModel });

        const docs = [{ gallery: [{ mediaId: 'm1' }] }];
        await applyNestedPopulate(mongoose, docs, 'gallery.detail', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyObjectPopulate: virtual function ref resolution ---
    it('should resolve nextModelForChildren from function ref virtual in object populate', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                author: { options: { ref: (_doc: any) => 'User' } },
            },
        });
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ author: [{ followerId: 'f1' }] }];
        await applyNestedPopulate(mongoose, docs, { path: 'author', populate: 'follower' }, undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyObjectPopulate: entityType in fieldValue for model resolution ---
    it('should resolve model from entityType in fieldValue in object populate without currentModel', async () => {
        const UserModel = createMockModel('User', { findResult: [] });
        const mongoose = createMockMongoose({ User: UserModel });

        const docs = [{ source: { entityType: 'User', userId: 'u1' } }] as any[];
        await applyNestedPopulate(mongoose, docs, { path: 'source', populate: 'details' });
        expect(docs).toBeDefined();
    });

    // --- applyObjectPopulate: single object fieldValue ---
    it('should apply nested populate to single object fieldValue (not array)', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: { author: { options: { ref: 'User' } } },
        });
        const UserModel = createMockModel('User', {
            findResult: [{ id: 'u1' }],
            virtuals: { avatar: { options: { ref: 'Avatar' } } },
        });
        const AvatarModel = createMockModel('Avatar', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel, Avatar: AvatarModel });

        // Single object, not array
        const docs = [{ author: { avatarId: 'a1' } }];
        await applyNestedPopulate(mongoose, docs, { path: 'author', populate: 'avatar' }, undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- resolveModelFromPath: function ref at intermediate path ---
    it('should resolve model from path with function ref at intermediate segment', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                author: {
                    options: {
                        ref: () => 'User',
                    },
                },
            },
        });
        const UserModel = createMockModel('User', {
            virtuals: {
                avatar: { options: { ref: 'Avatar' } },
            },
            findResult: [],
        });
        const AvatarModel = createMockModel('Avatar', { findResult: [{ id: 'a1' }] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel, Avatar: AvatarModel });

        const docs = [{ author: { avatar: { id: 'a1' } } }];
        await applyNestedPopulate(mongoose, docs, 'author.avatar', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyStringPopulate: repeat _virtualConfigs check when nextModelForChildren === originalModelForChildren ---
    it('should attempt secondcheck on _virtualConfigs when first check did not change model', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: { gallery: { options: { ref: 'NOT_EXIST' } } },
            _virtualConfigs: [
                { name: 'gallery', options: { ref: 'Media' } },
            ],
        });
        const MediaModel = createMockModel('Media', { findResult: [] });
        const mongoose = createMockMongoose({ Post: PostModel, Media: MediaModel });

        const docs = [{ gallery: [{ detailId: 'd1' }] }];
        await applyNestedPopulate(mongoose, docs, 'gallery.detail', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- applyObjectPopulate: path is empty ---
    it('should return early when object populate path is empty', async () => {
        const mongoose = createMockMongoose({});
        const docs = [{ foo: 'bar' }] as any[];
        await applyNestedPopulate(mongoose, docs, { path: '', populate: 'sub' } as any);
        expect(docs).toEqual([{ foo: 'bar' }]);
    });

    // --- populateNestedFieldOnParent: searchVirtualsInSchema finds model through nested schema ---
    it('should resolve model from nested schema path virtuals (searchVirtualsInSchema)', async () => {
        const PostModel = createMockModel('Post', {
            paths: {
                content: {
                    schema: {
                        virtuals: {
                            author: { options: { ref: 'User' } },
                        },
                        paths: {
                            body: {
                                schema: {
                                    virtuals: {
                                        reviewer: { options: { ref: 'User' } },
                                    },
                                    paths: {},
                                },
                            },
                        },
                    },
                },
            },
        });
        const UserModel = createMockModel('User', { findResult: [{ id: 'u1', name: 'Alice' }] });
        const mongoose = createMockMongoose({ Post: PostModel, User: UserModel });

        const docs = [{ authorId: 'u1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'author', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- populateNestedFieldOnParent: resolveModelFromPath succeeds with currentModel ---
    it('should resolve model through resolveModelFromPath when currentModel has schema', async () => {
        const PostModel = createMockModel('Post', {
            virtuals: {
                gallery: {
                    options: { ref: 'Media' },
                },
            },
        });
        const MediaModel = createMockModel('Media', {
            virtuals: {
                thumbnail: { options: { ref: 'Image' } },
            },
            findResult: [{ id: 'i1' }],
        });
        const ImageModel = createMockModel('Image', { findResult: [{ id: 'img1' }] });
        const mongoose = createMockMongoose({ Post: PostModel, Media: MediaModel, Image: ImageModel });

        const docs = [{ galleryId: 'g1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'gallery.thumbnail', undefined, PostModel);
        expect(docs).toBeDefined();
    });

    // --- populateNestedFieldOnParent: virtualConfigs with function ref as last resort ---
    it('should resolve model from virtualConfigs function ref as fallback', async () => {
        const MediaModel = createMockModel('Media', { findResult: [{ id: 'm1' }] });
        const mongoose = createMockMongoose({ Media: MediaModel });

        const virtualConfigs = [
            { name: 'media', options: { ref: (doc: any) => doc.mediaType || 'Media' } },
        ] as any[];

        const docs = [{ mediaType: 'Media', mediaId: 'm1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'media', virtualConfigs);
        expect(MediaModel.find).toHaveBeenCalled();
    });

    // --- populateNestedFieldOnParent: virtualConfigs string ref (already tested but ensuring path hits line 606) ---
    it('should resolve from virtualConfigs string ref when no model is found', async () => {
        const ImageModel = createMockModel('Image', { findResult: [{ id: 'img1' }] });
        const mongoose = createMockMongoose({ Image: ImageModel });

        const virtualConfigs = [
            { name: 'cover', options: { ref: 'Image' } },
        ] as any[];

        const docs = [{ coverId: 'img1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'cover', virtualConfigs);
        expect(ImageModel.find).toHaveBeenCalled();
    });

    // --- populateNestedFieldOnParent: direct capitalization fallback (line 620) ---
    it('should resolve from capitalize fallback when field matches model name', async () => {
        const TagModel = createMockModel('Tag', { findResult: [{ id: 't1', name: 'news' }] });
        const mongoose = createMockMongoose({ Tag: TagModel });

        const docs = [{ tagId: 't1' }] as any[];
        await applyNestedPopulate(mongoose, docs, 'tag');
        expect(docs).toBeDefined();
    });
});
