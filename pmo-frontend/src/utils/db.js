// src/utils/db.js

import { openDB } from 'idb';

const DB_NAME = 'pmo-digital-db';
const STORE_NAME = 'pending-pmos';
const DB_VERSION = 1;

// Inicializa o banco de dados e a object store
const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // Cria store para PMOs
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }

    // Cria store para Caderno de Campo (Registros Manuais)
    if (!db.objectStoreNames.contains('pending-caderno')) {
      db.createObjectStore('pending-caderno', { keyPath: 'id' });
    }
  },
});

export const CADERNO_STORE = 'pending-caderno';

/**
 * Um wrapper para interagir com o IndexedDB de forma simples.
 */
export const localDb = {
  /**
   * Obtém um valor pela chave.
   * @param {string} key A chave do objeto a ser recuperado.
   * @param {string} storeName Opcional: Nome da store (default: pending-pmos)
   */
  async get(key, storeName = STORE_NAME) {
    return (await dbPromise).get(storeName, key);
  },

  /**
   * Adiciona ou atualiza um valor. O método 'put' faz um "upsert".
   * @param {object} value O objeto a ser salvo. Precisa ter uma propriedade 'id'.
   * @param {string} storeName Opcional: Nome da store (default: pending-pmos)
   */
  async set(value, storeName = STORE_NAME) {
    return (await dbPromise).put(storeName, value);
  },

  /**
   * Deleta um valor pela chave.
   * @param {string} key A chave do objeto a ser deletado.
   * @param {string} storeName Opcional: Nome da store (default: pending-pmos)
   */
  async delete(key, storeName = STORE_NAME) {
    return (await dbPromise).delete(storeName, key);
  },

  /**
   * Obtém todos os valores da store.
   * @returns {Promise<Array<object>>} Uma promessa que resolve com um array de todos os objetos.
   * @param {string} storeName Opcional: Nome da store (default: pending-pmos)
   */
  async getAll(storeName = STORE_NAME) {
    return (await dbPromise).getAll(storeName);
  },

  /**
   * Limpa todos os valores da store.
   * @param {string} storeName Opcional: Nome da store (default: pending-pmos)
   */
  async clear(storeName = STORE_NAME) {
    return (await dbPromise).clear(storeName);
  }
};