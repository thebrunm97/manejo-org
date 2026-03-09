import { describe, it, expect } from 'vitest';
import { formatPhoneBR } from '../masks';

describe('formatPhoneBR utility', () => {
    it('should return empty string for empty input', () => {
        expect(formatPhoneBR('')).toBe('');
    });

    it('should format short numbers progressively', () => {
        expect(formatPhoneBR('1')).toBe('(1');
        expect(formatPhoneBR('11')).toBe('(11');
        expect(formatPhoneBR('119')).toBe('(11) 9');
    });

    it('should format mid-length numbers', () => {
        expect(formatPhoneBR('119999')).toBe('(11) 9999');
        expect(formatPhoneBR('1199999')).toBe('(11) 9999-9');
    });

    it('should format landline numbers (10 digits)', () => {
        expect(formatPhoneBR('1133334444')).toBe('(11) 3333-4444');
    });

    it('should format mobile numbers (11 digits)', () => {
        expect(formatPhoneBR('11999998888')).toBe('(11) 99999-8888');
    });

    it('should handle "55" prefix as DDI when it has 12 or more digits', () => {
        // 55 + 11 digits = 13 digits total
        expect(formatPhoneBR('5511999998888')).toBe('+55 (11) 99999-8888');
    });

    it('should NOT handle "55" as DDI if total length is less than 12', () => {
        // 5511 -> (55) 11
        expect(formatPhoneBR('5511')).toBe('(55) 11');
    });

    it('should strip non-numeric characters before formatting', () => {
        expect(formatPhoneBR('(11) 99999-8888')).toBe('(11) 99999-8888');
        expect(formatPhoneBR('11.99999-8888')).toBe('(11) 99999-8888');
    });

    it('should limit input to 11 digits (excluding 55 prefix)', () => {
        expect(formatPhoneBR('119999988887777')).toBe('(11) 99999-8888');
    });
});
