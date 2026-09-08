import { useSyncEngine } from '../hooks/offline/useSyncEngine';

/**
 * Wrapper que monta o useSyncEngine fora do bundle inicial (lazy loaded),
 * removendo zod/idb/serviços de caderno do primeiro load.
 */
export default function OfflineSyncEngine() {
    useSyncEngine();
    return null;
}
