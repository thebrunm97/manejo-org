import React from 'react';
import { Pencil, Trash2, History } from 'lucide-react';
import { CadernoEntry } from '../../types/CadernoTypes';
import { formatDateBR, formatComplianceMessage } from '../../utils/formatters';
import { AlertTriangle } from 'lucide-react';

// Type for activity chip colors
type ChipColorClass = string;

const getStatusClasses = (tipo: string | undefined): { bg: string; text: string; border: string } => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
        'Insumo': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
        'Manejo': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
        'Plantio': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
        'Colheita': { bg: 'bg-primary-main/10', text: 'text-primary-dark', border: 'border-primary-main/30' },
        'CANCELADO': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
        'Outro': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    };
    return map[tipo || ''] || map['Outro'];
};

// Interface for component props
interface MobileLogCardProps {
    reg: CadernoEntry;
    onEdit?: (reg: CadernoEntry) => void;
    onDelete?: (reg: CadernoEntry) => void;
}

const MobileLogCard: React.FC<MobileLogCardProps> = ({ reg, onEdit, onDelete }) => {
    const isCancelado = reg.tipo_atividade === 'CANCELADO';
    const details = reg.detalhes_tecnicos as Record<string, any> || {};
    const historico = details.historico_alteracoes || [];
    const ultimaJustificativa = historico.length > 0 ? historico[historico.length - 1].motivo : null;

    // Helper: Check if value is valid (not empty, not "NÃO INFORMADO")
    const isValidValue = (val: string | number | undefined | null): boolean => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'string') {
            return val.trim() !== '' && val !== 'NÃO INFORMADO';
        }
        return true;
    };

    // Helper: Format quantity display
    const formatQuantidade = (): string => {
        const valor = reg.quantidade_valor;
        const unidade = reg.quantidade_unidade;

        if (!valor || Number(valor) <= 0) return '';

        const valorStr = String(valor);
        const unidadeStr = isValidValue(unidade) ? ` ${unidade}` : '';

        return `${valorStr}${unidadeStr}`;
    };

    const statusClasses = getStatusClasses(reg.tipo_atividade);

    return (
        <div
            className={`mb-2 rounded-xl overflow-visible border-none shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${isCancelado ? 'opacity-70' : ''}`}
        >
            <div className="p-2">
                {/* HEADER: Tipo e Data */}
                <div className="flex flex-row justify-between items-center mb-1.5">
                    <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-extrabold ${isCancelado
                                ? `border ${statusClasses.border} ${statusClasses.text} bg-transparent`
                                : `${statusClasses.bg} ${statusClasses.text}`
                            }`}
                        style={{ height: 24 }}
                    >
                        {reg.tipo_atividade || 'Atividade'}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                        {formatDateBR(reg.data_registro)}
                    </span>
                </div>

                {/* BODY: Produto e Local */}
                <div className="mb-1.5">
                    {isValidValue(reg.produto) && (
                        <p
                            className={`text-[1.05rem] font-extrabold leading-tight mb-0.5 ${isCancelado ? 'text-gray-500 line-through' : 'text-gray-900'
                                }`}
                        >
                            {reg.produto}
                        </p>
                    )}

                    {isValidValue(reg.talhao_canteiro) && (
                        <div className="flex flex-row items-center gap-0.5">
                            <span className="text-[0.85rem] text-gray-500 flex items-center gap-0.5">
                                📍 {reg.talhao_canteiro}
                            </span>
                        </div>
                    )}

                    {/* Detalhes Técnicos (Receita/Obs) */}
                    {(details.receita || reg.observacao_original) && (
                        <>
                            {formatComplianceMessage(reg.observacao_original) ? (
                                <div className="relative flex items-center group cursor-pointer mt-2 w-fit">
                                    <div className="flex items-center gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                                        <span className="font-bold">Ver Alerta de Compliance</span>
                                    </div>

                                    {/* Tooltip Overlay */}
                                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block group-active:block w-72 p-4 text-sm text-amber-900 bg-white border border-amber-200 rounded-lg shadow-2xl z-50 pointer-events-none">
                                        <div className="absolute top-full left-6 -mt-[1px] border-4 border-transparent border-t-amber-200"></div>
                                        <p className="font-bold mb-1 uppercase tracking-widest text-[10px] text-amber-600">Alerta de Compliance</p>
                                        {formatComplianceMessage(reg.observacao_original)}
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-1 block italic text-xs leading-tight text-gray-400">
                                    "{details.receita || reg.observacao_original}"
                                </p>
                            )}
                        </>
                    )}

                    {isCancelado && ultimaJustificativa && (
                        <p className="mt-1 block text-xs font-bold text-red-500">
                            MOTIVO: {ultimaJustificativa}
                        </p>
                    )}
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* FOOTER: Quantidade e Ações */}
            <div className="p-1 pl-2 flex justify-between items-center bg-gray-50/80">
                <span className="text-[0.95rem] font-bold text-primary-main">
                    {formatQuantidade()}
                </span>

                <div className="flex flex-row gap-1">
                    {onEdit && onDelete && !isCancelado ? (
                        <>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center p-2 text-indigo-700 transition-colors bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => onEdit(reg)}
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center p-2 text-red-700 transition-colors bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => onDelete(reg)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled
                            className="inline-flex items-center justify-center p-2 text-gray-400 bg-gray-100 border border-gray-200 rounded-md cursor-not-allowed opacity-50"
                        >
                            <History className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MobileLogCard;
