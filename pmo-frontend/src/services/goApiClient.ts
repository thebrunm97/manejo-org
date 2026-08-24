// Cliente das rotas servidas pelo backend Go (DT-59).
//
// POR QUE ESTE ARQUIVO EXISTE
//
// As chamadas ao Go estavam espalhadas e cada uma resolvia autenticação do seu
// jeito. Duas mandavam `Bearer ${localStorage.getItem('token')}` — chave que o
// Supabase nunca escreve (a sessão dele mora em `sb-<ref>-auth-token`, e o SDK
// a gerencia sozinho, incluindo a renovação). Ou seja: o header ia com `null`.
// Não quebrava nada porque o servidor não verificava token nenhum; agora que
// verifica, esse caminho quebraria o painel inteiro.
//
// A fonte correta do token é `supabase.auth.getSession()`, que devolve o
// access_token válido e cuida do refresh. Centralizar aqui evita que a próxima
// rota migrada repita o mesmo erro.

import { supabase } from '../supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Monta a URL completa de uma rota do backend Go.
 */
export function goApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * fetch autenticado contra o backend Go.
 *
 * Anexa o access_token da sessão atual do Supabase. Se não houver sessão,
 * falha imediatamente com uma mensagem clara em vez de mandar a requisição
 * sem credencial e deixar o servidor responder 401 — o erro fica mais perto
 * da causa real (sessão expirada / usuário deslogado).
 */
export async function goApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Não foi possível ler a sessão: ${error.message}`);
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sessão expirada ou ausente. Faça login novamente.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(goApiUrl(path), { ...init, headers });
}
