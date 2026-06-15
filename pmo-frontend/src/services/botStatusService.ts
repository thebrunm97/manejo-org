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
        .eq('session_name', import.meta.env.VITE_BOT_SESSION_NAME || 'manejo-org')
        .maybeSingle();


    if (error) {
        console.error('[botStatusService] Error fetching bot status:', error);
        return null;
    }

    return data as BotStatus | null;
}

/**
 * Determine the effective visual status considering heartbeat staleness.
 * If the last heartbeat is older than `staleThresholdMs` (default 5 min),
 * the bot is considered OFFLINE regardless of the stored status.
 */
export function getEffectiveStatus(
    botStatus: BotStatus | null,
    staleThresholdMs = 5 * 60 * 1000
): { status: BotStatusValue; isStale: boolean } {
    if (!botStatus || !botStatus.last_heartbeat) {
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
 * Activity recorded by the bot in messages table representing recent conversation.
 */
export interface BotActivity {
    id: string;
    created_at: string;
    tipo: string;
    descricao: string;
}

/**
 * Fetch the 3 most recent messages/activities from the messages table for this phone.
 */
export async function fetchRecentBotActivities(telefone?: string): Promise<BotActivity[]> {
    if (!telefone) return [];

    // Extract raw number before '@' and remove non-digits
    let cleanPhone = telefone.split('@')[0].replace(/\D/g, '');
    if (!cleanPhone) return [];

    // Brazilian 9th digit normalization rule (converts 12-digit numbers starting with 55 to 13-digit ones)
    if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
        const ddd = cleanPhone.substring(2, 4);
        const number = cleanPhone.substring(4);
        cleanPhone = `55${ddd}9${number}`;
    }

    const { data, error } = await supabase
        .from('messages')
        .select('id, timestamp, role, content, source')
        .eq('phone', cleanPhone)
        .order('timestamp', { ascending: false })
        .limit(3);

    if (error) {
        console.error('[botStatusService] Error fetching recent activities:', error);
        return [];
    }

    return (data || []).map((msg: any) => {
        const desc = msg.content || msg.source || 'Áudio ou mídia recebida';
        return {
            id: msg.id,
            created_at: msg.timestamp || new Date().toISOString(),
            tipo: msg.role === 'assistant' ? 'assistant' : 'user',
            descricao: desc,
        };
    });
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
