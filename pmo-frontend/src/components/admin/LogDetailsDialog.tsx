// src/components/admin/LogDetailsDialog.tsx

import React, { useEffect, useState } from 'react';
import {
    X,
    User,
    MessageSquare,
    Database,
    DollarSign,
    Activity,
    Clock,
    Loader2,
    Copy,
    Check,
    Smartphone
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { cn } from '../../utils/cn';

export interface LogData {
    id: string;
    user_id?: string;
    created_at?: string;
    criado_em?: string;
    // Consumption fields
    acao?: string;
    modelo_ia?: string;
    total_tokens?: number;
    custo_estimado?: number;
    duracao_ms?: number;
    status?: string;
    meta?: any;
    // Training/Content fields
    texto_usuario?: string;
    json_extraido?: any;
    json_corrigido?: any;
    tipo_atividade?: string;
    audio_url?: string;
}

interface LogDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    log: LogData | null;
}

interface UserProfile {
    nome?: string;
    email?: string;
    plan_tier?: string;
    role?: string;
}

const LogDetailsDialog: React.FC<LogDetailsDialogProps> = ({ open, onClose, log }) => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open && log?.user_id) {
            fetchUserProfile(log.user_id);
        } else {
            setUserProfile(null);
            setFetchError(null);
        }
    }, [open, log]);

    const fetchUserProfile = async (userId: string) => {
        setLoadingProfile(true);
        setFetchError(null);
        try {
            const { data, error } = await supabase
                .rpc('get_admin_user_details', { target_user_id: userId });

            if (error) throw error;

            if (data && data.length > 0) {
                setUserProfile(data[0]);
            } else {
                setUserProfile({ nome: 'Usuário não encontrado', email: '-', plan_tier: '-', role: '-' });
            }
        } catch (err: any) {
            console.error('Error fetching user profile:', err);
            setFetchError(err.message || 'Erro desconhecido');
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!log) return null;

    // Normalizing data
    const createdAtDates = log.created_at || log.criado_em;
    const dateObj = createdAtDates ? new Date(createdAtDates) : null;
    const formattedDate = dateObj
        ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(dateObj)
        : '-';

    const messageContent = log.texto_usuario || (log as any).input_message || '';
    const jsonContent = log.json_corrigido || log.json_extraido || log.meta;
    const audioUrl = log.audio_url || (log.json_extraido as any)?.audio_url || (log.meta as any)?.audio_url;

    const hasMessageContent = !!messageContent || !!audioUrl;
    const hasJsonContent = jsonContent && Object.keys(jsonContent).length > 0;

    return (
        <div className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300",
            open ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-agro-floresta/40 backdrop-blur-md" onClick={onClose} />

            {/* Modal Container */}
            <div className={cn(
                "relative bg-agro-creme w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col transition-all duration-500 transform border border-white/20",
                open ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
            )}>

                {/* Header */}
                <div className="flex items-center justify-between p-8 border-b border-agro-ouro/10 bg-white/40 sticky top-0 z-10 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-agro-floresta text-agro-ouro rounded-2xl shadow-inner">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif font-bold text-agro-floresta uppercase tracking-tight">Análise de Interação</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black first-letter:uppercase text-agro-floresta/60 bg-white/60 border border-agro-ouro/10 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                    <Clock size={12} className="text-agro-ouro" />
                                    {formattedDate}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fechar diálogo"
                        className="p-3 text-agro-floresta/40 hover:text-agro-floresta hover:bg-white/80 rounded-2xl transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none border border-transparent hover:border-agro-ouro/10"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 scrollbar-premium">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                        {/* 1. SEÇÃO DE USUÁRIO */}
                        <div className="col-span-12 animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="bg-white/60 border border-agro-ouro/10 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-agro-floresta/5 rounded-full border-2 border-white flex items-center justify-center text-agro-floresta shadow-md">
                                        <User size={32} />
                                    </div>
                                    <div>
                                        {loadingProfile ? (
                                            <div className="flex items-center gap-3 text-agro-floresta/40">
                                                <Loader2 size={18} className="animate-spin" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Sincronizando perfil…</span>
                                            </div>
                                        ) : (
                                            <>
                                                <h4 className="font-serif text-xl font-bold text-agro-floresta">
                                                    {userProfile?.nome || 'Proprietário Desconhecido'}
                                                </h4>
                                                <p className="text-xs font-bold text-agro-floresta/40 mt-0.5 font-sans">
                                                    {userProfile?.email || log.user_id}
                                                </p>
                                                {fetchError && (
                                                    <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase flex items-center gap-1">
                                                        <Activity size={10} />
                                                        Incident Log: {fetchError}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="px-4 py-1.5 bg-agro-floresta text-agro-ouro text-[10px] font-black rounded-xl uppercase tracking-[0.2em] shadow-lg shadow-agro-floresta/20">
                                        {userProfile?.plan_tier || 'PRODUTOR'}
                                    </span>
                                    {userProfile?.role === 'admin' && (
                                        <span className="px-4 py-1.5 bg-agro-ouro text-white text-[10px] font-black rounded-xl uppercase tracking-[0.2em] shadow-lg shadow-agro-ouro/20">
                                            ORQUESTRADOR
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. DADOS TÉCNICOS & JSON (Coluna Esquerda) */}
                        <div className={cn(
                            "col-span-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700",
                            hasMessageContent ? "md:col-span-6" : ""
                        )}>
                            <div className="flex items-center gap-3 text-agro-floresta mb-2">
                                <div className="p-1.5 bg-agro-floresta/5 rounded-lg">
                                    <Database size={16} className="text-agro-ouro" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Metadados da Inteligência</span>
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                                {log.modelo_ia && (
                                    <span className="px-3 py-1.5 bg-white text-agro-floresta text-[11px] font-bold rounded-xl border border-agro-ouro/10 shadow-sm first-letter:uppercase">
                                        {log.modelo_ia}
                                    </span>
                                )}
                                {log.acao && (
                                    <span className="px-3 py-1.5 bg-agro-ouro/10 text-agro-ouro text-[11px] font-bold rounded-xl border border-agro-ouro/20 shadow-sm first-letter:uppercase">
                                        {log.acao}
                                    </span>
                                )}
                                {log.total_tokens !== undefined && (
                                    <span className="px-3 py-1.5 bg-white text-agro-floresta/60 text-[11px] font-bold rounded-xl flex items-center gap-2 border border-agro-ouro/10 shadow-sm tabular-nums">
                                        <Activity size={12} className="text-agro-ouro" />
                                        {log.total_tokens?.toLocaleString()} Tokens
                                    </span>
                                )}
                                {log.custo_estimado !== undefined && (
                                    <span className="px-3 py-1.5 bg-agro-floresta text-agro-ouro text-[11px] font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-agro-floresta/10 tabular-nums">
                                        <DollarSign size={12} />
                                        ${Number(log.custo_estimado).toFixed(6)}
                                    </span>
                                )}
                            </div>

                            {hasJsonContent && (
                                    <div className="relative group/json mt-6 rounded-[2rem] overflow-hidden border border-agro-floresta shadow-2xl">
                                        <div className="bg-[#0A100F] text-emerald-100/80 p-6 font-mono text-[11px] leading-relaxed">
                                            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-agro-ouro/50">Raw Dataset Output</span>
                                                <button
                                                    onClick={() => handleCopy(JSON.stringify(jsonContent, null, 2))}
                                                    aria-label="Copiar JSON para área de transferência"
                                                    className="p-2.5 bg-white/5 hover:bg-white/10 text-agro-ouro rounded-xl transition-all flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-agro-ouro outline-none group"
                                                >
                                                    {copied ? <Check size={14} className="text-emerald-400 animate-in zoom-in" /> : <Copy size={14} className="group-hover:scale-110 transition-transform" />}
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{copied ? 'Copiado!' : 'Copiar Payload'}</span>
                                                </button>
                                            </div>
                                            <pre className="whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto scrollbar-premium pr-4 custom-json-scrollbar">
                                                {JSON.stringify(jsonContent || {}, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                            )}
                        </div>

                        {/* 3. CONTEÚDO DA MENSAGEM (Coluna Direita - Somente se houver conteúdo) */}
                        {hasMessageContent && (
                            <div className="col-span-12 md:col-span-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
                                <div className="flex items-center gap-3 text-agro-floresta mb-2">
                                    <div className="p-1.5 bg-agro-floresta/5 rounded-lg">
                                        <MessageSquare size={16} className="text-agro-ouro" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sinal de Comunicação</span>
                                </div>

                                {audioUrl && (
                                    <div className="bg-white/80 backdrop-blur-sm border border-agro-ouro/20 p-6 rounded-[2rem] space-y-4 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 text-agro-floresta">
                                                <div className="w-10 h-10 bg-agro-ouro/10 rounded-full flex items-center justify-center animate-pulse">
                                                    <Smartphone size={20} className="text-agro-ouro" />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest">Áudio Transcrito</span>
                                            </div>
                                            <span className="text-[9px] font-black text-agro-ouro/50 uppercase tracking-widest">WhatsApp Message</span>
                                        </div>
                                        <audio
                                            controls
                                            src={audioUrl}
                                            className="w-full h-12 rounded-xl"
                                        />
                                        <p className="text-[10px] text-agro-floresta/40 italic font-medium leading-relaxed">
                                            O sinal de voz foi processado pelo agente de transcrição com sucesso via Evolution API.
                                        </p>
                                    </div>
                                )}

                                {messageContent && (
                                    <div className="bg-white border-l-4 border-agro-ouro p-8 rounded-3xl min-h-[150px] shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                            <MessageSquare size={120} />
                                        </div>
                                        <p className="text-agro-floresta text-base leading-relaxed font-serif italic relative z-10">
                                            “{messageContent}”
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-agro-ouro/10 bg-white/40 flex justify-end transition-all">
                    <button
                        onClick={onClose}
                        className="group relative px-10 py-4 bg-agro-floresta text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-agro-ouro opacity-0 group-hover:opacity-10 transition-opacity" />
                        <span className="relative">Encerrar Visão</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogDetailsDialog;
