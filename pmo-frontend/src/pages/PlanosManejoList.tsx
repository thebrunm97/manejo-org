/**
 * @file PlanosManejoList.tsx
 * @description View para listagem de PMOs (Planos de Manejo Orgânico).
 * 
 * ✅ REFACTORED: Toda lógica extraída para usePlanosListLogic hook.
 * ✅ Sestilo: Tailwind CSS (SaaS Moderno).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Hook com toda a lógica
import { usePlanosListLogic } from '../hooks/pmo/usePlanosListLogic';

// Domain Types
import type { PmoListItem } from '../domain/pmo/pmoTypes';

// Ícones (Lucide)
import {
    Plus,
    FileText,
    CheckCircle,
    Hourglass,
    Edit,
    AlertCircle,
    Trash2,
    BookOpen,
    Power,
    FileQuestion
} from 'lucide-react';

// ==================================================================
// ||                    COMPONENTS HELPERS                        ||
// ==================================================================

const Spinner = ({ size = 'small', color = 'border-green-600' }: { size?: 'small' | 'medium', color?: string }) => {
    const dim = size === 'small' ? 'h-4 w-4' : 'h-8 w-8';
    return (
        <div className={`animate-spin rounded-full ${dim} border-b-2 ${color}`}></div>
    );
};

// ==================================================================
// ||                    CARD COMPONENT                            ||
// ==================================================================

interface PmoCardProps {
    pmo: PmoListItem;
    isActive: boolean;
    isActivating: boolean;
    isDeleting: boolean;
    onActivate: (pmoId: string) => void;
    onDelete: (pmo: PmoListItem) => void;
}

const PmoCard: React.FC<PmoCardProps> = ({
    pmo,
    isActive,
    isActivating,
    isDeleting,
    onActivate,
    onDelete
}) => {
    const navigate = useNavigate();

    const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
        'RASCUNHO': { label: 'Rascunho', bg: 'bg-gray-100', text: 'text-gray-700', icon: Edit },
        'CONCLUÍDO': { label: 'Concluído', bg: 'bg-blue-50', text: 'text-blue-700', icon: Hourglass },
        'APROVADO': { label: 'Aprovado', bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
        'REPROVADO': { label: 'Reprovado', bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
    };
    const currentStatus = statusConfig[pmo.status] || statusConfig['RASCUNHO'];
    const StatusIcon = currentStatus.icon;

    // Actions disabled
    const isBusy = isActivating || isDeleting;

    return (
        <div className={`
            bg-white rounded-lg border border-gray-200 p-6 shadow-sm 
            hover:shadow-md hover:-translate-y-1 transition-all duration-200 
            flex flex-col h-full min-w-0
            ${isActive ? 'ring-2 ring-green-500 border-transparent shadow-[0_4px_20px_rgba(22,163,74,0.15)]' : ''}
            ${isBusy ? 'opacity-70 pointer-events-none' : ''}
        `}>
            {/* Header: Icon + Title + Status */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`
                        p-2.5 rounded-lg flex-shrink-0
                        ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                    `}>
                        <FileText size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3
                            className="text-lg font-semibold text-gray-900 truncate pr-2"
                            title={pmo.nome_identificador}
                        >
                            {pmo.nome_identificador}
                        </h3>
                        <p className="text-sm text-gray-500">Versão {pmo.version || '1'}</p>
                    </div>
                </div>
            </div>

            {/* Badges / Info */}
            <div className="mb-4 space-y-2">
                {isActive && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                        ✓ ATIVO NO ZAP
                    </span>
                )}

                <div className="flex">
                    <span className={`
                        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${currentStatus.bg} ${currentStatus.text} border-transparent
                    `}>
                        <StatusIcon size={12} />
                        {currentStatus.label}
                    </span>
                </div>
            </div>

            {/* Date */}
            <div className="mt-auto">
                <p className="text-xs text-gray-400 mb-4 pt-4 border-t border-gray-100">
                    Criado em: {new Date(pmo.created_at).toLocaleDateString('pt-BR')}
                </p>

                {/* Actions Footer */}
                <div className="flex items-center gap-2 pt-2">
                    {/* Primary Actions */}
                    <button
                        onClick={() => navigate(`/pmo/${pmo.id}/editar?aba=caderno`)}
                        className="p-2 text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title="Abrir Caderno de Campo"
                        disabled={isBusy}
                    >
                        <BookOpen size={20} />
                    </button>

                    <button
                        onClick={() => onActivate(pmo.id)}
                        className={`p-2 rounded-lg transition-colors ${isActive
                            ? 'text-green-600 cursor-default'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                        title={isActive ? "Plano Ativo" : "Ativar no WhatsApp"}
                        disabled={isActive || isBusy}
                    >
                        {isActivating ? <Spinner /> : <Power size={20} />}
                    </button>

                    <div className="flex-1"></div>

                    {/* Secondary Actions */}
                    <button
                        onClick={() => navigate(`/pmo/${pmo.id}/editar`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar Plano"
                        disabled={isBusy}
                    >
                        <Edit size={20} />
                    </button>

                    <button
                        onClick={() => onDelete(pmo)}
                        className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Plano"
                        disabled={isBusy}
                    >
                        {isDeleting ? <Spinner color="border-red-600" /> : <Trash2 size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==================================================================
// ||                    PAGE COMPONENT                            ||
// ==================================================================

const PlanosManejoList: React.FC = () => {
    const navigate = useNavigate();

    // Hook Data
    const {
        pmos,
        activePmoId,
        listLoading,
        activatingId,
        deletingId,
        handleActivatePmo,
        handleDeletePmo
    } = usePlanosListLogic();

    // Local State (Modal)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pmoToDelete, setPmoToDelete] = useState<PmoListItem | null>(null);

    const handleOpenDeleteDialog = (pmo: PmoListItem) => {
        setPmoToDelete(pmo);
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setPmoToDelete(null);
    };

    const handleConfirmDelete = async () => {
        if (pmoToDelete) {
            await handleDeletePmo(pmoToDelete.id);
        }
        handleCloseDeleteDialog();
    };

    // Render Loading
    if (listLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen text-green-600">
                <Spinner size="medium" color="border-green-600" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 min-h-full pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                        Gerenciar Planos
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Visualize, edite ou crie novos planos digitais.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/pmo/novo')}
                    className="
                        inline-flex items-center justify-center gap-2 
                        px-4 py-2.5 rounded-lg 
                        bg-green-600 hover:bg-green-700 
                        text-white font-medium shadow-sm transition-colors
                        w-full md:w-auto
                    "
                >
                    <Plus size={20} />
                    Novo Plano
                </button>
            </div>

            {/* List */}
            {pmos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 w-full min-w-0">
                    {pmos.map(pmo => (
                        <PmoCard
                            key={pmo.id}
                            pmo={pmo}
                            isActive={activePmoId === pmo.id}
                            isActivating={activatingId === pmo.id}
                            isDeleting={deletingId === pmo.id}
                            onActivate={handleActivatePmo}
                            onDelete={handleOpenDeleteDialog}
                        />
                    ))}
                </div>
            ) : (
                // Empty State
                <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 mb-4">
                        <FileQuestion className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">Nenhum plano encontrado</h3>
                    <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                        Você ainda não tem nenhum Plano de Manejo Orgânico cadastrado.
                    </p>
                    <div className="mt-6">
                        <button
                            onClick={() => navigate('/pmo/novo')}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 bg-white rounded-lg hover:bg-green-50 font-medium transition-colors"
                        >
                            <Plus size={18} />
                            Criar meu primeiro plano
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Modal (Native-ish Tailwind) */}
            {deleteDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            Confirmar Exclusão
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Tem certeza que deseja excluir <strong>"{pmoToDelete?.nome_identificador}"</strong>?
                            <br />
                            <span className="text-sm text-red-600 mt-1 block">Esta ação não pode ser desfeita.</span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCloseDeleteDialog}
                                className="px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 font-medium shadow-sm transition-colors"
                            >
                                Excluir Permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanosManejoList;
