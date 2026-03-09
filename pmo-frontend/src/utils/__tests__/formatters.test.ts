import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatarTelefone,
    formatDateBR,
    formatarDataRelativa,
    obterSaudacao,
    formatSmartTotal,
    formatComplianceMessage
} from '../formatters';

describe('formatters utility', () => {
    describe('formatarTelefone', () => {
        it('should format whatsapp number correctly by hiding start', () => {
            expect(formatarTelefone('553499991234@c.us')).toBe('WHATSAPP ID: ****-1234');
        });

        it('should return "Conta Vinculada" for short numbers', () => {
            expect(formatarTelefone('123')).toBe('Conta Vinculada');
        });

        it('should return empty string for null/undefined/empty input', () => {
            expect(formatarTelefone(undefined)).toBe('');
            expect(formatarTelefone('')).toBe('');
        });
    });

    describe('formatDateBR', () => {
        it('should format YYYY-MM-DD correctly in pt-BR format', () => {
            const result = formatDateBR('2024-02-15');
            // pt-BR usually formats as "15 de fev. de 2024" or "15/02/2024" 
            // depends on the environment, but it should contain 15, 2024 and something for feb
            expect(result).toContain('15');
            expect(result).toContain('2024');
        });

        it('should use provided options', () => {
            const result = formatDateBR('2024-02-15', { day: '2-digit', month: '2-digit', year: 'numeric' });
            expect(result).toMatch(/15\/02\/2024/);
        });

        it('should return "-" for null/undefined/empty input', () => {
            expect(formatDateBR(null)).toBe('-');
            expect(formatDateBR(undefined)).toBe('-');
            expect(formatDateBR('')).toBe('-');
        });

        it('should handle ISO strings', () => {
            const result = formatDateBR('2024-02-15T10:00:00Z');
            expect(result).toContain('15');
        });
    });

    describe('formatarDataRelativa', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // Set to 2024-02-15 12:00:00 Local (assuming zero offset for test clarity)
            vi.setSystemTime(new Date('2024-02-15T12:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return "Agora mesmo" for dates less than 1 minute ago', () => {
            const now = new Date('2024-02-15T12:00:00Z');
            expect(formatarDataRelativa(now)).toBe('Agora mesmo');
        });

        it('should return relative minutes', () => {
            const minsAgo = new Date('2024-02-15T11:50:00Z');
            expect(formatarDataRelativa(minsAgo)).toBe('10 min atrás');
        });

        it('should return relative hours', () => {
            const hrsAgo = new Date('2024-02-15T09:00:00Z');
            expect(formatarDataRelativa(hrsAgo)).toBe('3h atrás');
        });

        it('should return relative days', () => {
            const daysAgo = new Date('2024-02-13T12:00:00Z');
            expect(formatarDataRelativa(daysAgo)).toBe('2 dias atrás');
        });

        it('should return fallback for null', () => {
            expect(formatarDataRelativa(null)).toBe('Nenhuma atividade recente');
        });
    });

    describe('obterSaudacao', () => {
        it('should return appropriate greeting for morning', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2024, 1, 15, 8)); // 8 AM
            expect(obterSaudacao()).toBe('Bom dia');
            vi.useRealTimers();
        });

        it('should return appropriate greeting for afternoon', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2024, 1, 15, 14)); // 2 PM
            expect(obterSaudacao()).toBe('Boa tarde');
            vi.useRealTimers();
        });

        it('should return appropriate greeting for night', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2024, 1, 15, 22)); // 10 PM
            expect(obterSaudacao()).toBe('Boa noite');
            vi.useRealTimers();
        });
    });

    describe('formatSmartTotal', () => {
        it('should convert and sum weights correctly', () => {
            const items = [
                { weight: 500, unit: 'kg' },
                { weight: 1, unit: 'ton' }
            ];
            // 500kg + 1000kg = 1500kg = 1.5 ton
            const result = formatSmartTotal(items, 'weight', 'unit');
            expect(result).toContain('1,5 ton');
        });

        it('should convert and sum areas correctly', () => {
            const items = [
                { size: 5000, unit: 'm2' },
                { size: 1, unit: 'ha' }
            ];
            // 5000m2 + 10000m2 = 15000m2 = 1.5 ha
            const result = formatSmartTotal(items, 'size', 'unit');
            expect(result).toContain('1,5 ha');
        });

        it('should handle discrete units without conversion', () => {
            const items = [
                { qty: 10, unit: 'unidade' },
                { qty: 5, unit: 'caixa' }
            ];
            const result = formatSmartTotal(items, 'qty', 'unit');
            expect(result).toBe('10 unidade + 5 caixa');
        });

        it('should return "-" for empty items', () => {
            expect(formatSmartTotal([], 'v', 'u')).toBe('-');
        });
    });

    describe('formatComplianceMessage', () => {
        it('should clean up specific compliance prefixes and lowercase "NÃO"', () => {
            const input = '[ALERTA COMPLIANCE] ALERTA DE COMPLIANCE: O usuário NÃO deve fazer isso';
            const output = formatComplianceMessage(input);
            expect(output).toBe('O usuário não deve fazer isso');
        });

        it('should return null if the keywords ALERTA/COMPLIANCE/[SISTEMA] are missing', () => {
            expect(formatComplianceMessage('Mensagem comum')).toBeNull();
        });

        it('should format message with [SISTEMA] prefix correctly', () => {
            const input = '[SISTEMA]: proibido fazer isso';
            expect(formatComplianceMessage(input)).toBe('Proibido fazer isso');
        });
    });
});
