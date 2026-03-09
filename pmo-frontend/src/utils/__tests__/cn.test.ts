import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn utility', () => {
    it('should combine class names', () => {
        expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle conditional class names', () => {
        expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2');
    });

    it('should merge tailwind classes correctly using tailwind-merge', () => {
        // tailwind-merge should resolve conflicts, e.g., p-2 and p-4 -> p-4
        expect(cn('px-2 py-2', 'p-4')).toBe('p-4');
    });

    it('should handle undefined, null and empty strings', () => {
        expect(cn('class1', undefined, null, '')).toBe('class1');
    });

    it('should handle arrays and objects', () => {
        expect(cn(['class1', 'class2'], { 'class3': true, 'class4': false })).toBe('class1 class2 class3');
    });
});
