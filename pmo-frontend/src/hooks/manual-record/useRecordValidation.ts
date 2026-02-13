/**
 * @file useRecordValidation.ts
 * @description Custom hook for validating manual records by activity type.
 * Extracts validation logic from ManualRecordDialog for improved testability and reusability.
 */
import { useState, useCallback } from 'react';
import { checkOrganicInput, OrganicRule } from '../../utils/organicRules';
import {
    ManejoSubtype,
    UnitType
} from '../../types/CadernoTypes';

// --- Types ---
export type TipoRegistro = 'plantio' | 'manejo' | 'colheita' | 'outro';
export type OutroSubtype = 'compra' | 'venda' | 'outro';

export interface CommonDraft {
    dataHora: string;
    locais: string[];
    produto: string;
    observacao: string;
}

export interface PlantioDraft extends CommonDraft {
    metodoPropagacao: string;
    qtdPlantio: string;
    unidadePlantio: UnitType;
    houveDescartes: boolean;
    qtdDescartes: string;
    unidadeDescartes: UnitType;
}

export interface ManejoDraft extends CommonDraft {
    subtipoManejo: ManejoSubtype;
    tipoManejo: string;
    insumo: string;
    dosagem: string;
    unidadeDosagem: UnitType;
    responsavel: string;
    equipamento: string;
    itemHigienizado: string;
    produtoUtilizado: string;
    atividadeCultural: string;
    qtdTrabalhadores: string;
}

export interface ColheitaDraft extends CommonDraft {
    lote: string;
    destino: string;
    classificacao: string;
    qtdColheita: string;
    unidadeColheita: UnitType;
    houveDescartes: boolean;
    qtdDescartes: string;
    unidadeDescartes: UnitType;
}

export interface OutroDraft extends CommonDraft {
    tipoOutro: OutroSubtype;
    quantidade: string;
    unidade: UnitType;
    numeroDocumento: string;
    fornecedor: string;
    tipoOrigem: 'compra' | 'doação' | 'produção própria';
    destinoVenda: string;
}

export type AnyDraft = PlantioDraft | ManejoDraft | ColheitaDraft | OutroDraft;

export interface ValidationErrors {
    [key: string]: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationErrors;
    organicWarning: OrganicRule | null;
}

/**
 * Custom hook for validating manual record forms.
 * 
 * @example
 * const { validate, errors, clearErrors, organicWarning } = useRecordValidation();
 * const result = validate(draft, 'plantio');
 */
export const useRecordValidation = () => {
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [organicWarning, setOrganicWarning] = useState<OrganicRule | null>(null);

    /**
     * Validates a Plantio (planting) draft.
     */
    const validatePlantio = useCallback((draft: PlantioDraft): ValidationErrors => {
        const newErrors: ValidationErrors = {};

        if (!draft.dataHora) newErrors.data = 'Data é obrigatória';
        if (!draft.produto.trim()) newErrors.produto = 'Cultura é obrigatória';
        if (!draft.metodoPropagacao) newErrors.metodo = 'Método é obrigatório';
        if (draft.locais.length === 0) newErrors.locais = 'Local é obrigatório';

        if (draft.houveDescartes) {
            if (!draft.qtdDescartes || parseFloat(draft.qtdDescartes) <= 0) {
                newErrors.qtdDescartes = 'Informe a quantidade';
            }
        }

        return newErrors;
    }, []);

    /**
     * Validates a Manejo (management) draft including organic input checks.
     */
    const validateManejo = useCallback((draft: ManejoDraft): { errors: ValidationErrors; warning: OrganicRule | null } => {
        const newErrors: ValidationErrors = {};
        let warning: OrganicRule | null = null;

        if (!draft.dataHora) newErrors.data = 'Data é obrigatória';

        if (draft.subtipoManejo === ManejoSubtype.HIGIENIZACAO) {
            if (!draft.itemHigienizado.trim()) newErrors.itemHigienizado = 'Item obrigatório';
            if (!draft.produtoUtilizado.trim()) newErrors.produtoUtilizado = 'Produto obrigatório';
        } else {
            // Manejo Cultural e Insumo
            if (!draft.produto.trim() && draft.locais.length === 0) {
                newErrors.produto = 'Informe Cultura ou Local';
                newErrors.locais = 'Informe Cultura ou Local';
            }

            if (draft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) {
                if (!draft.insumo.trim()) newErrors.insumo = 'Insumo obrigatório';
                if (!draft.dosagem.trim()) newErrors.dosagem = 'Dose obrigatória';

                // === VALIDAÇÃO DE INSUMOS ORGÂNICOS ===
                const organicRule = checkOrganicInput(draft.insumo);
                if (organicRule) {
                    if (organicRule.status === 'proibido') {
                        newErrors.insumo = organicRule.msg;
                    } else if (organicRule.status === 'atencao') {
                        warning = organicRule;
                    }
                }
            } else if (draft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL) {
                if (!draft.atividadeCultural.trim()) newErrors.atividadeCultural = 'Atividade obrigatória';
            }
        }

        return { errors: newErrors, warning };
    }, []);

    /**
     * Validates a Colheita (harvest) draft.
     */
    const validateColheita = useCallback((draft: ColheitaDraft): ValidationErrors => {
        const newErrors: ValidationErrors = {};

        if (!draft.dataHora) newErrors.data = 'Data é obrigatória';
        if (!draft.produto.trim()) newErrors.produto = 'Cultura é obrigatória';
        if (!draft.qtdColheita || parseFloat(draft.qtdColheita) <= 0) {
            newErrors.qtdColheita = 'Qtd é obrigatória';
        }

        if (draft.houveDescartes) {
            if (!draft.qtdDescartes || parseFloat(draft.qtdDescartes) <= 0) {
                newErrors.qtdDescartes = 'Informe a quantidade';
            }
        }

        return newErrors;
    }, []);

    /**
     * Validates an Outro (other) draft including compra/venda subtypes.
     */
    const validateOutro = useCallback((draft: OutroDraft): ValidationErrors => {
        const newErrors: ValidationErrors = {};

        if (!draft.dataHora) newErrors.data = 'Data é obrigatória';

        if (draft.tipoOutro === 'compra') {
            if (!draft.produto.trim()) newErrors.produto = 'Produto obrigatório';
            if (!draft.quantidade || parseFloat(draft.quantidade) <= 0) newErrors.quantidade = 'Qtd obrigatória';
            if (!draft.fornecedor.trim()) newErrors.fornecedor = 'Fornecedor obrigatório';
        } else if (draft.tipoOutro === 'venda') {
            if (!draft.produto.trim()) newErrors.produto = 'Produto/Lote obrigatório';
            if (!draft.quantidade || parseFloat(draft.quantidade) <= 0) newErrors.quantidade = 'Qtd obrigatória';
            if (!draft.destinoVenda.trim()) newErrors.destinoVenda = 'Destino obrigatório';
        } else {
            // Outro genérico
            if (!draft.produto.trim() && draft.locais.length === 0 && !draft.observacao.trim()) {
                newErrors.observacao = 'Preencha ao menos um campo';
                newErrors.produto = 'Obrigatório';
                newErrors.locais = 'Obrigatório';
            }
        }

        return newErrors;
    }, []);

    /**
     * Main validation function that dispatches to type-specific validators.
     * 
     * @param draft - The current form draft
     * @param activeTab - The current activity type tab
     * @returns ValidationResult with isValid flag, errors object, and optional organic warning
     */
    const validate = useCallback((draft: AnyDraft, activeTab: TipoRegistro): ValidationResult => {
        let newErrors: ValidationErrors = {};
        let warning: OrganicRule | null = null;

        switch (activeTab) {
            case 'plantio':
                newErrors = validatePlantio(draft as PlantioDraft);
                break;
            case 'manejo': {
                const result = validateManejo(draft as ManejoDraft);
                newErrors = result.errors;
                warning = result.warning;
                break;
            }
            case 'colheita':
                newErrors = validateColheita(draft as ColheitaDraft);
                break;
            case 'outro':
                newErrors = validateOutro(draft as OutroDraft);
                break;
        }

        setErrors(newErrors);
        setOrganicWarning(warning);

        return {
            isValid: Object.keys(newErrors).length === 0,
            errors: newErrors,
            organicWarning: warning
        };
    }, [validatePlantio, validateManejo, validateColheita, validateOutro]);

    /**
     * Clears a specific error field.
     */
    const clearError = useCallback((field: string) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    }, []);

    /**
     * Clears all validation errors.
     */
    const clearAllErrors = useCallback(() => {
        setErrors({});
        setOrganicWarning(null);
    }, []);

    /**
     * Checks an insumo input for organic compliance (live validation).
     */
    const checkInsumoOrganico = useCallback((insumo: string) => {
        const rule = checkOrganicInput(insumo);
        if (rule?.status === 'atencao') {
            setOrganicWarning(rule);
        } else {
            setOrganicWarning(null);
        }
        return rule;
    }, []);

    return {
        validate,
        errors,
        setErrors,
        clearError,
        clearAllErrors,
        organicWarning,
        setOrganicWarning,
        checkInsumoOrganico,
        // Expose individual validators for targeted testing
        validatePlantio,
        validateManejo,
        validateColheita,
        validateOutro
    };
};

export default useRecordValidation;
