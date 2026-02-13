/**
 * @file useUnitSelection.ts
 * @description Custom hook for managing unit selection with legacy value support.
 * Handles the "out-of-range" problem when old records have units not in the current options.
 */
import { useMemo } from 'react';
import { UnitType } from '../../types/CadernoTypes';

// --- Unit Constants ---
export const UNIDADES_PLANTIO: UnitType[] = [
    UnitType.UNID,
    UnitType.KG,
    UnitType.G,
    UnitType.M2
];

export const UNIDADES_MANEJO: UnitType[] = [
    UnitType.L_HA,
    UnitType.KG_HA,
    UnitType.ML_L,
    UnitType.G_PLANTA,
    UnitType.ML_PLANTA,
    UnitType.UNID
];

export const UNIDADES_COLHEITA: UnitType[] = [
    UnitType.KG,
    UnitType.TON,
    UnitType.CX,
    UnitType.MACO,
    UnitType.UNID
];

export const UNIDADES_OUTRO: UnitType[] = [
    UnitType.UNID,
    UnitType.L,
    UnitType.KG,
    UnitType.CX,
    UnitType.MACO,
    UnitType.TON
];

export type UnitCategory = 'plantio' | 'manejo' | 'colheita' | 'outro';

interface UseUnitSelectionProps {
    /** The category of units to use */
    category: UnitCategory;
    /** The current selected value (may be a legacy value not in the options) */
    currentValue?: UnitType | string;
}

interface UseUnitSelectionReturn {
    /** The available standard units for this category */
    availableUnits: UnitType[];
    /** Units including any legacy value if present */
    unitsWithLegacy: (UnitType | string)[];
    /** Whether the current value is a legacy/non-standard unit */
    isLegacyUnit: boolean;
    /** Safe value to use (empty string if undefined) */
    safeValue: UnitType | string;
}

/**
 * Custom hook for managing unit selection dropdowns with legacy value support.
 * 
 * @example
 * const { unitsWithLegacy, isLegacyUnit, safeValue } = useUnitSelection({
 *   category: 'plantio',
 *   currentValue: draft.unidadePlantio
 * });
 */
export const useUnitSelection = ({
    category,
    currentValue
}: UseUnitSelectionProps): UseUnitSelectionReturn => {

    const availableUnits = useMemo(() => {
        switch (category) {
            case 'plantio':
                return UNIDADES_PLANTIO;
            case 'manejo':
                return UNIDADES_MANEJO;
            case 'colheita':
                return UNIDADES_COLHEITA;
            case 'outro':
                return UNIDADES_OUTRO;
            default:
                return [];
        }
    }, [category]);

    const isLegacyUnit = useMemo(() => {
        if (!currentValue) return false;
        return !availableUnits.includes(currentValue as UnitType);
    }, [currentValue, availableUnits]);

    const unitsWithLegacy = useMemo(() => {
        if (!isLegacyUnit || !currentValue) {
            return [...availableUnits];
        }
        // Prepend legacy value to the options
        return [currentValue, ...availableUnits];
    }, [availableUnits, isLegacyUnit, currentValue]);

    const safeValue = currentValue || '';

    return {
        availableUnits,
        unitsWithLegacy,
        isLegacyUnit,
        safeValue
    };
};

/**
 * Gets units by category without using the hook (for static contexts).
 */
export const getUnitsByCategory = (category: UnitCategory): UnitType[] => {
    switch (category) {
        case 'plantio':
            return UNIDADES_PLANTIO;
        case 'manejo':
            return UNIDADES_MANEJO;
        case 'colheita':
            return UNIDADES_COLHEITA;
        case 'outro':
            return UNIDADES_OUTRO;
        default:
            return [];
    }
};

export default useUnitSelection;
