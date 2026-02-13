/**
 * @file pmoService.ts
 * @description Serviço de dados para PMO (Plano de Manejo Orgânico).
 * 
 * Encapsula todas as operações de persistência do Supabase.
 * Componentes React NÃO devem chamar Supabase diretamente.
 */

import { supabase } from '../supabaseClient';
import type {
    PmoPayload,
    PmoRecord,
    PmoListItem,
    UserProfile,
    SaveResult,
    FetchResult,
    CulturaAnual,
    ManejoInsumo
} from '../domain/pmo/pmoTypes';

// ==================================================================
// ||                    LEGACY FUNCTIONS                          ||
// ==================================================================

/**
 * Interface para mapeamento de colunas (legado).
 */
interface ColumnMapping {
    [frontKey: string]: string;
}

/**
 * Salva uma seção específica do PMO em uma tabela relacional do Supabase.
 * Realiza a limpeza de IDs temporários ('row_') para garantir INSERTs corretos,
 * e mantém IDs (UUIDs) para UPDATEs.
 * 
 * @param pmoId - O ID do Plano de Manejo (FK).
 * @param tableName - Nome da tabela no Supabase (ex: 'pmo_culturas').
 * @param data - Array de objetos (linhas da tabela).
 * @param columnMapping - Opcional: Objeto { frontKey: 'db_column' }.
 */
export const savePmoSection = async (
    pmoId: string | number,
    tableName: string,
    data: Record<string, unknown>[],
    columnMapping: ColumnMapping | null = {}
): Promise<Record<string, unknown>[] | undefined> => {
    // Garantir que columnMapping seja um objeto, mesmo que passem null explicitamente
    const safeMapping = columnMapping || {};

    if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`[pmoService] Sem dados para salvar em ${tableName}.`);
        return;
    }

    console.group(`[pmoService] Salvando ${tableName} (PMO: ${pmoId})`);

    // 1. Sanitize & Prepare Payload
    const cleanedData = data.map(item => {
        // Separa ID e _id do resto para não enviar 'undefined' ou colunas inexistentes
        const { id, _id, ...rest } = item as { id?: string; _id?: string;[key: string]: unknown };

        // Tenta encontrar o identificador real (seja 'id' ou '_id')
        const rawId = id || _id;
        const rawIdStr = String(rawId || '');

        // Verifica se é ID temporário (gerado pelo front)
        // Ex: 'row_123...', 'item_abc...', 'new_...' ou vazio
        const isTemporaryId =
            !rawId ||
            rawIdStr.startsWith('row_') ||
            rawIdStr.startsWith('item_') ||
            rawIdStr.startsWith('temp_') ||
            rawIdStr.startsWith('new_');

        // Base payload com FK
        const payload: Record<string, unknown> = {
            pmo_id: pmoId
        };

        if (!isTemporaryId && rawId) {
            payload.id = rawId;
        } else {
            // BACKUP: Gerar UUID v4 puro JS para garantir compatibilidade total (mesmo sem HTTPS/crypto)
            payload.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        // Mapeia colunas (DE/PARA) e copia dados
        Object.keys(rest).forEach(key => {
            const dbKey = safeMapping[key] || key;

            // Tratamento de valores vazios para null (postgres friendly)
            let value = rest[key];
            if (value === '' && key !== 'nome') value = null;

            payload[dbKey] = value;
        });

        return payload;
    });

    console.log('Payload limpo:', cleanedData);

    // 2. Upsert no Supabase
    try {
        const { data: result, error } = await supabase
            .from(tableName)
            .upsert(cleanedData)
            .select();

        if (error) {
            console.error(`Erro ao salvar ${tableName}:`, error);
            throw error;
        }

        console.log(`Sucesso! ${result?.length} registros processados.`);
        console.groupEnd();
        return result;

    } catch (err) {
        console.groupEnd();
        throw err;
    }
};

// ==================================================================
// ||                    NEW PMO OPERATIONS                        ||
// ==================================================================

/**
 * Busca um PMO por ID.
 * 
 * @param pmoId - ID do PMO a buscar
 * @returns FetchResult com PmoRecord ou erro
 */
export async function fetchPmoById(pmoId: string): Promise<FetchResult<PmoRecord>> {
    try {
        const { data, error } = await supabase
            .from('pmos')
            .select('*')
            .eq('id', pmoId)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        if (!data) {
            return { success: false, error: `PMO com ID ${pmoId} não encontrado.` };
        }

        return { success: true, data: data as PmoRecord };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar PMO';
        return { success: false, error: message };
    }
}

/**
 * Busca detalhes simplificados de um PMO (útil para resolução de propriedade_id e nome).
 * 
 * @param pmoId - ID do PMO
 * @returns FetchResult com propriedade_id e nomePropriedade ou erro
 */
export async function getPmoDetails(pmoId: string | number): Promise<FetchResult<{ propriedade_id: number | null; nomePropriedade: string | null }>> {
    try {
        const { data, error } = await supabase
            .from('pmos')
            .select('*, propriedades(id, nome)')
            .eq('id', pmoId)
            .single();

        if (error) {
            console.error('Erro ao buscar detalhes do PMO:', error);
            return { success: false, error: error.message };
        }

        // Normaliza o retorno
        const propriedadeId = data.propriedade_id || data.propriedades?.id;
        const nomePropriedade = data.propriedades?.nome;

        return {
            success: true,
            data: {
                propriedade_id: propriedadeId ?? null,
                nomePropriedade: nomePropriedade ?? null,
                ...data // Mantém outros dados se necessário
            }
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar detalhes do PMO';
        return { success: false, error: message };
    }
}

/**
 * Cria um novo PMO no Supabase.
 * 
 * @param payload - Dados do PMO (sem ID, será gerado pelo banco)
 * @returns SaveResult com novo pmoId ou erro
 */
export async function createPmo(
    payload: Omit<PmoPayload, 'id'>
): Promise<SaveResult> {
    try {
        const { data, error } = await supabase
            .from('pmos')
            .insert(payload)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            pmoId: data?.id as string
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar PMO';
        return { success: false, error: message };
    }
}

/**
 * Atualiza um PMO existente.
 * 
 * @param pmoId - ID do PMO a atualizar
 * @param payload - Dados parciais para atualização
 * @returns SaveResult indicando sucesso ou erro
 */
export async function updatePmo(
    pmoId: string,
    payload: Partial<PmoPayload>
): Promise<SaveResult> {
    try {
        // Remove o id do payload para não conflitar com a condição eq()
        const { id, ...updateData } = payload as PmoPayload;

        const { error } = await supabase
            .from('pmos')
            .update(updateData)
            .eq('id', pmoId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, pmoId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar PMO';
        return { success: false, error: message };
    }
}

// ==================================================================
// ||                 RELATED TABLES SYNC                          ||
// ==================================================================

/**
 * Sincroniza culturas anuais: deleta existentes e insere nova lista.
 * 
 * @param pmoId - ID do PMO
 * @param culturas - Lista de culturas a inserir
 */
export async function syncCulturasAnuais(
    pmoId: string,
    culturas: CulturaAnual[]
): Promise<void> {
    if (culturas.length === 0) {
        console.log('[pmoService] Sem culturas anuais para sincronizar.');
        return;
    }

    console.group(`[pmoService] Sincronizando culturas_anuais (PMO: ${pmoId})`);

    try {
        // 1. Delete existing
        const { error: deleteError } = await supabase
            .from('culturas_anuais')
            .delete()
            .eq('pmo_id', pmoId);

        if (deleteError) {
            console.warn('Erro ao deletar culturas existentes:', deleteError);
        }

        // 2. Insert new
        const { error: insertError } = await supabase
            .from('culturas_anuais')
            .insert(culturas);

        if (insertError) {
            throw insertError;
        }

        console.log(`Sucesso! ${culturas.length} culturas sincronizadas.`);
    } catch (err) {
        console.error('Erro ao sincronizar culturas:', err);
        throw err;
    } finally {
        console.groupEnd();
    }
}

/**
 * Sincroniza insumos de manejo via upsert.
 * 
 * @param pmoId - ID do PMO
 * @param insumos - Lista de insumos a upsert
 */
export async function syncManejoInsumos(
    pmoId: string,
    insumos: ManejoInsumo[]
): Promise<void> {
    if (insumos.length === 0) {
        console.log('[pmoService] Sem insumos de manejo para sincronizar.');
        return;
    }

    // Usa a função existente savePmoSection para manter consistência
    await savePmoSection(pmoId, 'pmo_manejo', insumos as unknown as Record<string, unknown>[], null);
}

// ==================================================================
// ||                   PMO LIST OPERATIONS                        ||
// ==================================================================

/**
 * Busca todos os PMOs do usuário (lista leve, sem form_data).
 * Ordenados por data de criação (mais recente primeiro).
 * 
 * @param userId - Opcional: ID do usuário para filtrar (se não passar, confia no RLS)
 * @returns FetchResult com array de PmoListItem
 */
export async function fetchAllPmos(userId?: string): Promise<FetchResult<PmoListItem[]>> {
    try {
        let query = supabase
            .from('pmos')
            .select('id, nome_identificador, status, version, created_at')
            .order('created_at', { ascending: false });

        // Se userId for fornecido, filtra explicitamente
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: (data || []) as PmoListItem[] };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar lista de PMOs';
        return { success: false, error: message };
    }
}

/**
 * Exclui um PMO pelo ID.
 * 
 * @param pmoId - ID do PMO a excluir
 * @returns SaveResult indicando sucesso ou erro
 */
export async function deletePmo(pmoId: string): Promise<SaveResult> {
    try {
        const { error } = await supabase
            .from('pmos')
            .delete()
            .eq('id', pmoId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, pmoId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir PMO';
        return { success: false, error: message };
    }
}

// ==================================================================
// ||           PROFILE OPERATIONS (Temporary)                     ||
// ==================================================================
// TODO: Mover para profileService.ts quando houver mais funções

/**
 * Busca o perfil do usuário (incluindo pmo_ativo_id).
 * 
 * @param userId - ID do usuário
 * @returns FetchResult com UserProfile ou erro
 */
export async function fetchUserProfile(
    userId: string
): Promise<FetchResult<UserProfile>> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, pmo_ativo_id, telefone')
            .eq('id', userId)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: data as UserProfile };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar perfil';
        return { success: false, error: message };
    }
}

/**
 * Define qual PMO está ativo para o usuário.
 * 
 * @param userId - ID do usuário
 * @param pmoId - ID do PMO a ativar
 * @returns SaveResult indicando sucesso ou erro
 */
export async function setActivePmo(
    userId: string,
    pmoId: string
): Promise<SaveResult> {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ pmo_ativo_id: pmoId })
            .eq('id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, pmoId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao ativar PMO';
        return { success: false, error: message };
    }
}

/**
 * Busca propriedades vinculadas ao usuário.
 * Útil para fallback quando o PMO não tem propriedade_id vinculado.
 * 
 * @param userId - ID do usuário (UUID)
 * @returns Lista de propriedades
 */
export async function fetchUserProperties(userId: string): Promise<FetchResult<any[]>> {
    try {
        const { data, error } = await supabase
            .from('propriedades')
            .select('id, nome')
            .eq('user_id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: 'Erro ao buscar propriedades do usuário' };
    }
}

/**
 * Busca sugestões de planejamento pendentes do bot.
 */
export async function fetchPlanningSuggestions(userId: string): Promise<FetchResult<any[]>> {
    try {
        console.log('[pmoService] fetchPlanningSuggestions for user:', userId);
        const { data, error } = await supabase
            .from('logs_treinamento')
            .select('*')
            .eq('user_id', userId)
            .ilike('tipo_atividade', 'planejamento')
            .eq('processado', false) // Garante que só vemos o que é novo
            .order('created_at', { ascending: false });

        if (error) return { success: false, error: error.message };
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: 'Erro ao buscar sugestões' };
    }
}

/**
 * Marca uma sugestão como processada (ao Aplicar ou Ignorar).
 */
export async function markSuggestionAsProcessed(logId: string): Promise<SaveResult> {
    try {
        const { error } = await supabase
            .from('logs_treinamento')
            .update({ processado: true })
            .eq('id', logId);

        if (error) return { success: false, error: error.message };
        return { success: true, pmoId: logId };
    } catch (err) {
        return { success: false, error: 'Erro ao atualizar sugestão' };
    }
}

/**
 * Registra o feedback do usuário sobre uma sugestão (Loop de Treinamento).
 * Atualiza o log com a versão corrigida (Ground Truth).
 */
export async function logFeedback(
    logId: string,
    finalData: any,
    foiEditado: boolean = false
): Promise<SaveResult> {
    try {
        console.log(`[ML-Loop] Registrando feedback para log ${logId}. Editado? ${foiEditado}`);

        const updatePayload = {
            json_corrigido: finalData,
            foi_editado: foiEditado,
            status_validacao: foiEditado ? 'corrigido_humano' : 'validado_humano',
            processado: true // Garante que saiu da lista de pendentes
        };

        const { error } = await supabase
            .from('logs_treinamento')
            .update(updatePayload)
            .eq('id', logId);

        if (error) {
            console.error('[ML-Loop] Erro ao salvar feedback:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: 'Erro de conexão no feedback loop' };
    }
}

/**
 * Salva uma sugestão refinada pelo usuário.
 * 
 * @param logId - ID do log de treinamento
 * @param finalData - Dados finais corrigidos pelo usuário
 */
export async function saveRefinedSuggestion(
    logId: string,
    finalData: any
): Promise<SaveResult> {
    try {
        console.log(`[PMO-Bot] Salvando refinamento para log ${logId}`);

        const { error } = await supabase
            .from('logs_treinamento')
            .update({
                processado: true,
                json_final: finalData,
                feedback_usuario: 'Aceito com refinamento',
                status_validacao: 'corrigido_humano' // Manter consistência com ML loop
            })
            .eq('id', logId);

        if (error) {
            console.error('[PMO-Bot] Erro ao salvar refinamento:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: 'Erro ao salvar refinamento' };
    }
}

