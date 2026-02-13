export interface IStorageProvider {
    /**
     * Recupera um item do storage.
     * Retorna Promise<string | null> para compatibilidade com AsyncStorage.
     */
    getItem(key: string): Promise<string | null>;

    /**
     * Salva um item no storage.
     */
    setItem(key: string, value: string): Promise<void>;

    /**
     * Remove um item do storage.
     */
    removeItem(key: string): Promise<void>;
}
