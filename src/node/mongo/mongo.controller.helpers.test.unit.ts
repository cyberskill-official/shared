import { describe, expect, it } from 'vitest';

import { RESPONSE_STATUS } from '#constant/index.js';

import {
    wrapBadRequest,
    wrapError,
    wrapNotFound,
    wrapSuccess,
    wrapTruncated,
} from './mongo.controller.helpers.js';

describe('mongo.controller.helpers', () => {
    describe('wrapSuccess', () => {
        it('should wrap a result in a success response', () => {
            const result = { id: 1, name: 'test' };
            const response = wrapSuccess(result);

            expect(response).toEqual({
                success: true,
                result,
            });
        });
    });

    describe('wrapTruncated', () => {
        it('should wrap a result in a success response with truncated flag', () => {
            const result = [{ id: 1 }, { id: 2 }];
            const response = wrapTruncated(result);

            expect(response).toEqual({
                success: true,
                result,
                truncated: true,
            });
        });
    });

    describe('wrapNotFound', () => {
        it('should generate a not found response with the model name', () => {
            const response = wrapNotFound('User');

            expect(response).toEqual({
                success: false,
                message: 'User not found',
                code: RESPONSE_STATUS.NOT_FOUND.CODE,
            });
        });
    });

    describe('wrapError', () => {
        it('should generate an internal server error response with a message', () => {
            const response = wrapError('Something went wrong');

            expect(response).toEqual({
                success: false,
                message: 'Something went wrong',
                code: RESPONSE_STATUS.INTERNAL_SERVER_ERROR.CODE,
            });
        });
    });

    describe('wrapBadRequest', () => {
        it('should generate a bad request error response with a message', () => {
            const response = wrapBadRequest('Invalid input');

            expect(response).toEqual({
                success: false,
                message: 'Invalid input',
                code: RESPONSE_STATUS.BAD_REQUEST.CODE,
            });
        });
    });
});
