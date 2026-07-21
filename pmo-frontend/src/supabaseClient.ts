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

// Cria e exporta o nosso cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('[SupabaseClient] Client created:', !!supabase);


