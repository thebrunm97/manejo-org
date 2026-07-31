import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, History, CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Evaluation {
    status: string;
    verdict?: string;
    faithfulness_score?: number;
    answer_relevance_score?: number;
    confidence_score?: number;
    reasoning?: string;
}

interface Run {
    id: string;
    requested_model_name: string;
    actual_model_used?: string;
    status: string;
    error_type?: string;
    latency_ms?: number;
    response_text?: string;
    tokens_used_prompt?: number;
    tokens_used_completion?: number;
    tokens_cache_read?: number;
    tokens_cache_write?: number;
    exact_cost_usd?: number;
    rag_experiment_evaluations?: Evaluation[];
}

interface Experiment {
    id: string;
    query_text: string;
    created_at: string;
    rag_experiment_runs?: Run[];
}

export const PlaygroundHistory: React.FC = () => {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedExpId, setExpandedExpId] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('rag_experiments')
                .select(`
                    id,
                    query_text,
                    created_at,
                    rag_experiment_runs (
                        id,
                        requested_model_name,
                        actual_model_used,
                        status,
                        error_type,
                        latency_ms,
                        response_text,
                        tokens_used_prompt,
                        tokens_used_completion,
                        tokens_cache_read,
                        tokens_cache_write,
                        exact_cost_usd,
                        rag_experiment_evaluations (
                            status,
                            verdict,
                            faithfulness_score,
                            answer_relevance_score,
                            context_relevance_score,
                            reasoning:reasoning_short
                        )
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error("Error fetching history:", error);
            } else {
                setExperiments(data as unknown as Experiment[]);
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedExpId(prev => (prev === id ? null : id));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-agro-floresta/60">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="font-mono text-sm uppercase tracking-widest">Carregando Histórico...</p>
            </div>
        );
    }

    if (experiments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-agro-floresta/60 bg-white/40 border border-dashed border-agro-ouro/30 rounded-2xl">
                <History className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-mono text-sm uppercase tracking-widest">Nenhum teste encontrado.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-agro-floresta flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Últimas Avaliações
                </h3>
            </div>

            <div className="space-y-4">
                {experiments.map((exp) => {
                    const isExpanded = expandedExpId === exp.id;
                    const runs = exp.rag_experiment_runs || [];

                    return (
                        <div key={exp.id} className="bg-white/80 backdrop-blur-md border border-agro-ouro/20 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 hover:border-agro-ouro/40">
                            {/* Card Header (Clickable) */}
                            <div 
                                className="p-5 cursor-pointer flex items-center justify-between group"
                                onClick={() => toggleExpand(exp.id)}
                            >
                                <div className="flex-1">
                                    <h4 className="font-bold text-agro-floresta text-base line-clamp-1 group-hover:text-green-700 transition-colors">
                                        "{exp.query_text}"
                                    </h4>
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="text-xs text-agro-floresta/50 font-mono">
                                            {new Date(exp.created_at).toLocaleString('pt-BR')}
                                        </span>
                                        <span className="text-xs font-medium text-agro-floresta/60 bg-agro-floresta/5 px-2 py-0.5 rounded-full">
                                            {runs.length} {runs.length === 1 ? 'modelo testado' : 'modelos testados'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="ml-4 shrink-0 w-8 h-8 rounded-full bg-agro-floresta/5 flex items-center justify-center text-agro-floresta/50 group-hover:bg-agro-floresta/10 group-hover:text-agro-floresta transition-colors">
                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                            </div>

                            {/* Expanded Content (Runs details) */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="border-t border-agro-ouro/10 bg-white/50"
                                    >
                                        <div className="p-5 space-y-4">
                                            {runs.length > 0 ? (
                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                    {runs.map((run) => {
                                                        const ev = run.rag_experiment_evaluations?.[0];
                                                        
                                                        return (
                                                            <div key={run.id} className="bg-white border border-agro-ouro/20 rounded-xl p-4 shadow-sm flex flex-col">
                                                                <div className="flex items-start justify-between mb-3 pb-3 border-b border-agro-ouro/10">
                                                                    <div>
                                                                            <h5 className="font-bold text-agro-floresta text-sm flex flex-col gap-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <BrainCircuit className="w-4 h-4 text-agro-floresta/60" />
                                                                                    {run.requested_model_name}
                                                                                </div>
                                                                                {run.actual_model_used && run.actual_model_used !== run.requested_model_name && (
                                                                                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200 self-start ml-6">
                                                                                        Fallback: Respondeu com {run.actual_model_used}
                                                                                    </span>
                                                                                )}
                                                                            </h5>
                                                                        {run.latency_ms && (
                                                                            <div className="flex flex-col gap-1 mt-1">
                                                                                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-agro-floresta/60">
                                                                                    <Clock className="w-3 h-3" /> {run.latency_ms}ms
                                                                                    <span className="mx-1">•</span>
                                                                                    Tokens: {run.tokens_used_prompt} (in) + {run.tokens_used_completion} (out)
                                                                                </div>
                                                                                {((run.tokens_cache_read && run.tokens_cache_read > 0) || (run.exact_cost_usd && run.exact_cost_usd > 0)) && (
                                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                                        {run.tokens_cache_read && run.tokens_cache_read > 0 && (
                                                                                            <span className="bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm" title="Prompt Caching: Tokens recuperados do cache">
                                                                                                Cache Hit: {run.tokens_cache_read}
                                                                                            </span>
                                                                                        )}
                                                                                        {run.exact_cost_usd && run.exact_cost_usd > 0 && (
                                                                                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shadow-sm" title="Custo exato na OpenRouter">
                                                                                                ${run.exact_cost_usd.toFixed(5)}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {run.status === 'success' ? (
                                                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                                                    ) : run.status === 'timeout' ? (
                                                                        <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
                                                                    ) : (
                                                                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                                                                    )}
                                                                </div>

                                                                <div className="flex-1 mb-4 text-sm text-agro-floresta/80 leading-relaxed font-serif max-h-[300px] overflow-y-auto pr-2 scrollbar-none">
                                                                    {run.status === 'success' ? (
                                                                        <div className="whitespace-pre-wrap">{run.response_text}</div>
                                                                    ) : (
                                                                        <div className="text-red-400 text-sm flex items-center gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                                            <span>{run.error_type || "No response generated."}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Evaluation Metrics */}
                                                                <div className="mt-auto pt-3 border-t border-agro-ouro/10 bg-agro-floresta/5 -mx-4 -mb-4 p-4 rounded-b-xl">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <span className="text-xs font-bold uppercase tracking-widest text-agro-floresta/60">
                                                                            Veredito do Juiz
                                                                        </span>
                                                                        {ev ? (
                                                                            ev.status === 'completed' || ev.status === 'success' ? (
                                                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                                    ev.verdict === 'pass' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                                    ev.verdict === 'warning' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                                                    'bg-red-100 text-red-700 border border-red-200'
                                                                                }`}>
                                                                                    {ev.verdict || 'OK'}
                                                                                </span>
                                                                            ) : ev.status === 'error' ? (
                                                                                <span className="text-red-500 text-xs font-bold uppercase">Erro</span>
                                                                            ) : (
                                                                                <span className="text-blue-600 flex items-center gap-1 text-xs uppercase font-bold">
                                                                                    <Loader2 className="w-3 h-3 animate-spin"/> Julgando
                                                                                </span>
                                                                            )
                                                                        ) : (
                                                                            <span className="text-agro-floresta/40 text-xs italic">Não avaliado</span>
                                                                        )}
                                                                    </div>

                                                                    {(ev?.status === 'completed' || ev?.status === 'success') && (
                                                                        <div className="space-y-2 text-xs">
                                                                            <div className="flex justify-between items-center text-agro-floresta/80 font-mono">
                                                                                <span>Fidelidade:</span>
                                                                                <span className="font-bold">{ev.faithfulness_score?.toFixed(1)}/10</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center text-agro-floresta/80 font-mono">
                                                                                <span>Relevância da Resposta:</span>
                                                                                <span className="font-bold">{ev.answer_relevance_score?.toFixed(1)}/10</span>
                                                                            </div>
                                                                            {ev.reasoning && (
                                                                                <div className="mt-2 pt-2 border-t border-agro-ouro/10 text-[10px] text-agro-floresta/60 italic leading-tight">
                                                                                    {ev.reasoning}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center p-6 text-agro-floresta/40 text-sm">
                                                    Nenhum modelo foi processado neste teste.
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
