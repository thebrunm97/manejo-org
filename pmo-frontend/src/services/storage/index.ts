import { WebStorageProvider } from './WebStorageProvider';
// No futuro: import { NativeStorageProvider } from './NativeStorageProvider';

/**
 * Singleton do serviço de storage.
 * Trocar a implementação aqui mudará o storage em toda a aplicação.
 */
export const storageService = new WebStorageProvider();
