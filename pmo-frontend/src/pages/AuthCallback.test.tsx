import { describe, it, expect } from 'vitest';
import { destinoSeguro } from './AuthCallback';

describe('destinoSeguro', () => {
    it('aceita só destinos da lista', () => {
        expect(destinoSeguro('/caderno')).toBe('/caderno');
        expect(destinoSeguro(null)).toBe('/');
        expect(destinoSeguro('//evil.com')).toBe('/');
        expect(destinoSeguro('https://evil.com')).toBe('/');
        expect(destinoSeguro('/admin')).toBe('/');
    });
});
