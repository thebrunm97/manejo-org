/**
 * @file useUnitSelection.test.ts
 * @description Unit tests for the useUnitSelection hook.
 * Covers unit category selection and legacy value handling.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    useUnitSelection,
    getUnitsByCategory,
    UNIDADES_PLANTIO,
    UNIDADES_MANEJO,
    UNIDADES_COLHEITA,
    UNIDADES_OUTRO
} from '../useUnitSelection';
import { UnitType } from '../../../types/CadernoTypes';

describe('useUnitSelection', () => {
    describe('availableUnits by category', () => {
        it('should return UNIDADES_PLANTIO for plantio category', () => {
            const { result } = renderHook(() =>
                useUnitSelection({ category: 'plantio' })
            );

            expect(result.current.availableUnits).toEqual(UNIDADES_PLANTIO);
            expect(result.current.availableUnits).toContain(UnitType.UNID);
            expect(result.current.availableUnits).toContain(UnitType.MACO);
            expect(result.current.availableUnits).toContain(UnitType.KG);
        });

        it('should return UNIDADES_MANEJO for manejo category', () => {
            const { result } = renderHook(() =>
                useUnitSelection({ category: 'manejo' })
            );

            expect(result.current.availableUnits).toEqual(UNIDADES_MANEJO);
            expect(result.current.availableUnits).toContain(UnitType.L_HA);
            expect(result.current.availableUnits).toContain(UnitType.KG_HA);
            expect(result.current.availableUnits).toContain(UnitType.ML_L);
        });

        it('should return UNIDADES_COLHEITA for colheita category', () => {
            const { result } = renderHook(() =>
                useUnitSelection({ category: 'colheita' })
            );

            expect(result.current.availableUnits).toEqual(UNIDADES_COLHEITA);
            expect(result.current.availableUnits).toContain(UnitType.KG);
            expect(result.current.availableUnits).toContain(UnitType.TON);
            expect(result.current.availableUnits).toContain(UnitType.CX);
        });

        it('should return UNIDADES_OUTRO for outro category', () => {
            const { result } = renderHook(() =>
                useUnitSelection({ category: 'outro' })
            );

            expect(result.current.availableUnits).toEqual(UNIDADES_OUTRO);
            expect(result.current.availableUnits).toContain(UnitType.UNID);
            expect(result.current.availableUnits).toContain(UnitType.L);
        });

        it('should return empty array for unknown category', () => {
            const { result } = renderHook(() =>
                useUnitSelection({ category: 'unknown' as any })
            );

            expect(result.current.availableUnits).toEqual([]);
        });
    });

    describe('isLegacyUnit detection', () => {
        it('should return false when currentValue is in availableUnits', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: UnitType.KG
                })
            );

            expect(result.current.isLegacyUnit).toBe(false);
        });

        it('should return true when currentValue is NOT in availableUnits', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: 'sacas' as UnitType // Legacy unit
                })
            );

            expect(result.current.isLegacyUnit).toBe(true);
        });

        it('should return false when currentValue is undefined', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: undefined
                })
            );

            expect(result.current.isLegacyUnit).toBe(false);
        });

        it('should return false when currentValue is empty string', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: ''
                })
            );

            expect(result.current.isLegacyUnit).toBe(false);
        });
    });

    describe('unitsWithLegacy', () => {
        it('should equal availableUnits when no legacy value', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'colheita',
                    currentValue: UnitType.KG
                })
            );

            expect(result.current.unitsWithLegacy).toEqual(UNIDADES_COLHEITA);
        });

        it('should prepend legacy value when present', () => {
            const legacyUnit = 'caixotes';
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'colheita',
                    currentValue: legacyUnit
                })
            );

            expect(result.current.unitsWithLegacy[0]).toBe(legacyUnit);
            expect(result.current.unitsWithLegacy.slice(1)).toEqual(UNIDADES_COLHEITA);
            expect(result.current.unitsWithLegacy.length).toBe(UNIDADES_COLHEITA.length + 1);
        });

        it('should not duplicate when currentValue is in availableUnits', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'manejo',
                    currentValue: UnitType.L_HA
                })
            );

            // Should not have duplicates
            const uniqueUnits = [...new Set(result.current.unitsWithLegacy)];
            expect(result.current.unitsWithLegacy).toEqual(uniqueUnits);
        });
    });

    describe('safeValue', () => {
        it('should return currentValue when defined', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: UnitType.MACO
                })
            );

            expect(result.current.safeValue).toBe(UnitType.MACO);
        });

        it('should return empty string when currentValue is undefined', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: undefined
                })
            );

            expect(result.current.safeValue).toBe('');
        });

        it('should return empty string when currentValue is null-ish', () => {
            const { result } = renderHook(() =>
                useUnitSelection({
                    category: 'plantio',
                    currentValue: '' as any
                })
            );

            expect(result.current.safeValue).toBe('');
        });
    });

    describe('reactivity to prop changes', () => {
        it('should update availableUnits when category changes', () => {
            const { result, rerender } = renderHook(
                ({ category }: { category: 'plantio' | 'manejo' | 'colheita' | 'outro' }) => useUnitSelection({ category }),
                { initialProps: { category: 'plantio' as const } }
            );

            expect(result.current.availableUnits).toEqual(UNIDADES_PLANTIO);

            rerender({ category: 'manejo' });

            expect(result.current.availableUnits).toEqual(UNIDADES_MANEJO);
        });

        it('should update isLegacyUnit when currentValue changes', () => {
            const { result, rerender } = renderHook(
                ({ currentValue }: { currentValue: UnitType | string }) => useUnitSelection({ category: 'colheita', currentValue }),
                { initialProps: { currentValue: UnitType.KG as UnitType | string } }
            );

            expect(result.current.isLegacyUnit).toBe(false);

            rerender({ currentValue: 'legacy-unit' });

            expect(result.current.isLegacyUnit).toBe(true);
        });
    });
});

describe('getUnitsByCategory (static helper)', () => {
    it('should return correct units for each category', () => {
        expect(getUnitsByCategory('plantio')).toEqual(UNIDADES_PLANTIO);
        expect(getUnitsByCategory('manejo')).toEqual(UNIDADES_MANEJO);
        expect(getUnitsByCategory('colheita')).toEqual(UNIDADES_COLHEITA);
        expect(getUnitsByCategory('outro')).toEqual(UNIDADES_OUTRO);
    });

    it('should return empty array for unknown category', () => {
        expect(getUnitsByCategory('invalid' as any)).toEqual([]);
    });
});
