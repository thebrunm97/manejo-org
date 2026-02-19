import React from 'react';
import {
    X,
    Calendar,
    MapPin,
    Mic,
    Activity,
    Package,
    Sprout,
    FlaskConical,
    Scissors,
    AlertTriangle
} from 'lucide-react';
import { formatDateBR, formatComplianceMessage } from '../../utils/formatters';
import { CadernoCampoRecord, DetalhesColheita, DetalhesManejo, DetalhesPlantio } from '../../types/CadernoTypes';

export interface RecordDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    record: CadernoCampoRecord | null;
}

// Fallback icon for Manejo if needed, or reuse one
const SprayCanIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h18v18H3z" stroke="none" />
        <path d="M12 2v4M8 6h8M8 10h8M12 10v6M9 16c-1.5 0-2 1.5-2 3v3h10v-3c0-1.5-.5-3-2-3" />
    </svg>
);

const getIconByType = (tipo: string) => {
    switch (tipo) {
        case 'colheita': return <AgricultureIcon />;
        case 'manejo': return <SprayCanIcon />;
        case 'insumo': return <Inventory2Icon />;
        case 'plantio': return <SpaIcon />;
        default: return <LocalFloristIcon />;
    }
};

const RecordDetailsDialog: React.FC<RecordDetailsDialogProps> = ({ open, onClose, record }) => {
    if (!open || !record) return null;

    const rawTipo = record.tipo_atividade || 'Outro';
    const tipo = rawTipo.toLowerCase();
    const details = record.detalhes_tecnicos || {};
    const complianceMsg = formatComplianceMessage(record.observacao_original);

    const getIconByType = (tipo: string) => {
        switch (tipo) {
            case 'colheita': return <Scissors className="w-5 h-5" />;
            case 'manejo': return <FlaskConical className="w-5 h-5" />;
            case 'insumo': return <Package className="w-5 h-5" />;
            case 'plantio': return <Sprout className="w-5 h-5" />;
            default: return <Activity className="w-5 h-5" />;
        }
    };

    const getSistemaBadge = () => {
        if (!record.sistema || record.sistema === 'monocultura') return null;
        const config = {
            consorcio: { label: 'CONSÓRCIO', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
            saf: { label: 'SAF', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' }
        };
        const c = config[record.sistema as 'consorcio' | 'saf'];
        if (!c) return null;
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${c.bg} ${c.color} ${c.border} ml-2 tracking-wider`}>
                {c.label}
            </span>
        );
    };

    const locais = (record.caderno_campo_canteiros && record.caderno_campo_canteiros.length > 0)
        ? record.caderno_campo_canteiros.map(c => c.canteiros?.nome).filter(Boolean) as string[]
        : (record.talhao_canteiro || '').split(';').map(part => part.trim()).filter(Boolean);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-hidden" aria-modal="true" role="dialog">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-md border border-gray-100 text-gray-700 shadow-sm">
                            {getIconByType(tipo)}
                        </div>
                        <div>
                            <div className="flex items-center">
                                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                    {rawTipo}
                                </h3>
                                {getSistemaBadge()}
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold uppercase tracking-wide">
                                    {formatDateBR(record.data_registro, { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-md transition-colors border border-transparent hover:border-gray-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

                    {/* Compliance Alert Box (Mandatory) */}
                    {complianceMsg && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">Alerta de Compliance</p>
                                <p className="text-sm text-amber-800 leading-relaxed">{complianceMsg}</p>
                            </div>
                        </div>
                    )}

                    {/* Data List */}
                    <dl className="divide-y divide-gray-100 border-t border-b border-gray-100 px-1">

                        {/* Produto/Cultura */}
                        {record.produto && record.produto !== 'NÃO INFORMADO' && (
                            <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Produto / Cultura</dt>
                                <dd className="mt-1 text-sm font-semibold text-gray-900 sm:col-span-2 sm:mt-0 flex items-center gap-1.5 capitalize">
                                    🌱 {record.produto}
                                </dd>
                            </div>
                        )}

                        {/* Localização */}
                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Localização</dt>
                            <dd className="mt-1 text-sm font-semibold text-gray-900 sm:col-span-2 sm:mt-0 flex flex-wrap gap-1.5">
                                {locais.length > 0 ? (
                                    locais.map((l, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs">
                                            <MapPin className="w-3 h-3" /> {l}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-400 italic font-normal">Geral / Não informado</span>
                                )}
                            </dd>
                        </div>

                        {/* Quantidade (Se houver) */}
                        {Number(record.quantidade_valor) > 0 && (
                            <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Quantidade</dt>
                                <dd className="mt-1 text-sm font-bold text-green-700 sm:col-span-2 sm:mt-0">
                                    {record.quantidade_valor}
                                    <span className="text-xs text-gray-500 font-medium ml-1 lowercase">{record.quantidade_unidade}</span>
                                </dd>
                            </div>
                        )}

                        {/* Detalhes Específicos do Tipo */}
                        {tipo === 'colheita' && (() => {
                            const d = details as DetalhesColheita;
                            return (
                                <>
                                    {d.lote && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Nº Lote</dt>
                                            <dd className="mt-1 text-sm font-mono text-gray-700 sm:col-span-2 sm:mt-0">{d.lote}</dd>
                                        </div>
                                    )}
                                    {d.classificacao && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Classificação</dt>
                                            <dd className="mt-1 text-sm font-semibold text-gray-900 sm:col-span-2 sm:mt-0">{d.classificacao}</dd>
                                        </div>
                                    )}
                                    {d.destino && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Destino</dt>
                                            <dd className="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{d.destino}</dd>
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {(tipo === 'manejo' || tipo === 'insumo') && (() => {
                            const d = details as DetalhesManejo;
                            const insumo = d.nome_insumo || d.insumo;
                            return (
                                <>
                                    {insumo && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Insumo</dt>
                                            <dd className="mt-1 text-sm font-bold text-indigo-700 sm:col-span-2 sm:mt-0">{insumo}</dd>
                                        </div>
                                    )}
                                    {d.dosagem && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Dosagem</dt>
                                            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{d.dosagem} {d.unidade_dosagem}</dd>
                                        </div>
                                    )}
                                    {d.metodo_aplicacao && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Método</dt>
                                            <dd className="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{d.metodo_aplicacao}</dd>
                                        </div>
                                    )}
                                    {d.responsavel && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Responsável</dt>
                                            <dd className="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{d.responsavel}</dd>
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {tipo === 'plantio' && (() => {
                            const d = details as DetalhesPlantio;
                            return (
                                <>
                                    {d.metodo_propagacao && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Propagação</dt>
                                            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{d.metodo_propagacao}</dd>
                                        </div>
                                    )}
                                    {d.lote_semente && (
                                        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center">Lote Semente</dt>
                                            <dd className="mt-1 text-sm font-mono text-gray-700 sm:col-span-2 sm:mt-0">{d.lote_semente}</dd>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </dl>

                    {/* Observações Originais (Non-compliance or long notes) */}
                    {!complianceMsg && record.observacao_original && (
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Observações</h4>
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                <p className="text-sm text-slate-600 leading-relaxed italic whitespace-pre-wrap">
                                    "{record.observacao_original}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Prova de Auditoria: Áudio */}
                    {record.audio_url && (
                        <div className="space-y-2 pt-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Mic className="w-3.5 h-3.5 text-green-600" /> Prova de Auditoria (Áudio)
                            </h4>
                            <div className="p-3 bg-green-50/50 border border-green-100 rounded-lg flex flex-col gap-2">
                                <audio
                                    controls
                                    src={record.audio_url}
                                    className="w-full h-8"
                                    preload="metadata"
                                />
                                <p className="text-[10px] text-green-700 italic font-medium opacity-75">
                                    Transcrição automática via WhatsApp Gateway
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 border border-transparent rounded-md text-sm font-bold text-white hover:bg-gray-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecordDetailsDialog;
