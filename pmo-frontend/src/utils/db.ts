import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'pmo-digital-db';
const STORE_NAME = 'pending-pmos';
const DB_VERSION = 1;

export const CADERNO_STORE = 'pending-caderno';
export const SYNC_QUEUE_STORE = 'offline-sync-queue';

export interface SyncQueueItem {
    id: string; // uuid
    type: 'CADERNO_SAVE' | 'PMODATA_SAVE';
    payload: any;
    timestamp: string; // ISO string
    retries: number;
    status: 'pending' | 'syncing' | 'failed';
    error?: string;
}

interface PMODatabase extends DBSchema {
    [STORE_NAME]: {
        key: string;
        value: any;
    };
    [CADERNO_STORE]: {
        key: string;
        value: any;
    };
    [SYNC_QUEUE_STORE]: {
        key: string;
        value: SyncQueueItem;
    };
}

// Inicializa o banco de dados e a object store
const dbPromise: Promise<IDBPDatabase<PMODatabase>> = openDB<PMODatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
        // Cria store para PMOs
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }

        // Cria store para Caderno de Campo (Registros Manuais)
        if (!db.objectStoreNames.contains(CADERNO_STORE)) {
            db.createObjectStore(CADERNO_STORE, { keyPath: 'id' });
        }

        // Cria store para Fila de Sincronização Unificada
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
            db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        }
    },
});

/**
 * Um wrapper para interagir com o IndexedDB de forma simples.
 */
export const localDb = {
    /**
     * Salva um valor na store.
     */
    async set(value: any, storeName: typeof STORE_NAME | typeof CADERNO_STORE | typeof SYNC_QUEUE_STORE = STORE_NAME) {
        return (await dbPromise).put(storeName, value);
    },

    /**
     * Obtém um valor pela chave.
     */
    async get(id: string, storeName: typeof STORE_NAME | typeof CADERNO_STORE | typeof SYNC_QUEUE_STORE = STORE_NAME) {
        return (await dbPromise).get(storeName, id);
    },

    /**
     * Remove um valor da store.
     */
    async delete(id: string, storeName: typeof STORE_NAME | typeof CADERNO_STORE | typeof SYNC_QUEUE_STORE = STORE_NAME) {
        return (await dbPromise).delete(storeName, id);
    },

    /**
     * Obtém todos os valores da store.
     */
    async getAll(storeName: typeof STORE_NAME | typeof CADERNO_STORE | typeof SYNC_QUEUE_STORE = STORE_NAME) {
        return (await dbPromise).getAll(storeName);
    },

    /**
     * Limpa todos os valores da store.
     */
    async clear(storeName: typeof STORE_NAME | typeof CADERNO_STORE | typeof SYNC_QUEUE_STORE = STORE_NAME) {
        return (await dbPromise).clear(storeName);
    }
};
