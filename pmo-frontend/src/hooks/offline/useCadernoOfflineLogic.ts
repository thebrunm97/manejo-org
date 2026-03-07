/**
 * @file useCadernoOfflineLogic.ts
 * @description Hook that intercepts save operations for Caderno de Campo.
 * It tries to save to the cloud using cadernoService.
 * If efficient network fails or offline, it creates an offline record in IndexedDB via localDb.
 */

import { useCallback } from 'react';
import { cadernoService } from '../../services/cadernoService';
import { CadernoEntry } from '../../types/CadernoTypes';

export interface SaveResult {
    success: boolean;
    error?: string;
    isOffline?: boolean;
}

export function useCadernoOfflineLogic() {
    /**
     * Tenta salvar o registro online.
     * Se falhar por erro de rede ou se estiver offline, salva localmente.
     */
    const saveRecord = useCallback(async (payload: Omit<CadernoEntry, 'id' | 'created_at'> & { id?: string }): Promise<SaveResult> => {
        // 1. Check Offline Status First
        if (!navigator.onLine) {
            console.log('[CadernoOffline] Detectado Offline. Salvando localmente...');
            return await _saveLocal(payload);
        }

        try {
            // 2. Try Online Save
            // If it's an edit (has ID), use update. If new, use add.
            if (payload.id && !payload.id.startsWith('offline_')) {
                await cadernoService.updateRegistro(payload.id, payload);
            } else {
                // Remove ID se for temp/undefined para o Supabase gerar
                const { id, ...newPayload } = payload;
                await cadernoService.addRegistro(newPayload as any);
            }

            return { success: true, isOffline: false };

        } catch (error: any) {
            console.error('[CadernoOffline] Falha ao salvar online:', error);

            // Check if it's a network error (Supabase throws specific errors usually, but "Failed to fetch" is common)
            const isNetworkError =
                error.message?.includes('Failed to fetch') ||
                error.message?.includes('NetworkError') ||
                error.message?.includes('connection') ||
                !navigator.onLine; // Re-check user status

            if (isNetworkError) {
                console.log('[CadernoOffline] Erro de rede confirmado. Fallback para local.');
                return await _saveLocal(payload);
            }

            // If it's a validation error or server error (500), propagate failure
            return { success: false, error: error.message || 'Erro ao salvar registro.' };
        }
    }, []);

    /**
     * Helper Interno para salvar na Fila de Sincronização (IndexedDB)
     */
    const _saveLocal = async (payload: any): Promise<SaveResult> => {
        try {
            const offlineId = payload.id || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const syncItem = {
                id: offlineId,
                type: 'CADERNO_SAVE' as const,
                payload: {
                    ...payload,
                    id: offlineId,
                    updated_at: new Date().toISOString()
                },
                timestamp: new Date().toISOString(),
                retries: 0,
                status: 'pending' as const
            };

            // Salva na fila unificada
            const { localDb, SYNC_QUEUE_STORE } = await import('../../utils/db');
            await localDb.set(syncItem, SYNC_QUEUE_STORE);

            // Mantém compatibilidade momentânea com a store legada se necessário, 
            // mas o Sync deve priorizar a Queue agora.
            return { success: true, isOffline: true };
        } catch (err: any) {
            console.error('[CadernoOffline] Erro FATAL ao salvar local:', err);
            return { success: false, error: 'Não foi possível salvar nem online nem offline.' };
        }
    };

    return {
        saveRecord
    };
}
