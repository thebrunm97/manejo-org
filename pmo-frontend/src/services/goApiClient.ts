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

// RPCs que o backend Go encaminha ao PostgREST (DT-59, fatia 3).
//
// POR QUE UM ALLOWLIST AQUI TAMBÉM, DUPLICANDO O DO GO
//
// O gateway (internal/gateway/rpc_proxy.go) já recusa qualquer nome fora da
// lista com 404 — essa é a barreira que importa de verdade, porque o
// frontend não é o único cliente possível do endpoint. Esta lista aqui é só
// para o TypeScript pegar erro de digitação em tempo de compilação, não uma
// segunda camada de segurança.
const RPCS_VIA_GATEWAY = [
  'create_talhao',
  'update_talhao',
  'delete_talhao',
  'create_caderno_registro',
  'update_caderno_registro',
  'delete_caderno_registro',
  'rpc_update_propriedade',
  'create_pmo',
  'update_pmo',
  'delete_pmo',
] as const;

export type RpcViaGateway = (typeof RPCS_VIA_GATEWAY)[number];

/**
 * Chama uma RPC do Supabase através do backend Go, no lugar de
 * `supabase.rpc(nome, params)` direto.
 *
 * A ASSINATURA IMITA supabase.rpc() DE PROPÓSITO: devolve `{ data, error }`
 * em vez de lançar exceção, para o corpo de cada service que já trata esse
 * formato (`if (error) throw ...`) não precisar mudar — só a chamada em si.
 *
 * O que muda de verdade por trás: em vez de ir direto ao PostgREST com a
 * anon key, a chamada passa pelo Go, que valida o JWT e reencaminha o MESMO
 * token do produtor para o PostgREST — auth.uid() dentro da RPC resolve
 * exatamente igual. O Go só acrescenta um log central da chamada.
 */
export async function goApiRpc<T = unknown>(
  nome: RpcViaGateway,
  params: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const response = await goApiFetch(`/api/v1/rpc/${nome}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const texto = await response.text();
    const corpo = texto ? JSON.parse(texto) : null;

    if (!response.ok) {
      const mensagem =
        (corpo && (corpo.message || corpo.error)) || `Erro ${response.status} ao chamar ${nome}`;
      return { data: null, error: { message: mensagem } };
    }

    return { data: corpo as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : `Falha desconhecida ao chamar ${nome}` },
    };
  }
}
