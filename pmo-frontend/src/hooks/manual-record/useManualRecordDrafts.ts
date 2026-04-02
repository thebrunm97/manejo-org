import { useCallback } from 'react';
import { useRecordValidation, useRecordFormState, TipoRegistro } from '../manual-record';

export function useManualRecordDrafts(isEditMode: boolean, recordToEdit: any) {
    const {
        plantioDraft,
        manejoDraft,
        colheitaDraft,
        outroDraft,
        limpezaDraft,
        compostagemDraft,
        comprasDraft,
        vendasDraft,
        getCurrentDraft,
        updateDraft: updateDraftBase,
        clearDraft
    } = useRecordFormState({ open: true, recordToEdit });

    const { validate, errors, clearError, clearAllErrors, organicWarning, checkInsumoOrganico } = useRecordValidation();

    const updateDraft = useCallback((field: string, value: any) => {
        if (errors[field]) {
            clearError(field);
        }
        updateDraftBase(field, value);
    }, [errors, clearError, updateDraftBase]);

    const isDraftValid = useCallback((activeTab: string, talhoes: any[]) => {
        const draft = getCurrentDraft();
        const result = validate(draft, activeTab as TipoRegistro, talhoes);
        return result.isValid;
    }, [getCurrentDraft, validate]);

    return {
        isEditMode, // Exporting to satisfy lint and for potential UI use
        plantioDraft,
        manejoDraft,
        colheitaDraft,
        outroDraft,
        limpezaDraft,
        compostagemDraft,
        comprasDraft,
        vendasDraft,
        getCurrentDraft,
        updateDraft,
        clearDraft,
        isDraftValid,
        clearAllErrors,
        clearError,
        errors,
        organicWarning,
        checkInsumoOrganico
    };
}
