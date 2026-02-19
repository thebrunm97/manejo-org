import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Trash2, Pencil, History, ListChecks } from 'lucide-react';

import MobileLogCard from './MobileLogCard';

import {
    CadernoEntry,
    ActivityType,
    ManejoSubtype,
    DetalhesManejo,
    DetalhesColheita,
    DetalhesPlantio
} from '../../types/CadernoTypes';

import ManualRecordDialog from '../Dashboard/ManualRecordDialog';
import { formatDateBR } from '../../utils/formatters';

interface GeneralLogTableProps {
    pmoId: number | undefined | null;
}

interface EditValues {
    atividade?: string;
    local?: string;
    produto?: string;
    quantidade?: string | number;
    valor?: string | number;
}

const GeneralLogTable: React.FC<GeneralLogTableProps> = ({ pmoId }) => {
    const [registros, setRegistros] = useState<CadernoEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    // Responsive check (replaces useMediaQuery)
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Estados do Modal
    const [openDialog, setOpenDialog] = useState(false);
    const [actionType, setActionType] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<CadernoEntry | null>(null);
    const [justificativa, setJustificativa] = useState('');

    // Edit Dialog State
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        if (pmoId) fetchRegistros();
    }, [pmoId]);

    const fetchRegistros = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('caderno_campo')
                .select('*')
                .eq('pmo_id', pmoId)
                .order('data_registro', { ascending: false });

            if (error) {
                console.error("Erro ao buscar registros:", error);
                throw error;
            }
            console.log('Registros com N:N:', data);
            // Cast to compatible type or let inference work if shape matches
            setRegistros((data as any[]) || []);
        } catch (error: any) {
            console.error("Erro ao buscar registros:", error);
            console.warn("Detalhes:", error.message);
            setRegistros([]);
        } finally {
            setLoading(false);
        }
    };

    const visibleRegistros = (showDeleted
        ? registros
        : registros.filter(r => r && r.tipo_atividade !== 'CANCELADO')) || [];

    // --- SMART RENDER DISCRIMINATED COLUMNS ---
    const renderDetails = (row: CadernoEntry) => {
        const details = row.detalhes_tecnicos || {};
        const tipo = row.tipo_atividade;

        // 1. Manejo
        if (tipo === ActivityType.MANEJO || tipo === 'Manejo') {
            const d = details as DetalhesManejo;

            // Higienização
            if (d.subtipo === ManejoSubtype.HIGIENIZACAO) {
                return (
                    <div>
                        {d.item_higienizado && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-blue-300 text-blue-800 bg-blue-50 mr-1">
                                🧹 {d.item_higienizado}
                            </span>
                        )}
                        {d.produto_utilizado && d.produto_utilizado !== 'NÃO INFORMADO' && (
                            <span className="text-xs text-gray-500">
                                com {d.produto_utilizado}
                            </span>
                        )}
                    </div>
                );
            }
            // Aplicação de Insumo
            if (d.subtipo === ManejoSubtype.APLICACAO_INSUMO) {
                const dose = d.dosagem ? `${d.dosagem}${d.unidade_dosagem || ''}` : '';
                return (
                    <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-amber-300 text-amber-800 bg-amber-50 mr-1">
                            💊 {d.insumo || d.nome_insumo || 'Insumo'}
                        </span>
                        {dose && <span className="text-xs">{dose}</span>}
                    </div>
                );
            }
            // Manejo Cultural (Default)
            const ativ = d.atividade || d.tipo_manejo || row.observacao_original;
            return (
                <p className="text-sm text-gray-900">
                    {ativ}
                </p>
            );
        }

        // 2. Colheita
        if (tipo === ActivityType.COLHEITA || tipo === 'Colheita') {
            const d = details as DetalhesColheita;
            return (
                <div>
                    {d.lote && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-1" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                            📦 {d.lote}
                        </span>
                    )}
                    {d.classificacao && (
                        <span className="text-xs font-bold" style={{ color: '#b45309' }}>
                            {d.classificacao}
                        </span>
                    )}
                </div>
            );
        }

        // 3. Plantio
        if (tipo === ActivityType.PLANTIO || tipo === 'Plantio') {
            const d = details as DetalhesPlantio;
            return (
                <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-green-300 text-green-800 bg-green-50 mr-1">
                        🌱 {d.metodo_propagacao || 'Plantio'}
                    </span>
                </div>
            );
        }

        // Default / Fallback
        return (
            <div title={row.observacao_original || ''}>
                <p className="text-sm truncate max-w-[300px]">
                    {row.observacao_original || '-'}
                </p>
            </div>
        );
    };


    const handleOpenAction = (item: CadernoEntry, type: string) => {
        setSelectedItem(item);
        setActionType(type);
        setJustificativa('');

        if (type === 'EDIT') {
            setIsEditOpen(true);
            return;
        }
        setOpenDialog(true);
    };

    const handleClose = () => {
        setOpenDialog(false);
        setSelectedItem(null);
    };

    const handleConfirmAction = async () => {
        if (justificativa.length < 5) {
            alert("A justificativa é obrigatória (mínimo 5 letras).");
            return;
        }

        if (!selectedItem) return;

        try {
            const logEntry = {
                data: new Date().toISOString(),
                acao: actionType,
                motivo: justificativa,
                dados_anteriores: {
                    tipo: selectedItem.tipo_atividade,
                    produto: selectedItem.produto,
                    qtd: selectedItem.quantidade_valor
                }
            };

            const currentDetails = selectedItem.detalhes_tecnicos || {};
            // @ts-ignore
            const historico = currentDetails.historico_alteracoes || [];
            const newDetails = {
                ...currentDetails,
                historico_alteracoes: [...historico, logEntry]
            };

            let updatePayload: any = {};

            if (actionType === 'DELETE') {
                updatePayload = {
                    tipo_atividade: 'CANCELADO',
                    observacao_original: `[CANCELADO] ${selectedItem.observacao_original}`,
                    detalhes_tecnicos: newDetails
                };
                // Only process DELETE here. EDIT is handled by ManualRecordDialog.
                if (actionType !== 'DELETE') return;

                const { data, error } = await supabase
                    .from('caderno_campo')
                    .update(updatePayload)
                    .eq('id', selectedItem.id)
                    .select();

                if (error) throw error;

                if (!data || data.length === 0) {
                    alert("⚠️ ATENÇÃO: O banco recusou a alteração. Verifique se o usuário tem permissão (RLS) no Supabase.");
                    return;
                }

                await fetchRegistros();
                handleClose();
            }

        } catch (err: any) {
            alert("Erro ao salvar: " + err.message);
        }
    };

    const getStatusClasses = (tipo: string): { bg: string; text: string; border: string } => {
        const map: Record<string, { bg: string; text: string; border: string }> = {
            'Insumo': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
            'Manejo': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
            'Plantio': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
            'Colheita': { bg: 'bg-primary-main/10', text: 'text-primary-dark', border: 'border-primary-main/30' },
            'CANCELADO': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
        };
        return map[tipo] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
    };


    if (!pmoId) return (
        <div className="p-3 text-center text-gray-500">
            Carregando caderno...
        </div>
    );

    return (
        <div className="mt-0 p-2 bg-white rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <h6 className="flex items-center gap-1 font-bold text-lg">
                    <ListChecks className="w-5 h-5" /> Diário de Campo Completo (Auditoria)
                </h6>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-600">Ver Excluídos</span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={showDeleted}
                            onChange={(e) => setShowDeleted(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-red-500 transition-colors"></div>
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                    </div>
                </label>
            </div>

            {/* --- DESKTOP TABLE --- */}
            <div className="hidden sm:block w-full">
                <div className="w-full overflow-x-auto block border border-gray-200 rounded-xl shadow-sm bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Data</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Atividade</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Produto / Local</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Qtd</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center">
                                    <div className="flex justify-center py-2">
                                        <div className="w-6 h-6 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                                    </div>
                                </td></tr>
                            ) : (visibleRegistros || []).length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                            ) : (
                                (visibleRegistros || []).map((row) => {
                                    if (!row) return null; // Proteção contra linhas nulas
                                    const isCancelado = row.tipo_atividade === 'CANCELADO';
                                    const details = row.detalhes_tecnicos as any || {};
                                    const historico = details.historico_alteracoes || [];
                                    const ultimaJustificativa = historico.length > 0 ? historico[historico.length - 1].motivo : null;
                                    const sc = getStatusClasses(row.tipo_atividade);

                                    return (
                                        <tr
                                            key={row.id}
                                            className={`hover:bg-gray-50 transition-colors ${isCancelado ? 'bg-red-50/50' : ''}`}
                                            style={{ opacity: isCancelado ? 0.8 : 1 }}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                                                {formatDateBR(row.data_registro)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${isCancelado ? `border ${sc.border} ${sc.text} bg-transparent` : `${sc.bg} ${sc.text}`
                                                    }`}>
                                                    {row.tipo_atividade}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 align-top">
                                                <div className={isCancelado ? 'line-through decoration-red-500 text-red-700' : 'font-medium'}>
                                                    {row.produto}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {row.caderno_campo_canteiros && row.caderno_campo_canteiros.length > 0
                                                        ? `Canteiros: ${row.caderno_campo_canteiros.map((c: any) => c.canteiros?.nome).join(', ')}`
                                                        : (row.talhao_canteiro !== 'NÃO INFORMADO' ? row.talhao_canteiro : '')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                                                {Number(row.quantidade_valor) > 0 ? (
                                                    <>
                                                        {row.quantidade_valor}
                                                        {row.quantidade_unidade ? ` ${row.quantidade_unidade}` : ''}
                                                    </>
                                                ) : '-'}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-gray-900 align-top max-w-xs">
                                                {/* SMART RENDER HERE */}
                                                <div className={isCancelado ? 'line-through decoration-gray-400' : ''}>
                                                    {renderDetails(row)}
                                                </div>

                                                {isCancelado && ultimaJustificativa && (
                                                    <div className="mt-2 p-1.5 px-2 bg-red-50 rounded border border-dashed border-red-300 inline-block">
                                                        <span className="text-xs font-bold text-red-600">
                                                            MOTIVO: {ultimaJustificativa}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                                {!isCancelado ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            title="Corrigir"
                                                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                                            onClick={() => handleOpenAction(row, 'EDIT')}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            title="Invalidar"
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                            onClick={() => handleOpenAction(row, 'DELETE')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span title="Registro Auditado" className="text-gray-400 cursor-not-allowed">
                                                        <History className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MOBILE CARDS --- */}
            <div className="block sm:hidden">
                {loading ? (
                    <div className="flex justify-center p-3">
                        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                    </div>
                ) : (visibleRegistros || []).length === 0 ? (
                    <div className="p-4 text-center text-gray-500 bg-gray-100 rounded-lg">
                        Nenhum registro encontrado.
                    </div>
                ) : (
                    (visibleRegistros || []).map((row) => (
                        <MobileLogCard
                            key={row.id}
                            reg={row}
                            onEdit={(item: any) => handleOpenAction(item, 'EDIT')}
                            onDelete={(item: any) => handleOpenAction(item, 'DELETE')}
                        />
                    ))
                )}
            </div>

            {/* Delete Confirmation Dialog (native) */}
            {openDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className={`text-lg font-bold mb-2 ${actionType === 'DELETE' ? 'text-red-600' : 'text-primary-main'}`}>
                                {actionType === 'DELETE' ? 'Invalidar Registro' : 'Corrigir Registro'}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                {actionType === 'DELETE'
                                    ? "O registro será marcado como CANCELADO, mas mantido para auditoria."
                                    : "As alterações serão salvas no histórico do registro."}
                            </p>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-700">Justificativa (Obrigatória)</label>
                                <textarea
                                    autoFocus
                                    rows={2}
                                    className={`w-full px-3 py-2 rounded-md border bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-colors ${justificativa.length > 0 && justificativa.length < 5
                                            ? 'border-red-500 focus:ring-red-500/30 focus:border-red-500'
                                            : 'border-gray-300 focus:ring-primary-main/30 focus:border-primary-main'
                                        }`}
                                    value={justificativa}
                                    onChange={e => setJustificativa(e.target.value)}
                                    placeholder="Ex: Erro de digitação, produto errado, duplicidade..."
                                />
                                <p className="text-xs text-gray-500">Ex: Erro de digitação, produto errado, duplicidade...</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 pb-6">
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                                onClick={handleClose}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${actionType === 'DELETE'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-primary-main hover:bg-primary-dark'
                                    }`}
                                onClick={handleConfirmAction}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <ManualRecordDialog
                open={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                pmoId={pmoId || 0}
                recordToEdit={selectedItem}
                onRecordSaved={() => {
                    fetchRegistros();
                    setIsEditOpen(false);
                }}
            />
        </div>
    );
};

export default GeneralLogTable;
