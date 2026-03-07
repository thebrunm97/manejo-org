import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'pmo-digital-db';
const STORE_NAME = 'pending-pmos';
const DB_VERSION = 1;

export const CADERNO_STORE = 'pending-caderno';

interface PMODatabase extends DBSchema {
    [STORE_NAME]: {
        key: string;
        value: any; // We'll refine this once PMOFormData is defined
    };
    [CADERNO_STORE]: {
        key: string;
        value: any;
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
    },
});

/**
 * Um wrapper para interagir com o IndexedDB de forma simples.
 */
export const localDb = {
    /**
     * Obtém um valor pela chave.
     */
    async get(key: string, storeName: typeof STORE_NAME | typeof CADERNO_STORE = STORE_NAME) {
        return (await dbPromise).get(storeName, key);
    },

    /**
     * Adiciona ou atualiza um valor. O método 'put' faz um "upsert".
     */
    async set(value: any, storeName: typeof STORE_NAME | typeof CADERNO_STORE = STORE_NAME) {
        return (await dbPromise).put(storeName, value);
    },

    /**
     * Deleta um valor pela chave.
     */
    async delete(key: string, storeName: typeof STORE_NAME | typeof CADERNO_STORE = STORE_NAME) {
        return (await dbPromise).delete(storeName, key);
    },

    /**
     * Obtém todos os valores da store.
     */
    async getAll(storeName: typeof STORE_NAME | typeof CADERNO_STORE = STORE_NAME) {
        return (await dbPromise).getAll(storeName);
    },

    /**
     * Limpa todos os valores da store.
     */
    async clear(storeName: typeof STORE_NAME | typeof CADERNO_STORE = STORE_NAME) {
        return (await dbPromise).clear(storeName);
    }
};
