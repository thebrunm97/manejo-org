/**
 * @file useSyncEngine.ts
 * @description Global hook to process the offline sync queue with protection against data loss.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { localDb, CADERNO_STORE, SYNC_QUEUE_STORE } from '../../utils/db';
import { cadernoService } from '../../services/cadernoService';
import { createPmo, updatePmo } from '../../services/pmoService';
import { toast } from 'react-toastify';

export function useSyncEngine() {
    const isSyncingRef = useRef(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

    /**
     * Sincroniza itens pendentes na fila unificada
     */
    const syncPendingRecords = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        try {
            const pendingItems = await localDb.getAll(SYNC_QUEUE_STORE);

            if (!pendingItems || pendingItems.length === 0) {
                // Migração de dados legados do Caderno
                const legacyItems = await localDb.getAll(CADERNO_STORE);
                if (!legacyItems || legacyItems.length === 0) {
                    setSyncStatus('idle');
                    return;
                }

                console.log(`[SyncEngine] Migrando ${legacyItems.length} itens do armazenamento legado...`);
                for (const item of legacyItems) {
                    await localDb.set({
                        id: item.id,
                        type: 'CADERNO_SAVE',
                        payload: item,
                        timestamp: new Date().toISOString(),
                        lastAttempt: 0,
                        retries: 0,
                        status: 'pending',
                        syncing: false
                    }, SYNC_QUEUE_STORE);
                    await localDb.delete(item.id, CADERNO_STORE);
                }
                return;
            }

            isSyncingRef.current = true;
            setSyncStatus('syncing');
            console.log(`[SyncEngine] Processando ${pendingItems.length} itens na fila...`);

            const toastId = toast.info('Sincronizando dados com a nuvem...', { autoClose: false });

            let successCount = 0;
            let failCount = 0;

            for (const item of pendingItems) {
                // Lógica de Backoff Exponencial
                if (item.retries > 0 && item.lastAttempt) {
                    const delay = Math.pow(2, item.retries) * 1000;
                    const elapsed = Date.now() - new Date(item.lastAttempt).getTime();
                    if (elapsed < delay) {
                        console.log(`[SyncEngine] Item ${item.id} em backoff (${Math.round((delay - elapsed) / 1000)}s restando)`);
                        continue;
                    }
                }

                // Padrão "Claim-then-Delete": Marcar como em sincronização localmente antes de disparar API
                try {
                    await localDb.set({ ...item, syncing: true, lastAttempt: new Date().toISOString() }, SYNC_QUEUE_STORE);

                    if (item.type === 'CADERNO_SAVE') {
                        const record = item.payload;
                        const isNew = String(record.id).startsWith('offline_');

                        if (isNew) {
                            const { id, synced, updated_at, ...payload } = record;
                            await cadernoService.addRegistro(payload);
                        } else {
                            const { synced, updated_at, ...payload } = record;
                            await cadernoService.updateRegistro(record.id, payload);
                        }
                    } else if (item.type === 'PMODATA_SAVE') {
                        const record = item.payload;
                        const isNew = String(record.id).startsWith('offline_');

                        if (isNew) {
                            const { id, ...payload } = record;
                            const result = await createPmo(payload);
                            if (!result.success) throw new Error(result.error);
                        } else {
                            const { id, ...payload } = record;
                            const result = await updatePmo(id, payload);
                            if (!result.success) throw new Error(result.error);
                        }
                    }

                    // Remove da fila em caso de sucesso
                    await localDb.delete(item.id, SYNC_QUEUE_STORE);
                    successCount++;
                } catch (err) {
                    console.error(`[SyncEngine] Falha no item ${item.id}:`, err);
                    failCount++;
                    
                    // Incrementa retries e desbloqueia o item para próxima tentativa
                    await localDb.set({ 
                        ...item, 
                        syncing: false, 
                        retries: (item.retries || 0) + 1,
                        lastAttempt: new Date().toISOString()
                    }, SYNC_QUEUE_STORE);
                }
            }

            toast.dismiss(toastId);

            if (successCount > 0) {
                toast.success(`${successCount} registros sincronizados!`);
            }
            if (failCount > 0) {
                toast.warn(`${failCount} falhas na sincronização. Tentaremos novamente.`);
                setSyncStatus('error');
            } else {
                setSyncStatus('idle');
            }

        } catch (err) {
            console.error('[SyncEngine] Erro crítico no loop de sync:', err);
            setSyncStatus('error');
        } finally {
            isSyncingRef.current = false;
        }
    }, []);

    // Guardião de Saída: Impede fecho da aba durante sincronização ativa
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSyncingRef.current) {
                e.preventDefault();
                e.returnValue = ''; // Ativa o modal de confirmação do browser
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Executa ao montar e quando voltar a ficar online
    useEffect(() => {
        syncPendingRecords();

        const handleOnline = () => {
            console.log('[SyncEngine] Conexão restaurada. Iniciando sincronização...');
            syncPendingRecords();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [syncPendingRecords]);

    return { 
        isSyncing: syncStatus === 'syncing', 
        syncStatus, 
        syncPendingRecords 
    };
}

