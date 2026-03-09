import { describe, it, expect } from 'vitest';
import { deepMerge } from '../deepMerge';

describe('deepMerge utility', () => {
    it('should merge two simple objects', () => {
        const target = { a: 1, b: 2 };
        const source = { b: 3, c: 4 };
        const result = deepMerge(target, source);
        expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects recursively', () => {
        const target = {
            user: {
                name: 'John',
                address: { city: 'New York' }
            }
        };
        const source = {
            user: {
                age: 30,
                address: { zip: '10001' }
            }
        };
        const result = deepMerge(target, source);
        expect(result).toEqual({
            user: {
                name: 'John',
                age: 30,
                address: {
                    city: 'New York',
                    zip: '10001'
                }
            }
        });
    });

    it('should overwrite arrays instead of merging them', () => {
        const target = { items: [1, 2] };
        const source = { items: [3] };
        const result = deepMerge(target, source);
        expect(result.items).toEqual([3]);
    });

    it('should handle undefined values in source correctly', () => {
        const target = { a: 1 };
        const source = { a: undefined, b: 2 };
        const result = deepMerge(target, source);
        // According to deepMerge.ts line 22: output[key] = sValue !== undefined ? sValue : tValue;
        expect(result.a).toBe(1);
        expect(result.b).toBe(2);
    });

    it('should handle null values in source correctly', () => {
        const target = { a: { b: 1 } };
        const source = { a: null };
        const result = deepMerge(target, source);
        expect(result.a).toBe(null);
    });

    it('should not mutate original target object', () => {
        const target = { a: 1 };
        const source = { a: 2 };
        deepMerge(target, source);
        expect(target.a).toBe(1);
    });
});
