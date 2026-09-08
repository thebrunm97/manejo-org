// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

import * as Sentry from "@sentry/react";

// Usar variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log('[SupabaseClient] Initializing...', { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });

// Verificação de segurança
if (!supabaseUrl || !supabaseAnonKey) {
  const errMsg = 'Variáveis de ambiente do Supabase não encontradas!';
  console.error('[SupabaseClient]', errMsg);
  Sentry.captureException(new Error(errMsg));
  throw new Error(errMsg);
}

// Custom storage adapter that falls back to memory if localStorage is blocked
const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return memoryStorage.get(key) || null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      memoryStorage.set(key, value);
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      memoryStorage.delete(key);
    }
  },
};

// Cria e exporta o nosso cliente Supabase com storage customizado
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
console.log('[SupabaseClient] Client created:', !!supabase);


