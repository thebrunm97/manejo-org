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
    CheckCircle2,
    AlertCircle,
    Info,
    Loader2
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

    if (!log) return null;

    // Normalizing data
    const createdAtDates = log.created_at || log.criado_em;
    const dateObj = createdAtDates ? new Date(createdAtDates) : null;
    const formattedDate = dateObj
        ? dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-';

    const messageContent = log.texto_usuario || (log as any).input_message || '';
    const jsonContent = log.json_corrigido || log.json_extraido || log.meta;
    const audioUrl = log.audio_url || (log.json_extraido as any)?.audio_url || (log.meta as any)?.audio_url;

    const hasMessageContent = !!messageContent || !!audioUrl;
    const hasJsonContent = jsonContent && Object.keys(jsonContent).length > 0;

    return (
        <div className={cn(
            "fixed inset-0 z-[110] flex items-center justify-center p-4 transition-all duration-300",
            open ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Container */}
            <div className={cn(
                "relative bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform",
                open ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
            )}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Detalhes da Interação</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-medium text-slate-500 bg-white border border-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock size={12} />
                                    {formattedDate}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                        {/* 1. SEÇÃO DE USUÁRIO */}
                        <div className="col-span-12">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        {loadingProfile ? (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span className="text-sm">Carregando perfil...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <h4 className="font-bold text-slate-900">
                                                    {userProfile?.nome || 'Usuário Desconhecido'}
                                                </h4>
                                                <p className="text-xs text-slate-500">
                                                    {userProfile?.email || log.user_id}
                                                </p>
                                                {fetchError && (
                                                    <p className="text-[10px] text-red-500 mt-1">
                                                        Erro: {fetchError}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                        {userProfile?.plan_tier || 'FREE'}
                                    </span>
                                    {userProfile?.role === 'admin' && (
                                        <span className="px-2.5 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                            ADMIN
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. DADOS TÉCNICOS & JSON (Coluna Esquerda) */}
                        <div className={cn(
                            "col-span-12",
                            hasMessageContent ? "md:col-span-6" : ""
                        )}>
                            <div className="flex items-center gap-2 mb-4 text-slate-500">
                                <Database size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Metadados Técnicos</span>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {log.modelo_ia && (
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded border border-slate-200">
                                        {log.modelo_ia}
                                    </span>
                                )}
                                {log.acao && (
                                    <span className="px-2 py-1 bg-purple-50 text-purple-600 text-[11px] font-medium rounded border border-purple-100">
                                        {log.acao}
                                    </span>
                                )}
                                {log.total_tokens !== undefined && (
                                    <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[11px] font-medium rounded flex items-center gap-1 border border-slate-200">
                                        <Database size={10} />
                                        {log.total_tokens} Tokens
                                    </span>
                                )}
                                {log.custo_estimado !== undefined && (
                                    <span className="px-2 py-1 bg-red-50 text-red-600 text-[11px] font-medium rounded flex items-center gap-1 border border-red-100">
                                        <DollarSign size={10} />
                                        ${Number(log.custo_estimado).toFixed(6)}
                                    </span>
                                )}
                                {log.duracao_ms !== undefined && (
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded border border-slate-200">
                                        {log.duracao_ms}ms
                                    </span>
                                )}
                            </div>

                            {hasJsonContent && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">JSON Processado</span>
                                    </div>
                                    <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[10px] leading-relaxed overflow-hidden">
                                        <pre className="overflow-x-auto max-h-[400px] scrollbar-hide">
                                            {JSON.stringify(jsonContent || {}, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. CONTEÚDO DA MENSAGEM (Coluna Direita - Somente se houver conteúdo) */}
                        {hasMessageContent && (
                            <div className="col-span-12 md:col-span-6 space-y-6">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <MessageSquare size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Conteúdo da Mensagem</span>
                                </div>

                                {audioUrl && (
                                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2 text-green-700">
                                            <span className="text-xs font-bold uppercase tracking-wider">🎙️ Áudio Original</span>
                                        </div>
                                        <audio
                                            controls
                                            src={audioUrl}
                                            className="w-full h-10"
                                        />
                                        <p className="text-[10px] text-green-600 italic">
                                            Áudio enviado via WhatsApp e transcrito automaticamente
                                        </p>
                                    </div>
                                )}

                                {messageContent && (
                                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl min-h-[150px]">
                                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap italic">
                                            "{messageContent}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogDetailsDialog;
