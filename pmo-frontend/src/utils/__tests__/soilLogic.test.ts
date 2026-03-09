import { describe, it, expect } from 'vitest';
import { soilLogic } from '../soilLogic';

describe('soilLogic utility', () => {
    describe('calculateSilt', () => {
        it('should calculate silt correctly with numbers', () => {
            expect(soilLogic.calculateSilt(20, 30)).toBe(50);
        });

        it('should calculate silt correctly with strings', () => {
            expect(soilLogic.calculateSilt('20.5', '30.2')).toBe(49.3);
        });

        it('should return 0 if clay + sand >= 100', () => {
            expect(soilLogic.calculateSilt(60, 50)).toBe(0);
        });

        it('should handle missing or invalid values as 0', () => {
            expect(soilLogic.calculateSilt(0, 0)).toBe(100);
            expect(soilLogic.calculateSilt('', '')).toBe(100);
            // @ts-ignore - testing runtime robustness
            expect(soilLogic.calculateSilt(null, undefined)).toBe(100);
        });

        it('should have max 1 decimal place', () => {
            // 100 - 33.33 - 33.33 = 33.34 -> toFixed(1) -> 33.3
            expect(soilLogic.calculateSilt(33.33, 33.33)).toBe(33.3);
        });
    });

    describe('getClassificacaoTextural', () => {
        it('should classify as Arenoso if argila < 15', () => {
            expect(soilLogic.getClassificacaoTextural(14.9)).toBe('Arenoso');
            expect(soilLogic.getClassificacaoTextural(0)).toBe('Arenoso');
        });

        it('should classify as Médio if argila is between 15 and 35', () => {
            expect(soilLogic.getClassificacaoTextural(15)).toBe('Médio');
            expect(soilLogic.getClassificacaoTextural(34.9)).toBe('Médio');
        });

        it('should classify as Argiloso if argila is between 35 and 60', () => {
            expect(soilLogic.getClassificacaoTextural(35)).toBe('Argiloso');
            expect(soilLogic.getClassificacaoTextural(60)).toBe('Argiloso');
        });

        it('should classify as Muito Argiloso if argila > 60', () => {
            expect(soilLogic.getClassificacaoTextural(60.1)).toBe('Muito Argiloso');
            expect(soilLogic.getClassificacaoTextural(100)).toBe('Muito Argiloso');
        });

        it('should handle strings correctly', () => {
            expect(soilLogic.getClassificacaoTextural('40')).toBe('Argiloso');
        });
    });

    describe('getCropTargets', () => {
        it('should return soja targets', () => {
            const targets = soilLogic.getCropTargets('Soja');
            expect(targets.v_ideal).toBe(60);
            expect(targets.ph_ideal).toBe(6.0);
        });

        it('should return milho targets', () => {
            const targets = soilLogic.getCropTargets('MILHO');
            expect(targets.v_ideal).toBe(70);
        });

        it('should handle variations in crop names (accents and case)', () => {
            expect(soilLogic.getCropTargets('Café').v_ideal).toBe(60);
            expect(soilLogic.getCropTargets('cafe').v_ideal).toBe(60);
            expect(soilLogic.getCropTargets('FEIJÃO').v_ideal).toBe(70);
            expect(soilLogic.getCropTargets('feijao').v_ideal).toBe(70);
        });

        it('should return default targets for unknown or empty crops', () => {
            const defaultTargets = { v_ideal: 60, ph_ideal: 6.0, ph_min: 5.5, ph_max: 6.5 };
            expect(soilLogic.getCropTargets('Outra')).toEqual(defaultTargets);
            expect(soilLogic.getCropTargets('')).toEqual(defaultTargets);
            expect(soilLogic.getCropTargets(undefined)).toEqual(defaultTargets);
        });
    });
});
