/**
 * Card component showing the Evolution API bot connection status.
 * Reads from the Supabase `bot_status` table (written by the Go bot heartbeat).
 */

import React, { useState, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import {
    BotStatus,
    BotStatusValue,
    fetchBotStatus,
    getEffectiveStatus,
    formatRelativeTime,
} from '../../services/botStatusService';
import { cn } from '../../utils/cn';

interface BotStatusCardProps {
    /** Initial bot status data (from parent's fetchData) */
    botStatus: BotStatus | null;
    /** Callback to update parent state after refresh */
    onStatusUpdate: (status: BotStatus | null) => void;
}

const STATUS_CONFIG: Record<BotStatusValue, {
    label: string;
    dotColor: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: React.ReactNode;
}> = {
    CONNECTED: {
        label: 'Online',
        dotColor: 'bg-emerald-500',
        bgColor: 'bg-emerald-50/50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200/50',
        icon: <Wifi size={20} />,
    },
    DISCONNECTED: {
        label: 'Offline',
        dotColor: 'bg-rose-500',
        bgColor: 'bg-rose-50/50',
        textColor: 'text-rose-700',
        borderColor: 'border-rose-200/50',
        icon: <WifiOff size={20} />,
    },
    WAITING_QR: {
        label: 'Aguardando QR',
        dotColor: 'bg-amber-500',
        bgColor: 'bg-amber-50/50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200/50',
        icon: <AlertTriangle size={20} />,
    },
    UNKNOWN: {
        label: 'Desconhecido',
        dotColor: 'bg-slate-400',
        bgColor: 'bg-slate-50/50',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200/50',
        icon: <WifiOff size={20} />,
    },
};

const BotStatusCard: React.FC<BotStatusCardProps> = ({ botStatus, onStatusUpdate }) => {
    const [refreshing, setRefreshing] = useState(false);

    const { status: effectiveStatus, isStale } = getEffectiveStatus(botStatus);
    const config = STATUS_CONFIG[effectiveStatus];

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const freshStatus = await fetchBotStatus();
            onStatusUpdate(freshStatus);
        } finally {
            setRefreshing(false);
        }
    }, [onStatusUpdate]);

    return (
        <div
            className={cn(
                'bg-white rounded-[2.5rem] p-8 border border-agro-ouro/10 shadow-sm transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 group relative overflow-hidden',
                config.borderColor
            )}
        >
            {/* Background Accent */}
            <div className={cn("absolute top-0 right-0 w-32 h-32 opacity-[0.03] transition-opacity group-hover:opacity-[0.08]", config.textColor)}>
                {React.cloneElement(config.icon as React.ReactElement<any>, { size: 128 })}
            </div>

            {/* Header Row */}
            <div className="flex items-center justify-between mb-8 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta/40 font-sans">
                    Monitoramento da Orquestração
                </span>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    aria-label="Sincronizar status do bot"
                    className="p-3 text-agro-floresta/40 hover:text-agro-floresta hover:bg-agro-floresta/5 rounded-2xl border border-agro-ouro/5 hover:border-agro-ouro/20 bg-white/50 backdrop-blur-sm shadow-sm transition-all active:scale-90 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-agro-ouro"
                >
                    {refreshing ? (
                        <Loader2 size={18} className="animate-spin text-agro-ouro" />
                    ) : (
                        <RefreshCw size={18} className="transition-transform duration-700 group-hover:rotate-180" />
                    )}
                </button>
            </div>

            {/* Status Display */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 relative z-10">
                {/* Status Pill */}
                <div
                    className={cn(
                        'inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border transition-shadow hover:shadow-md backdrop-blur-sm',
                        config.bgColor,
                        config.textColor,
                        config.borderColor
                    )}
                >
                    <div className="relative flex items-center justify-center">
                        <span
                            className={cn(
                                'w-2.5 h-2.5 rounded-full',
                                config.dotColor,
                            )}
                        />
                        {effectiveStatus === 'CONNECTED' && (
                            <span
                                className={cn(
                                    'absolute w-2.5 h-2.5 rounded-full animate-ping opacity-75',
                                    config.dotColor,
                                )}
                            />
                        )}
                    </div>
                    {config.label}
                </div>
                
                <div className="h-px w-12 bg-agro-ouro/10 hidden sm:block" />
                
                <div className={cn("flex items-center gap-3 transition-colors", config.textColor)}>
                    {React.cloneElement(config.icon as React.ReactElement<any>, { size: 24, className: "opacity-80" })}
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Protocolo</span>
                        <span className="text-xs font-black uppercase tracking-widest">Evolution v2</span>
                    </div>
                </div>
            </div>

            {/* Metadata Section */}
            <div className="space-y-4 pt-6 border-t border-agro-ouro/5 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {botStatus?.last_heartbeat && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-agro-floresta/40 font-sans">Sinal de Atividade</span>
                            <span className="text-xs font-black text-agro-floresta font-sans inline-flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-agro-ouro rounded-full animate-pulse" />
                                {formatRelativeTime(botStatus.last_heartbeat)}
                            </span>
                        </div>
                    )}
                    {botStatus?.session_name && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-agro-floresta/40 font-sans">Identificador de Sessão</span>
                            <span className="text-xs font-black text-agro-floresta opacity-80 font-mono tracking-tighter bg-agro-floresta/5 px-2 py-0.5 rounded-lg border border-agro-floresta/5 w-fit">
                                {botStatus.session_name}
                            </span>
                        </div>
                    )}
                </div>
                
                {isStale && botStatus && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-rose-50/80 rounded-2xl border border-rose-100 shadow-sm animate-pulse-slow">
                        <AlertTriangle size={16} className="text-rose-600" />
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                            Incident Alert: Latency spike detected in heartbeat signal
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BotStatusCard;
