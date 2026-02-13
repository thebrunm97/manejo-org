/**
 * @file useCadernoSync.ts
 * @description Global hook to handle background synchronization of Manual Records.
 * It listens for 'online' events and processes the 'pending-caderno' queue.
 */

import { useEffect, useState, useCallback } from 'react';
import { localDb, CADERNO_STORE } from '../../utils/db';
import { cadernoService } from '../../services/cadernoService';
import { toast } from 'react-toastify';

export function useCadernoSync() {
    const [isSyncing, setIsSyncing] = useState(false);

    const syncPendingRecords = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;

        try {
            const pendingRecords = await localDb.getAll(CADERNO_STORE);

            if (!pendingRecords || pendingRecords.length === 0) return;

            setIsSyncing(true);
            console.log(`[CadernoSync] Sincronizando ${pendingRecords.length} registros...`);

            const toastId = toast.info('Sincronizando registros do Caderno de Campo...', { autoClose: false });

            let successCount = 0;
            let failCount = 0;

            for (const record of pendingRecords) {
                try {
                    // Removes ID if offline temp ID to let Supabase buffer it
                    // OR keeps it if it was an update to an existing ID
                    const isNew = String(record.id).startsWith('offline_');

                    if (isNew) {
                        const { id, synced, updated_at, ...payload } = record;
                        await cadernoService.addRegistro(payload);
                    } else {
                        const { synced, updated_at, ...payload } = record;
                        // Assuming update support (not fully blocked)
                        await cadernoService.updateRegistro(record.id, payload);
                    }

                    // Delete from local DB on success
                    await localDb.delete(record.id, CADERNO_STORE);
                    successCount++;
                } catch (err) {
                    console.error(`[CadernoSync] Falha registro ${record.id}:`, err);
                    failCount++;
                    // We keep it in DB to retry later
                }
            }

            toast.dismiss(toastId);

            if (successCount > 0) {
                toast.success(`${successCount} registros sincronizados com sucesso!`);
            }
            if (failCount > 0) {
                toast.warn(`${failCount} registros falharam ao sincronizar. Tentaremos novamente.`);
            }

        } catch (err) {
            console.error('[CadernoSync] Erro no loop de sync:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    useEffect(() => {
        // Listen for online events
        window.addEventListener('online', syncPendingRecords);

        // Initial check on mount (in case we just reloaded and have connection)
        syncPendingRecords();

        return () => {
            window.removeEventListener('online', syncPendingRecords);
        };
    }, [syncPendingRecords]);

    return { isSyncing, syncNow: syncPendingRecords };
}
