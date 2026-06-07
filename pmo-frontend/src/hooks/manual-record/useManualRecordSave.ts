import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { CadernoEntry, ActivityType, UnitType } from '../../types/CadernoTypes';
import { 
    TipoRegistro
} from './index';
// ManejoSubtype is imported from CadernoTypes
import { ManejoSubtype } from '../../types/CadernoTypes';

interface UseManualRecordSaveProps {
    saveRecord: (record: CadernoEntry) => Promise<{ success: boolean; error?: string; isOffline?: boolean }>;
    onRecordSaved: () => void;
    onClose: () => void;
    clearDraft: (tab: TipoRegistro) => void;
    clearAllErrors: () => void;
    setLoading: (loading: boolean) => void;
    setOpenJustification: (open: boolean) => void;
}

export function useManualRecordSave({
    saveRecord,
    onRecordSaved,
    onClose,
    clearDraft,
    clearAllErrors,
    setLoading,
    setOpenJustification
}: UseManualRecordSaveProps) {

    const executeSave = useCallback(async (
        activeTab: TipoRegistro, 
        draft: any, 
        payloadBase: Partial<CadernoEntry>,
        isEditMode: boolean,
        recordToEdit: CadernoEntry | null,
        justificativa: string
    ) => {
        setLoading(true);
        try {
            let finalPayload: CadernoEntry | null = null;
            const d = draft;

            if (activeTab === 'plantio') {
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.PLANTIO,
                    produto: d.produto,
                    quantidade_valor: parseFloat(d.quantidade) || 0,
                    quantidade_unidade: d.unidade,
                    valor_total: d.valor_total ?? undefined,
                    detalhes_tecnicos: { 
                        variedade: d.variedade, 
                        lote_semente: d.loteSemente, 
                        origem: d.origem 
                    }
                } as CadernoEntry;
            }
            else if (activeTab === 'manejo') {
                let detalhes: any = {
                    subtipo: d.subtipoManejo,
                    responsavel: d.responsavel,
                    tipo_manejo: d.tipoManejo
                };

                if (d.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) {
                    detalhes = { 
                        ...detalhes, 
                        insumo_aplicado: d.insumo, 
                        insumo: d.insumo, 
                        dosagem: d.dosagem, 
                        unidade_dosagem: d.unidadeDosagem, 
                        equipamento: d.equipamento 
                    };
                } else if (d.subtipoManejo === ManejoSubtype.HIGIENIZACAO) {
                    detalhes = { ...detalhes, item_higienizado: d.itemHigienizado, produto_utilizado: d.produtoUtilizado };
                } else {
                    detalhes = { ...detalhes, atividade: d.atividadeCultural, qtd_trabalhadores: parseInt(d.qtdTrabalhadores || '0', 10) };
                }

                let produtoRef = '';
                if (d.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) produtoRef = d.insumo;
                else if (d.subtipoManejo === ManejoSubtype.HIGIENIZACAO) produtoRef = `${d.itemHigienizado} (${d.produtoUtilizado})`;
                else produtoRef = d.atividadeCultural;

                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.MANEJO,
                    produto: produtoRef || d.produto,
                    valor_total: d.valor_total ?? undefined,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }
            else if (activeTab === 'colheita') {
                const detalhes = {
                    lote: d.lote,
                    destino: d.destino,
                    destino_inicial: d.destino_inicial,
                    classificacao: d.classificacao,
                    qtd: parseFloat(d.qtdColheita) || 0,
                    unidade: d.unidadeColheita
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.COLHEITA,
                    quantidade_valor: parseFloat(d.qtdColheita) || 0,
                    quantidade_unidade: d.unidadeColheita,
                    valor_total: d.valor_total ?? undefined,
                    detalhes_tecnicos: detalhes,
                    houve_descartes: d.houveDescartes,
                    qtd_descartes: d.houveDescartes ? (parseFloat(d.qtdDescartes) || 0) : undefined,
                    unidade_descartes: d.houveDescartes ? d.unidadeDescartes : undefined
                } as CadernoEntry;
            }
            else if (activeTab === 'compostagem') {
                const detalhes = {
                    acao: d.acao,
                    n_pilha: d.nPilha,
                    ingredientes: d.ingredientes,
                    temperatura: parseFloat(d.temperatura) || undefined,
                    responsavel: d.responsavel
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.COMPOSTAGEM,
                    produto: `${d.nPilha} (${d.acao})`,
                    detalhes_tecnicos: detalhes,
                    is_pmo_compostagem: true
                } as any;
            }
            else if (activeTab === 'vendas') {
                const detalhes = {
                    destinacao: d.destinacao,
                    valor_unitario: d.valorUnitario ? parseFloat(d.valorUnitario) : undefined,
                    cliente: d.cliente,
                    nf_recibo: d.nf,
                    qtd: parseFloat(d.quantidade) || 0,
                    unidade: d.unidade
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.VENDA,
                    quantidade_valor: parseFloat(d.quantidade) || 0,
                    quantidade_unidade: d.unidade,
                    fornecedor: d.cliente,
                    nota_fiscal: d.nf,
                    valor_total: d.valor_total ?? undefined,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }
            else if (activeTab === 'compras') {
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.INSUMO || 'Insumo',
                    produto: d.produto,
                    quantidade_valor: d.quantidade ? parseFloat(d.quantidade) : null,
                    quantidade_unidade: d.quantidade ? d.unidade : null,
                    fornecedor: d.fornecedor,
                    nota_fiscal: d.nfRecibo,
                    valor_total: d.valor_total ?? undefined,
                    detalhes_tecnicos: { tipo_registro: 'compra' }
                } as CadernoEntry;
            }
            else if (activeTab === 'limpeza') {
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: 'Limpeza',
                    produto: `${d.itemArea} (${d.tipoLimpeza})`,
                    responsavel: d.responsavel,
                    is_pmo_limpeza: true, 
                    data_limpeza: new Date(d.dataHora).toISOString().split('T')[0],
                    item_area: d.itemArea,
                    tipo_limpeza: d.tipoLimpeza,
                    produto_utilizado: d.produtoUtilizado,
                    dosagem: d.dosagem,
                    observacao: d.observacao
                } as any;
            }
            else {
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.OUTRO,
                    quantidade_valor: 0,
                    quantidade_unidade: UnitType.UNID,
                    detalhes_tecnicos: { tipo_registro: 'outro', subcategoria: 'geral' }
                } as CadernoEntry;
            }

            if (!finalPayload) return;

            if (isEditMode && recordToEdit) {
                const auditTrail = `[EDITADO em ${new Date().toLocaleString('pt-BR')}] Motivo: ${justificativa}\n\n`;
                finalPayload.observacao_original = auditTrail + (finalPayload.observacao_original || '');
                finalPayload.id = recordToEdit.id;
            }

            const result = await saveRecord(finalPayload as CadernoEntry);

            if (result.success) {
                clearDraft(activeTab);
                clearAllErrors();

                if (result.isOffline) {
                    toast.info(`💾 Salvo OFFLINE! ☁️❌\n\nSincronização pendente.`);
                } else {
                    toast.success("✅ Registro salvo com sucesso!");
                }

                onRecordSaved?.();
                onClose?.();
            } else {
                toast.error(`❌ Erro ao salvar: ${result.error}`);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(`💥 Erro crítico ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
            setOpenJustification(false);
        }
    }, [setLoading, saveRecord, clearDraft, clearAllErrors, onRecordSaved, onClose, setOpenJustification]);

    return { executeSave };
}
