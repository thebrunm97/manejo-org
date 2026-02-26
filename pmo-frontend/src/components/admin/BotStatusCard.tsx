// src/components/admin/BotStatusCard.tsx
/**
 * Card component showing the WppConnect bot connection status.
 * Reads from the Supabase `bot_status` table (written by the Python bot heartbeat).
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
        dotColor: 'bg-emerald-400',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        icon: <Wifi size={20} />,
    },
    DISCONNECTED: {
        label: 'Offline',
        dotColor: 'bg-rose-400',
        bgColor: 'bg-rose-50',
        textColor: 'text-rose-700',
        borderColor: 'border-rose-200',
        icon: <WifiOff size={20} />,
    },
    WAITING_QR: {
        label: 'Aguardando QR',
        dotColor: 'bg-amber-400',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        icon: <AlertTriangle size={20} />,
    },
    UNKNOWN: {
        label: 'Desconhecido',
        dotColor: 'bg-slate-300',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-500',
        borderColor: 'border-slate-200',
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
                'bg-white rounded-3xl p-6 border shadow-sm transition-all',
                config.borderColor,
                'shadow-slate-200/50'
            )}
        >
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Status do Bot
                </span>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    title="Verificar agora"
                >
                    {refreshing ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <RefreshCw size={16} />
                    )}
                </button>
            </div>

            {/* Status Display */}
            <div className="flex items-center gap-3 mb-3">
                {/* Animated dot */}
                <div className="relative flex items-center justify-center">
                    <span
                        className={cn(
                            'w-3 h-3 rounded-full',
                            config.dotColor,
                        )}
                    />
                    {effectiveStatus === 'CONNECTED' && (
                        <span
                            className={cn(
                                'absolute w-3 h-3 rounded-full animate-ping opacity-75',
                                config.dotColor,
                            )}
                        />
                    )}
                </div>

                {/* Status Pill */}
                <div
                    className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold',
                        config.bgColor,
                        config.textColor,
                    )}
                >
                    {config.icon}
                    {config.label}
                </div>
            </div>

            {/* Metadata */}
            <div className="space-y-1">
                {botStatus?.last_heartbeat && (
                    <p className="text-[11px] font-medium text-slate-400">
                        Último heartbeat:{' '}
                        <span className="text-slate-500 font-bold">
                            {formatRelativeTime(botStatus.last_heartbeat)}
                        </span>
                    </p>
                )}
                {isStale && botStatus && (
                    <p className="text-[11px] font-bold text-amber-500">
                        ⚠ Heartbeat antigo — o bot pode estar parado.
                    </p>
                )}
                {botStatus?.session_name && (
                    <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">
                        Sessão: {botStatus.session_name}
                    </p>
                )}
            </div>
        </div>
    );
};

export default BotStatusCard;
