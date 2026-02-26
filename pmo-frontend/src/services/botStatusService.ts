// src/services/botStatusService.ts
/**
 * Service for reading bot connection status from the Supabase bot_status table.
 * The bot Python backend writes heartbeats to this table every 60 seconds.
 */

import { supabase } from '../supabaseClient';

export type BotStatusValue = 'CONNECTED' | 'DISCONNECTED' | 'WAITING_QR' | 'UNKNOWN';

export interface BotStatus {
    session_name: string;
    status: BotStatusValue;
    last_heartbeat: string;
    phone_connected: string | null;
    details: Record<string, unknown>;
}

/**
 * Fetch the current bot status from the Supabase bot_status table.
 * Returns null if no status row exists (bot never ran).
 */
export async function fetchBotStatus(): Promise<BotStatus | null> {
    const { data, error } = await supabase
        .from('bot_status')
        .select('session_name, status, last_heartbeat, phone_connected, details')
        .eq('session_name', 'agro_vivo')
        .maybeSingle();

    if (error) {
        console.error('[botStatusService] Error fetching bot status:', error);
        return null;
    }

    return data as BotStatus | null;
}

/**
 * Determine the effective visual status considering heartbeat staleness.
 * If the last heartbeat is older than `staleThresholdMs` (default 3 min),
 * the bot is considered OFFLINE regardless of the stored status.
 */
export function getEffectiveStatus(
    botStatus: BotStatus | null,
    staleThresholdMs = 3 * 60 * 1000
): { status: BotStatusValue; isStale: boolean } {
    if (!botStatus) {
        return { status: 'UNKNOWN', isStale: true };
    }

    const lastBeat = new Date(botStatus.last_heartbeat).getTime();
    const now = Date.now();
    const isStale = now - lastBeat > staleThresholdMs;

    if (isStale) {
        return { status: 'DISCONNECTED', isStale: true };
    }

    return { status: botStatus.status, isStale: false };
}

/**
 * Format a timestamp into a human-readable relative string (PT-BR).
 */
export function formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return 'agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
}
