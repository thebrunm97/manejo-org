/**
 * @file index.ts
 * @description Barrel export for manual-record hooks.
 * 
 * These hooks extract complex logic from ManualRecordDialog.tsx for:
 * - Improved testability (hooks can be unit tested in isolation)
 * - Better code organization (separation of concerns)
 * - Potential reuse in other form components
 */

// --- Hook Exports ---
export { useRecordValidation } from './useRecordValidation';
export { useUnitSelection, getUnitsByCategory } from './useUnitSelection';
export { useRecordFormState } from './useRecordFormState';

// --- Type Exports ---
export type {
    TipoRegistro,
    OutroSubtype,
    CommonDraft,
    PlantioDraft,
    ManejoDraft,
    ColheitaDraft,
    OutroDraft,
    AnyDraft,
    ValidationErrors,
    ValidationResult
} from './useRecordValidation';

export type {
    UnitCategory
} from './useUnitSelection';

// --- Constant Exports ---
export {
    UNIDADES_PLANTIO,
    UNIDADES_MANEJO,
    UNIDADES_COLHEITA,
    UNIDADES_OUTRO
} from './useUnitSelection';

export {
    getNowISO,
    getLoteSuggestion,
    initialPlantioDraft,
    initialManejoDraft,
    initialColheitaDraft,
    initialOutroDraft
} from './useRecordFormState';
