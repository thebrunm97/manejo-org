import React, { useState, useEffect } from 'react';
import {
    X,
    ChevronDown,
    MapPin,
    Loader2,
    Check,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface LocationSelectorProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (locais: string[]) => void;
    pmoId: number;
    initialSelected?: string[];
}

interface CanteiroDB {
    nome: string;
}

interface TalhaoDB {
    nome: string;
    canteiros: CanteiroDB[];
}

const LocationSelectorDialog: React.FC<LocationSelectorProps> = ({
    open,
    onClose,
    onConfirm,
    pmoId,
    initialSelected = []
}) => {
    const [loading, setLoading] = useState(false);
    const [talhoes, setTalhoes] = useState<{ nome: string; canteiros: string[]; expanded: boolean }[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Efeito de hidratação: Carrega dados e seleção inicial
    useEffect(() => {
        if (open) {
            if (pmoId) fetchLocais();
            const validSelection = (initialSelected || []).filter(Boolean);
            setSelected(validSelection);
        }
    }, [open, pmoId]);

    const fetchLocais = async () => {
        setLoading(true);
        setErrorMsg(null);
        const agrupado: Record<string, string[]> = {};

        try {
            // 1. BUSCA ESTRUTURAL
            const { data, error } = await supabase
                .from('talhoes')
                .select(`
                  nome,
                  canteiros ( nome )
                `);

            if (error) throw error;

            const infraData = data as unknown as TalhaoDB[];

            if (infraData) {
                infraData.forEach((talhao) => {
                    const nomeTalhao = talhao.nome || 'Sem Nome';
                    agrupado[nomeTalhao] = [];

                    if (talhao.canteiros && talhao.canteiros.length > 0) {
                        talhao.canteiros.forEach((c) => {
                            agrupado[nomeTalhao].push(c.nome);
                        });
                    } else {
                        agrupado[nomeTalhao].push('Área Total');
                    }
                });
            }

            // 2. BUSCA LEGADA
            const { data: pmoData } = await supabase
                .from('pmo_culturas')
                .select('localizacao')
                .eq('pmo_id', pmoId);

            if (pmoData) {
                pmoData.forEach((item: any) => {
                    const loc = item.localizacao;
                    if (typeof loc === 'string' && !loc.startsWith('{') && !loc.startsWith('[')) {
                        let encontrou = false;
                        Object.keys(agrupado).forEach(t => {
                            if (loc.includes(t)) encontrou = true;
                        });
                        if (!encontrou) {
                            if (!agrupado['Locais Legados']) agrupado['Locais Legados'] = [];
                            if (!agrupado['Locais Legados'].includes(loc)) agrupado['Locais Legados'].push(loc);
                        }
                    }
                });
            }

            // Ordenação
            Object.keys(agrupado).forEach(key => {
                agrupado[key].sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.replace(/\D/g, '')) || 0;
                    return numA - numB || a.localeCompare(b);
                });
            });

            setTalhoes(Object.entries(agrupado).map(([nome, canteiros]) => ({
                nome,
                canteiros,
                expanded: true // Default expanded
            })));

        } catch (error) {
            console.error("Erro ao buscar locais:", error);
            setErrorMsg("Falha ao carregar infraestrutura. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (fullPath: string, simpleName: string) => {
        const isSelected = selected.includes(fullPath) || selected.includes(simpleName);
        if (isSelected) {
            setSelected(prev => prev.filter(p => p !== fullPath && p !== simpleName));
        } else {
            setSelected(prev => [...prev, fullPath]);
        }
    };

    const toggleTalhao = (index: number) => {
        setTalhoes(prev => prev.map((t, i) => i === index ? { ...t, expanded: !t.expanded } : t));
    };

    if (!open) return null;

    return (
        /* --- Root Modal Overlay --- */
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">

            {/* --- Modal Container --- */}
            <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MapPin className="text-green-600 w-5 h-5" />
                        Selecionar Locais
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-500 hover:bg-slate-50 rounded-full p-2 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading && (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                            <p className="text-sm font-medium">Carregando locais...</p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-md flex items-start gap-3 text-red-700">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">{errorMsg}</p>
                        </div>
                    )}

                    {!loading && !errorMsg && talhoes.length === 0 && (
                        <div className="py-12 text-center text-slate-500">
                            <p className="text-sm">Nenhum local cadastrado para este PMO.</p>
                        </div>
                    )}

                    {!loading && !errorMsg && talhoes.map((t, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                            <button
                                type="button"
                                onClick={() => toggleTalhao(idx)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                            >
                                <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                                    {t.nome}
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={`text-slate-400 transition-transform duration-200 ${t.expanded ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {t.expanded && (
                                <div className="p-2 bg-white grid grid-cols-1 sm:grid-cols-2 gap-1 border-t border-slate-100">
                                    {t.canteiros.map((c: string) => {
                                        const path = `${t.nome} > ${c}`;
                                        const isChecked = selected.includes(path) || selected.includes(c);

                                        return (
                                            <label
                                                key={c}
                                                className={`
                                                    flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors
                                                    ${isChecked ? 'bg-green-50 text-green-800' : 'hover:bg-slate-50 text-slate-600'}
                                                `}
                                            >
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="peer h-4 w-4 border-slate-300 rounded text-green-600 focus:ring-green-500 transition-all cursor-pointer appearance-none border"
                                                        checked={isChecked}
                                                        onChange={() => handleToggle(path, c)}
                                                    />
                                                    <Check
                                                        size={12}
                                                        className={`absolute left-0.5 text-white pointer-events-none transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}`}
                                                        strokeWidth={4}
                                                    />
                                                    {isChecked && (
                                                        <div className="absolute inset-0 bg-green-600 rounded -z-10 h-4 w-4"></div>
                                                    )}
                                                </div>
                                                <span className="text-sm font-medium truncate">{c}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 rounded-b-lg">
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                        {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => { onConfirm(selected); onClose(); }}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors shadow-sm"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocationSelectorDialog;
