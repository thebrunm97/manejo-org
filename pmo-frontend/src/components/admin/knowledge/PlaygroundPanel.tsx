import React, { useState, useEffect } from 'react';
import { Search, BrainCircuit, FileText, ChevronRight, AlertCircle, Loader2, CheckCircle2, XCircle, Clock, Library, Wrench, Braces } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '../../../supabaseClient';
import { goApiFetch } from '../../../services/goApiClient';

// Types corresponding to the Go Backend response
interface RagExperimentEvaluation {
    id: string;
    run_id: string;
    status: string;
    faithfulness_score?: number;
    answer_relevance_score?: number;
    context_relevance_score?: number;
    verdict?: string;
    reasoning?: string;
    error_message?: string;
}

interface Chunk {
    id: number;
    pmo_id: number;
    document_name: string;
    content: string;
    similarity: number;
    is_global: boolean;
    metadata: any;
    chunk_index: number;
    source_document_id: string;
}

interface RagExperimentRun {
    id: string;
    experiment_id: string;
    requested_model_name: string;
    provider_name?: string;
    tokens_used_prompt: number;
    tokens_used_completion: number;
    total_tokens: number;
    tokens_cache_read?: number;
    tokens_cache_write?: number;
    exact_cost_usd?: number;
    latency_ms: number;
    status: string;
    error_type?: string;
    response_text?: string;
    created_at: string;
}

interface PlaygroundResponse {
    experiment_id: string;
    query: string;
    chunks: Chunk[];
    runs: RagExperimentRun[];
}

export interface ArenaModel {
    id: string;
    model_id: string;
    provider_name: string;
    label: string;
    temperature: number;
    fallback_models?: string[];
    is_active: boolean;
    is_default: boolean;
    sort_order: number;
    supports_tools: boolean;
    supports_structured_outputs?: boolean;
    notes?: string;
}

export const PlaygroundPanel: React.FC = () => {
    const [query, setQuery] = useState('');
    const [arenaModels, setArenaModels] = useState<ArenaModel[]>([]);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<PlaygroundResponse | null>(null);
    const [evaluations, setEvaluations] = useState<Record<string, RagExperimentEvaluation>>({});

    // Accordion state for chunks
    const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});

    const toggleChunk = (idx: number) => {
        setExpandedChunks(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const response = await goApiFetch('/api/v1/admin/knowledge/playground/models');
                if (response.ok) {
                    const data: ArenaModel[] = await response.json();
                    setArenaModels(data);
                    setSelectedModels(data.filter(m => m.is_default).map(m => m.id));
                }
            } catch (err) {
                console.error('Failed to load arena models', err);
            }
        };
        fetchModels();
    }, []);

    // Poll for evaluations when we have a result
    useEffect(() => {
        if (!result || !result.runs || result.runs.length === 0) return;

        const runIds = result.runs.map(r => r.id);
        let timeoutId: NodeJS.Timeout;

        const fetchUpdates = async () => {
            // Poll evaluations
            const { data: evalData, error: evalError } = await supabase
                .from('rag_experiment_evaluations')
                .select('*')
                .in('run_id', runIds)
                .order('created_at', { ascending: false });

            // Poll runs for telemetry updates (cost, cache hits)
            const { data: runsData, error: runsError } = await supabase
                .from('rag_experiment_runs')
                .select('*')
                .in('id', runIds);

            let allEvalsFinished = true;
            let allTelemetryFinished = true;

            if (!evalError && evalData) {
                const evalMap: Record<string, RagExperimentEvaluation> = {};
                evalData.forEach(item => {
                    if (!evalMap[item.run_id]) {
                        evalMap[item.run_id] = item as RagExperimentEvaluation;
                        if (item.status === 'pending') {
                            allEvalsFinished = false;
                        }
                    }
                });
                setEvaluations(prev => ({ ...prev, ...evalMap }));
            } else {
                allEvalsFinished = false;
            }

            if (!runsError && runsData) {
                setResult(prev => {
                    if (!prev) return prev;
                    let changed = false;
                    const newRuns = prev.runs.map(r => {
                        const updatedRun = runsData.find((u: any) => u.id === r.id);
                        if (updatedRun) {
                            if (updatedRun.provider_name === 'openrouter' && (updatedRun.exact_cost_usd === null || updatedRun.exact_cost_usd === 0) && (updatedRun.tokens_cache_read === null || updatedRun.tokens_cache_read === 0)) {
                                allTelemetryFinished = false;
                            }
                            if (
                                updatedRun.exact_cost_usd !== r.exact_cost_usd ||
                                updatedRun.tokens_cache_read !== r.tokens_cache_read
                            ) {
                                changed = true;
                                return { ...r, ...updatedRun };
                            }
                        }
                        return r;
                    });
                    return changed ? { ...prev, runs: newRuns } : prev;
                });
            } else {
                allTelemetryFinished = false;
            }

            // Keep polling if evaluations or telemetry are not finished
            if (!allEvalsFinished || !allTelemetryFinished) {
                timeoutId = setTimeout(fetchUpdates, 3000);
            }
        };

        // Initial fetch
        timeoutId = setTimeout(fetchUpdates, 2000);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [result]);

    const toggleModel = (id: string) => {
        setSelectedModels(prev => 
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setResult(null);
        setEvaluations({});

        const configs = selectedModels.map(id => {
            const m = arenaModels.find(x => x.id === id)!;
            return {
                provider_name: m.provider_name,
                model_name: m.model_id,
                fallback_models: m.fallback_models,
                temperature: m.temperature,
            };
        });

        try {
            const response = await goApiFetch('/api/v1/admin/knowledge/playground/rag', {
                method: 'POST',
                body: JSON.stringify({
                    query: query.trim(),
                    configs: configs
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erro HTTP ${response.status}`);
            }

            const data: PlaygroundResponse = await response.json();
            setResult(data);
        } catch (error: any) {
            toast.error(error.message || 'Falha ao conectar com o motor de RAG.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header and Controls */}
            <div className="bg-white/5 backdrop-blur-xl border border-agro-ouro/20 rounded-2xl p-6 shadow-xl space-y-6">
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-agro-floresta/50" />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Faça uma pergunta para a base de conhecimento global..."
                            className="w-full bg-white/10 border border-agro-ouro/30 text-agro-floresta placeholder:text-agro-floresta/40 text-lg rounded-xl pl-12 pr-32 py-4 focus:outline-none focus:ring-2 focus:ring-agro-ouro transition-all shadow-inner"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !query.trim()}
                            className="absolute inset-y-2 right-2 bg-gradient-to-r from-agro-floresta to-green-800 text-agro-ouro px-6 py-2 rounded-lg font-bold uppercase tracking-wider text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                            Testar RAG
                        </button>
                    </div>

                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-agro-floresta/60">Selecione os Modelos (Arena)</h3>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        toast.info("Sincronizando modelos da OpenRouter...");
                                        const response = await goApiFetch('/api/v1/admin/knowledge/playground/models/sync', {
                                            method: 'POST',
                                        });
                                        if (response.ok) {
                                            toast.success("Modelos sincronizados com sucesso!");
                                            // reload page to fetch models again
                                            window.location.reload();
                                        } else {
                                            const errData = await response.json().catch(() => ({}));
                                            throw new Error(errData.error || `Erro HTTP ${response.status}`);
                                        }
                                    } catch (error: any) {
                                        toast.error(error.message || 'Falha ao sincronizar modelos.');
                                    }
                                }}
                                className="text-xs text-agro-floresta/60 hover:text-agro-ouro border border-agro-floresta/20 hover:border-agro-ouro px-2 py-1 rounded transition-colors"
                            >
                                Sincronizar Modelos
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {arenaModels.map(model => (
                                <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => toggleModel(model.id)}
                                    title={model.notes || ''}
                                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex flex-col items-start gap-1 ${
                                        selectedModels.includes(model.id)
                                            ? 'bg-agro-floresta text-agro-ouro border-agro-floresta shadow-md'
                                            : 'bg-white/50 text-agro-floresta/70 border-agro-ouro/20 hover:border-agro-ouro/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{model.label}</span>
                                        <div className="flex gap-1">
                                            {model.supports_tools && (
                                                <span title="Suporta Tool Calling">
                                                    <Wrench className="w-3 h-3 text-agro-floresta/60" />
                                                </span>
                                            )}
                                            {model.supports_structured_outputs && (
                                                <span title="Suporta Structured Outputs">
                                                    <Braces className="w-3 h-3 text-agro-floresta/60" />
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {model.is_default && (
                                        <span className={`text-[10px] uppercase tracking-wider ${selectedModels.includes(model.id) ? 'text-agro-ouro/70' : 'text-agro-floresta/50'}`}>
                                            Default
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-agro-floresta/50">
                            {selectedModels.length} modelos selecionados para execução concorrente.
                        </p>
                    </div>
                </form>
            </div>

            {/* Results Area */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                        {/* Right Column: Retrieved Chunks (Now on the left or top in mobile) */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-agro-floresta/60 flex items-center gap-2">
                                    <Library className="h-4 w-4" />
                                    Contexto Recuperado
                                </h3>
                                <div className="bg-agro-floresta/10 text-agro-floresta px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                    {result.chunks?.length || 0} fragmentos
                                </div>
                            </div>

                            <div className="space-y-4 pr-2">
                                {result.chunks && result.chunks.length > 0 ? (
                                    result.chunks.map((chunk, idx) => {
                                        const score = chunk.similarity * 100;
                                        let scoreColor = "text-red-500 bg-red-50 border-red-200";
                                        if (score > 75) scoreColor = "text-green-600 bg-green-50 border-green-200";
                                        else if (score > 60) scoreColor = "text-yellow-600 bg-yellow-50 border-yellow-200";

                                        return (
                                            <div
                                                key={`chunk-${idx}`}
                                                className="bg-white border border-agro-ouro/20 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
                                            >
                                                <div 
                                                    className="flex flex-col gap-2 px-4 py-3 bg-agro-floresta/5 border-b border-agro-ouro/10 cursor-pointer hover:bg-agro-floresta/10 transition-colors"
                                                    onClick={() => toggleChunk(idx)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <FileText className="h-4 w-4 text-agro-floresta/50 shrink-0" />
                                                            <span className="font-semibold text-agro-floresta text-sm truncate" title={chunk.document_name}>
                                                                {chunk.document_name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${scoreColor} shadow-sm`}>
                                                                {score.toFixed(1)}%
                                                            </div>
                                                            <ChevronRight className={`h-4 w-4 text-agro-floresta/50 transition-transform ${expandedChunks[idx] ? 'rotate-90' : ''}`} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <AnimatePresence>
                                                    {expandedChunks[idx] && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <div className="p-4 bg-white relative max-h-[250px] overflow-y-auto scrollbar-none border-t border-agro-ouro/10">
                                                                <div className="text-xs text-agro-floresta/70 leading-relaxed font-mono whitespace-pre-wrap break-words">
                                                                    {chunk.content}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="bg-white/40 border border-dashed border-agro-ouro/50 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3">
                                        <Search className="h-8 w-8 text-agro-floresta/30" />
                                        <p className="text-agro-floresta/60 font-medium text-sm">Nenhum chunk recuperado.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Left Column: LLM Answers (Arena) */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-agro-floresta/60 flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4" />
                                Respostas da Arena
                            </h3>
                            
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {result.runs && result.runs.length > 0 ? (
                                    result.runs.map((run, idx) => {
                                        const ev = evaluations[run.id];
                                        return (
                                        <div key={run.id || idx} className="bg-white/60 backdrop-blur-md border border-agro-ouro/20 rounded-2xl p-5 shadow-sm flex flex-col">
                                            <div className="flex items-start justify-between mb-4 pb-3 border-b border-agro-ouro/10">
                                                <div>
                                                    <h4 className="font-bold text-agro-floresta">{run.requested_model_name}</h4>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[10px] uppercase tracking-wider text-agro-floresta/60 font-mono">
                                                            {run.provider_name}
                                                        </span>
                                                        {run.latency_ms && (
                                                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-agro-floresta/60">
                                                                <Clock className="w-3 h-3" /> {run.latency_ms}ms
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {run.status === 'success' ? (
                                                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                                                ) : run.status === 'timeout' ? (
                                                    <Clock className="w-6 h-6 text-yellow-500 shrink-0" />
                                                ) : (
                                                    <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                                                )}
                                            </div>

                                            <div className="flex-1 overflow-y-auto min-h-[150px] max-h-[300px] text-sm text-agro-floresta/80 leading-relaxed scrollbar-none">
                                                {run.status === 'success' ? (
                                                    <div className="whitespace-pre-wrap">{run.response_text}</div>
                                                ) : (
                                                    <div className="text-red-400 text-sm flex items-center gap-2 mt-4 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                        <span>{run.error_type || "No response generated."}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer metrics */}
                                            {run.status === 'success' && (
                                                <div className="mt-4 pt-3 border-t border-agro-ouro/10">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="flex flex-col gap-1 text-agro-floresta/40 text-[10px]">
                                                            <span className="text-agro-floresta/60">Tokens: {run.tokens_used_prompt} (in) + {run.tokens_used_completion} (out)</span>
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
                                                        <div className="flex items-center gap-2 text-agro-floresta/60 text-[10px] font-bold uppercase">
                                                            {ev ? (
                                                                ev.status === 'completed' ? (
                                                                    <span className={ev.verdict === 'pass' ? 'text-green-600' : ev.verdict === 'warning' ? 'text-yellow-600' : 'text-red-600'}>
                                                                        Juiz: {ev.verdict}
                                                                    </span>
                                                                ) : ev.status === 'error' ? (
                                                                    <span className="text-red-500">Erro no Juiz</span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1 animate-pulse text-blue-600"><Loader2 className="w-3 h-3 animate-spin"/> Julgando...</span>
                                                                )
                                                            ) : (
                                                                <span className="flex items-center gap-1 animate-pulse"><Loader2 className="w-3 h-3 animate-spin"/> Aguardando Juiz</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {ev && ev.status === 'completed' && (
                                                        <div className="bg-agro-floresta/5 p-3 rounded-lg border border-agro-ouro/20 space-y-2">
                                                            <div className="flex justify-between text-xs text-agro-floresta/80 font-mono">
                                                                <span>Fidelidade (Groundedness):</span>
                                                                <span className="font-bold">{ev.faithfulness_score?.toFixed(1)}/10</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs text-agro-floresta/80 font-mono">
                                                                <span>Relevância da Resposta:</span>
                                                                <span className="font-bold">{ev.answer_relevance_score?.toFixed(1)}/10</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs text-agro-floresta/80 font-mono">
                                                                <span>Confiança do Contexto:</span>
                                                                <span className="font-bold">{ev.context_relevance_score?.toFixed(1)}/10</span>
                                                            </div>
                                                            {ev.reasoning && (
                                                                <div className="text-[10px] text-agro-floresta/60 italic leading-tight pt-2 border-t border-agro-ouro/10">
                                                                    {ev.reasoning}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )})
                                ) : (
                                    <div className="col-span-full h-[200px] flex flex-col items-center justify-center text-center space-y-3 opacity-50 p-4 border border-dashed border-agro-ouro/50 rounded-2xl">
                                        <AlertCircle className="h-8 w-8 text-agro-floresta" />
                                        <p className="text-xs font-medium uppercase tracking-wider text-agro-floresta">Sem Respostas</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
