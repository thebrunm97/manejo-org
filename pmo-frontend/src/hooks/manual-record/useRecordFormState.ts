/**
 * @file useRecordFormState.ts
 * @description Custom hook for managing complex form state across multiple activity types.
 * Handles draft initialization, updates, and reset logic.
 */
import { useState, useCallback, useEffect } from 'react';
import {
    UnitType,
    ManejoSubtype,
    CadernoCampoRecord,
    ActivityType,
    DetalhesPlantio,
    DetalhesManejo,
    DetalhesColheita,
    DetalhesVenda,
    DetalhesCompostagem
} from '../../types/CadernoTypes';
import {
    TipoRegistro,
    CommonDraft,
    PlantioDraft,
    ManejoDraft,
    ColheitaDraft,
    OutroDraft,
    LimpezaDraft,
    CompostagemDraft,
    ComprasDraft,
    VendasDraft,
    AnyDraft
} from './useRecordValidation';

// --- Helpers ---
export const getNowISO = () => new Date().toLocaleString('sv').slice(0, 16);

export const getLoteSuggestion = () => {
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const dd = today.getDate().toString().padStart(2, '0');
    return `LOTE-${yy}${mm}${dd}`;
};

// --- Initial States ---
const initialCommon: CommonDraft = {
    dataHora: '',
    locais: [],
    produto: '',
    observacao: ''
};

export const initialPlantioDraft: PlantioDraft = {
    ...initialCommon,
    metodoPropagacao: 'Muda',
    qtdPlantio: '',
    unidadePlantio: UnitType.UNID,
    houveDescartes: false,
    qtdDescartes: '',
    unidadeDescartes: UnitType.UNID
};

export const initialManejoDraft: ManejoDraft = {
    ...initialCommon,
    subtipoManejo: ManejoSubtype.MANEJO_CULTURAL,
    tipoManejo: 'Adubação',
    insumo: '',
    dosagem: '',
    unidadeDosagem: UnitType.L_HA,
    responsavel: '',
    equipamento: '',
    itemHigienizado: '',
    produtoUtilizado: '',
    atividadeCultural: '',
    qtdTrabalhadores: ''
};

export const initialColheitaDraft: ColheitaDraft = {
    ...initialCommon,
    lote: '',
    destino: 'Mercado Interno',
    classificacao: 'Primeira',
    qtdColheita: '',
    unidadeColheita: UnitType.KG,
    houveDescartes: false,
    qtdDescartes: '',
    unidadeDescartes: UnitType.KG
};

export const initialOutroDraft: OutroDraft = {
    ...initialCommon,
    tipoOutro: 'outro',
    quantidade: '',
    unidade: UnitType.UNID,
    numeroDocumento: '',
    fornecedor: '',
    tipoOrigem: 'compra',
    destinoVenda: '',
    titulo: '',
    descricao: '',
    responsavel: ''
};

export const initialLimpezaDraft: LimpezaDraft = {
    ...initialCommon,
    itemArea: '',
    tipoLimpeza: 'Seca',
    produtoUtilizado: '',
    dosagem: '',
    responsavel: ''
};

export const initialCompostagemDraft: CompostagemDraft = {
    ...initialCommon,
    acao: 'Revirada',
    nPilha: '',
    ingredientes: '',
    temperatura: '',
    responsavel: ''
};

export const initialComprasDraft: ComprasDraft = {
    ...initialCommon,
    quantidade: '',
    unidade: UnitType.UNID,
    fornecedor: '',
    nfRecibo: ''
};

export const initialVendasDraft: VendasDraft = {
    ...initialCommon,
    destinacao: 'venda',
    quantidade: '',
    unidade: UnitType.KG,
    valorUnitario: '',
    cliente: '',
    nf: ''
};

interface UseRecordFormStateProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Record being edited (null for new records) */
    recordToEdit?: CadernoCampoRecord | null;
}

interface UseRecordFormStateReturn {
    // Current state
    activeTab: TipoRegistro;
    isEditMode: boolean;

    // Draft states
    plantioDraft: PlantioDraft;
    manejoDraft: ManejoDraft;
    colheitaDraft: ColheitaDraft;
    outroDraft: OutroDraft;
    limpezaDraft: LimpezaDraft;
    compostagemDraft: CompostagemDraft;
    comprasDraft: ComprasDraft;
    vendasDraft: VendasDraft;

    // Actions
    setActiveTab: (tab: TipoRegistro) => void;
    getCurrentDraft: () => AnyDraft;
    updateDraft: (field: string, value: any) => void;
    clearDraft: (tab: TipoRegistro) => void;
    resetAllDrafts: () => void;

    // Setters for specific drafts (for edit mode population)
    setPlantioDraft: React.Dispatch<React.SetStateAction<PlantioDraft>>;
    setManejoDraft: React.Dispatch<React.SetStateAction<ManejoDraft>>;
    setColheitaDraft: React.Dispatch<React.SetStateAction<ColheitaDraft>>;
    setOutroDraft: React.Dispatch<React.SetStateAction<OutroDraft>>;
    setLimpezaDraft: React.Dispatch<React.SetStateAction<LimpezaDraft>>;
    setCompostagemDraft: React.Dispatch<React.SetStateAction<CompostagemDraft>>;
    setComprasDraft: React.Dispatch<React.SetStateAction<ComprasDraft>>;
    setVendasDraft: React.Dispatch<React.SetStateAction<VendasDraft>>;
}

/**
 * Custom hook for managing the complex form state of ManualRecordDialog.
 * Handles per-tab draft state, updates, and initialization from existing records.
 * 
 * @example
 * const {
 *   activeTab,
 *   getCurrentDraft,
 *   updateDraft, 
 *   clearDraft
 * } = useRecordFormState({ open, recordToEdit });
 */
export const useRecordFormState = ({
    open,
    recordToEdit
}: UseRecordFormStateProps): UseRecordFormStateReturn => {
    const isEditMode = !!recordToEdit;

    // Tab State
    const [activeTab, setActiveTab] = useState<TipoRegistro>('plantio');

    // Draft States
    const [plantioDraft, setPlantioDraft] = useState<PlantioDraft>(() => ({
        ...initialPlantioDraft,
        dataHora: getNowISO()
    }));
    const [manejoDraft, setManejoDraft] = useState<ManejoDraft>(() => ({
        ...initialManejoDraft,
        dataHora: getNowISO()
    }));
    const [colheitaDraft, setColheitaDraft] = useState<ColheitaDraft>(() => ({
        ...initialColheitaDraft,
        dataHora: getNowISO(),
        lote: getLoteSuggestion()
    }));
    const [outroDraft, setOutroDraft] = useState<OutroDraft>(() => ({
        ...initialOutroDraft,
        dataHora: getNowISO()
    }));
    const [limpezaDraft, setLimpezaDraft] = useState<LimpezaDraft>(() => ({
        ...initialLimpezaDraft,
        dataHora: getNowISO()
    }));
    const [compostagemDraft, setCompostagemDraft] = useState<CompostagemDraft>(() => ({
        ...initialCompostagemDraft,
        dataHora: getNowISO()
    }));
    const [comprasDraft, setComprasDraft] = useState<ComprasDraft>(() => ({
        ...initialComprasDraft,
        dataHora: getNowISO()
    }));
    const [vendasDraft, setVendasDraft] = useState<VendasDraft>(() => ({
        ...initialVendasDraft,
        dataHora: getNowISO()
    }));

    /**
     * Gets the current draft based on active tab.
     */
    const getCurrentDraft = useCallback((): AnyDraft => {
        switch (activeTab) {
            case 'plantio': return plantioDraft;
            case 'manejo': return manejoDraft;
            case 'colheita': return colheitaDraft;
            case 'outro': return outroDraft;
            case 'limpeza': return limpezaDraft;
            case 'compostagem': return compostagemDraft;
            case 'compras': return comprasDraft;
            case 'vendas': return vendasDraft;
        }
    }, [activeTab, plantioDraft, manejoDraft, colheitaDraft, outroDraft, limpezaDraft, compostagemDraft, comprasDraft, vendasDraft]);

    /**
     * Updates a field in the current draft.
     */
    const updateDraft = useCallback((field: string, value: any) => {
        switch (activeTab) {
            case 'plantio':
                setPlantioDraft(prev => ({ ...prev, [field]: value } as PlantioDraft));
                break;
            case 'manejo':
                setManejoDraft(prev => ({ ...prev, [field]: value } as ManejoDraft));
                break;
            case 'colheita':
                setColheitaDraft(prev => ({ ...prev, [field]: value } as ColheitaDraft));
                break;
            case 'outro':
                setOutroDraft(prev => ({ ...prev, [field]: value } as OutroDraft));
                break;
            case 'limpeza':
                setLimpezaDraft(prev => ({ ...prev, [field]: value } as LimpezaDraft));
                break;
            case 'compostagem':
                setCompostagemDraft(prev => ({ ...prev, [field]: value } as CompostagemDraft));
                break;
            case 'compras':
                setComprasDraft(prev => ({ ...prev, [field]: value } as ComprasDraft));
                break;
            case 'vendas':
                setVendasDraft(prev => ({ ...prev, [field]: value } as VendasDraft));
                break;
        }
    }, [activeTab]);

    /**
     * Clears a specific tab's draft to initial state.
     */
    const clearDraft = useCallback((tab: TipoRegistro) => {
        const now = getNowISO();
        switch (tab) {
            case 'plantio':
                setPlantioDraft({ ...initialPlantioDraft, dataHora: now });
                break;
            case 'manejo':
                setManejoDraft({ ...initialManejoDraft, dataHora: now });
                break;
            case 'colheita':
                setColheitaDraft({ ...initialColheitaDraft, dataHora: now, lote: getLoteSuggestion() });
                break;
            case 'outro':
                setOutroDraft({ ...initialOutroDraft, dataHora: now });
                break;
            case 'limpeza':
                setLimpezaDraft({ ...initialLimpezaDraft, dataHora: now });
                break;
            case 'compostagem':
                setCompostagemDraft({ ...initialCompostagemDraft, dataHora: now });
                break;
            case 'compras':
                setComprasDraft({ ...initialComprasDraft, dataHora: now });
                break;
            case 'vendas':
                setVendasDraft({ ...initialVendasDraft, dataHora: now });
                break;
        }
    }, []);

    /**
     * Resets all drafts to initial state.
     */
    const resetAllDrafts = useCallback(() => {
        const now = getNowISO();
        setPlantioDraft({ ...initialPlantioDraft, dataHora: now });
        setManejoDraft({ ...initialManejoDraft, dataHora: now });
        setColheitaDraft({ ...initialColheitaDraft, dataHora: now, lote: getLoteSuggestion() });
        setOutroDraft({ ...initialOutroDraft, dataHora: now });
        setLimpezaDraft({ ...initialLimpezaDraft, dataHora: now });
        setCompostagemDraft({ ...initialCompostagemDraft, dataHora: now });
        setComprasDraft({ ...initialComprasDraft, dataHora: now });
        setVendasDraft({ ...initialVendasDraft, dataHora: now });
        setActiveTab('plantio');
    }, []);
    // --- Populate from existing record on edit mode ---
    useEffect(() => {
        if (!open) return;

        const now = getNowISO();

        if (recordToEdit) {
            const tipoRaw = recordToEdit.tipo_atividade;
            const details = recordToEdit.detalhes_tecnicos || {};

            const isPlantio = tipoRaw === ActivityType.PLANTIO || tipoRaw === 'Plantio';
            const isCompras = tipoRaw === 'Compra' || ((tipoRaw === ActivityType.INSUMO || tipoRaw === 'Insumo') && (details as any)?.tipo_registro === 'compra');
            const isManejo = (tipoRaw === ActivityType.MANEJO || tipoRaw === 'Manejo' || tipoRaw === ActivityType.INSUMO || tipoRaw === 'Insumo') && !isCompras;
            const isColheita = tipoRaw === ActivityType.COLHEITA || tipoRaw === 'Colheita';
            const isVenda = tipoRaw === ActivityType.VENDA || tipoRaw === 'Venda';
            const isCompostagem = tipoRaw === ActivityType.COMPOSTAGEM || tipoRaw === 'Compostagem';

            // Base fields
            const common: CommonDraft = {
                dataHora: recordToEdit.data_registro
                    ? new Date(recordToEdit.data_registro).toLocaleString('sv').slice(0, 16)
                    : now,
                produto: recordToEdit.produto || '',
                observacao: recordToEdit.observacao_original || '',
                locais: (recordToEdit.caderno_campo_canteiros && recordToEdit.caderno_campo_canteiros.length > 0)
                    ? recordToEdit.caderno_campo_canteiros.map(c => c.canteiros?.nome).filter(Boolean) as string[]
                    : recordToEdit.talhao_canteiro
                        ? recordToEdit.talhao_canteiro.split(';').map(s => s.trim()).filter(Boolean)
                        : []
            };

            if (isPlantio) {
                setActiveTab('plantio');
                const d = details as DetalhesPlantio;
                setPlantioDraft({
                    ...common,
                    metodoPropagacao: d.metodo_propagacao || 'Muda',
                    qtdPlantio: d.qtd_utilizada ? String(d.qtd_utilizada) : '',
                    unidadePlantio: (d.unidade_medida as UnitType) || UnitType.UNID,
                    houveDescartes: !!recordToEdit.houve_descartes,
                    qtdDescartes: recordToEdit.qtd_descartes ? String(recordToEdit.qtd_descartes) : '',
                    unidadeDescartes: (recordToEdit.unidade_descartes as UnitType) || UnitType.UNID
                });
            } else if (isCompras) {
                setActiveTab('compras');
                setComprasDraft({
                    ...common,
                    quantidade: recordToEdit.quantidade_valor ? String(recordToEdit.quantidade_valor) : '',
                    unidade: (recordToEdit.quantidade_unidade as UnitType) || UnitType.UNID,
                    fornecedor: recordToEdit.fornecedor || (details as any)?.fornecedor || '',
                    nfRecibo: recordToEdit.nota_fiscal || (details as any)?.nota_fiscal || '',
                    valor_total: recordToEdit.valor_total ?? undefined
                });
            } else if (isManejo) {
                setActiveTab('manejo');
                const d = details as DetalhesManejo;
                const legacy = details as any;

                let inferred = d.subtipo as ManejoSubtype;
                if (!inferred) {
                    if (d.item_higienizado || legacy.item_limpo) inferred = ManejoSubtype.HIGIENIZACAO;
                    else if (d.insumo || d.nome_insumo || d.dosagem || legacy.nome_insumo) inferred = ManejoSubtype.APLICACAO_INSUMO;
                    else inferred = ManejoSubtype.MANEJO_CULTURAL;
                }

                setManejoDraft({
                    ...common,
                    subtipoManejo: inferred,
                    tipoManejo: d.tipo_manejo || 'Adubação',
                    insumo: d.nome_insumo || d.insumo || legacy.insumo || '',
                    dosagem: d.dosagem ? String(d.dosagem) : '',
                    unidadeDosagem: (d.unidade_dosagem as UnitType) || UnitType.L_HA,
                    responsavel: d.responsavel || '',
                    equipamento: d.equipamento || '',
                    itemHigienizado: d.item_higienizado || legacy.item_limpo || '',
                    produtoUtilizado: d.produto_utilizado || '',
                    atividadeCultural: d.atividade || d.tipo_manejo || '',
                    qtdTrabalhadores: d.qtd_trabalhadores ? String(d.qtd_trabalhadores) : ''
                });
            } else if (isColheita) {
                setActiveTab('colheita');
                const d = details as DetalhesColheita;
                setColheitaDraft({
                    ...common,
                    lote: d.lote || '',
                    destino: d.destino || 'Mercado Interno',
                    classificacao: d.classificacao || 'Primeira',
                    qtdColheita: d.qtd ? String(d.qtd) : '',
                    unidadeColheita: (d.unidade as UnitType) || UnitType.KG,
                    houveDescartes: !!recordToEdit.houve_descartes,
                    qtdDescartes: recordToEdit.qtd_descartes ? String(recordToEdit.qtd_descartes) : '',
                    unidadeDescartes: (recordToEdit.unidade_descartes as UnitType) || UnitType.KG
                });
            } else if (isVenda) {
                setActiveTab('vendas');
                const d = details as DetalhesVenda;
                setVendasDraft({
                    ...common,
                    destinacao: d.destinacao || 'venda',
                    quantidade: d.qtd ? String(d.qtd) : (recordToEdit.quantidade_valor ? String(recordToEdit.quantidade_valor) : ''),
                    unidade: (d.unidade as UnitType) || (recordToEdit.quantidade_unidade as UnitType) || UnitType.KG,
                    valorUnitario: d.valor_unitario ? String(d.valor_unitario) : '',
                    cliente: d.cliente || recordToEdit.fornecedor || '',
                    nf: d.nf_recibo || recordToEdit.nota_fiscal || ''
                });
            } else if (isCompostagem) {
                setActiveTab('compostagem');
                const d = details as DetalhesCompostagem;
                setCompostagemDraft({
                    ...common,
                    acao: d.acao || 'Revirada',
                    nPilha: d.n_pilha || '',
                    ingredientes: d.ingredientes || '',
                    temperatura: d.temperatura ? String(d.temperatura) : '',
                    responsavel: d.responsavel || ''
                });
            } else {
                setActiveTab('outro');
                setOutroDraft({ ...initialOutroDraft, ...common });
            }
        } else {
            // Creation mode - RESET EVERYTHING to ensure no leakage
            resetAllDrafts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, recordToEdit, resetAllDrafts]);

    return {
        activeTab,
        isEditMode,
        plantioDraft,
        manejoDraft,
        colheitaDraft,
        outroDraft,
        limpezaDraft,
        compostagemDraft,
        comprasDraft,
        vendasDraft,
        setActiveTab,
        getCurrentDraft,
        updateDraft,
        clearDraft,
        resetAllDrafts, // Exported correctly
        setPlantioDraft,
        setManejoDraft,
        setColheitaDraft,
        setOutroDraft,
        setLimpezaDraft,
        setCompostagemDraft,
        setComprasDraft,
        setVendasDraft
    };
};

export default useRecordFormState;
