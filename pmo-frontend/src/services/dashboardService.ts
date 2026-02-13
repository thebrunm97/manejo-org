import { supabase } from '../supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';

// Types
export interface HarvestSummaryItem {
    produto: string;
    total: number;
    unidade?: string;
}

export type HarvestSummary = Record<string, HarvestSummaryItem>;

export interface RecentActivity {
    id: number; // ou string dependendo do banco
    tipo: string;
    descricao: string; // "Colheita • Talhão 1"
    data: string;
    raw: any;
}

export const dashboardService = {
    // Check initialization
    _checkInit: () => {
        if (!supabase) {
            console.error('[dashboardService] Supabase client is UNDEFINED!');
            throw new Error('Supabase Client not initialized');
        }
    },

    // =================================================================
    // ||                    METRICS / DASHBOARD                      ||
    // =================================================================

    /**
     * Busca resumo de colheitas agrupado por produto.
     */
    async fetchHarvestSummary(pmoId: string | number): Promise<HarvestSummary> {
        this._checkInit();
        if (!pmoId) return {};

        try {
            const { data, error } = await supabase
                .from('caderno_campo')
                .select('*')
                .eq('tipo_atividade', 'Colheita')
                .eq('pmo_id', pmoId)
                .neq('tipo_atividade', 'CANCELADO')
                .order('data_registro', { ascending: false });

            if (error) throw error;

            // Lógica de Agregação (Reduce) movida da View para cá
            const summary = (data || []).reduce<HarvestSummary>((acc, item) => {
                const prod = item.produto || 'NÃO IDENTIFICADO';
                const qtd = parseFloat(String(item.quantidade_valor || 0));

                if (!acc[prod]) {
                    acc[prod] = {
                        produto: prod,
                        total: 0,
                        unidade: item.quantidade_unidade
                    };
                }
                acc[prod].total += qtd;
                return acc;
            }, {});

            return summary;

        } catch (error) {
            console.error('Erro ao buscar resumo de colheita:', error);
            return {};
        }
    },

    /**
     * Busca a atividade mais recente para exibir no card "Última Atividade".
     */
    async fetchLastActivity(pmoId: string | number): Promise<Date | null> {
        if (!pmoId) return null;

        try {
            const { data, error } = await supabase
                .from('caderno_campo')
                .select('criado_em')
                .eq('pmo_id', pmoId)
                .order('criado_em', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0 && data[0].criado_em) {
                return new Date(data[0].criado_em);
            }
            return null;

        } catch (error) {
            console.warn('Falha ao carregar última atividade:', error);
            return null;
        }
    },

    /**
     * Busca dados completos do dashboard em uma única query (JOIN).
     * Otimizado para latência.
     */
    async fetchDashboardDataJoined(userId: string) {
        if (!userId) return null;

        // Create a timeout promise
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: Banco de dados demorou para responder (Joined).')), 5000)
        );

        try {
            // Busca PMO ativo do perfil + dados do PMO + Caderno de Campo + Talhões
            const dbPromise = supabase
                .from('profiles')
                .select(`
                    pmo_ativo_id,
                    telefone,
                    pmos:pmo_ativo_id (
                        id, 
                        nome_identificador, 
                        version, 
                        form_data, 
                        created_at,
                        caderno_campo (
                            id, 
                            tipo_atividade, 
                            data_registro, 
                            produto, 
                            quantidade_valor, 
                            quantidade_unidade, 
                            talhao_canteiro,
                            criado_em
                        )
                    )
                `)
                .eq('id', userId)
                .single();

            // Race the DB call against the timeout
            const { data: profile, error: profileError } = await Promise.race([dbPromise, timeout]) as any;

            if (profileError) throw profileError;
            return profile;

        } catch (error) {
            console.error('Erro no fetchDashboardDataJoined:', error);
            throw error;
        }
    },

    /**
     * Busca lista das atividades mais recentes.
     */
    async fetchRecentActivities(pmoId: string | number, limit = 5): Promise<RecentActivity[]> {
        if (!pmoId) return [];

        try {
            const { data, error } = await supabase
                .from('caderno_campo')
                .select('*, talhoes(nome), caderno_campo_canteiros(canteiros(id, nome))')
                .eq('pmo_id', pmoId)
                .neq('tipo_atividade', 'CANCELADO')
                .order('data_registro', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (data || []).map(item => ({
                id: item.id,
                tipo: item.tipo_atividade,
                descricao: `${item.tipo_atividade}${item.talhao_canteiro ? ' • ' + item.talhao_canteiro : ''}`,
                data: item.data_registro,
                raw: item,
                // Campos auxiliares para compatibilidade com HarvestDashboard
                produto: item.produto,
                talhao_canteiro: item.talhao_canteiro,
                data_registro: item.data_registro
            }));

        } catch (error) {
            console.error('Erro ao buscar atividades recentes:', error);
            return [];
        }
    },


    // =================================================================
    // ||                 LEGACY / ACTION SUPPORT                     ||
    // =================================================================
    // Métodos mantidos do antigo dashboardService.js e tipados superficialmente

    async getTalhoes(pmoId: string | number) {
        let query = supabase.from('propriedade_talhoes').select('id, nome, cultura');
        if (pmoId) query = query.eq('pmo_id', pmoId);

        const { data, error } = await query;
        if (error) {
            console.error("Erro ao buscar talhões:", error);
            return [];
        }
        return data || [];
    },

    /**
     * Upload de comprovante para o bucket 'comprovantes'.
     * @param file Arquivo a ser enviado.
     * @param userId ID do usuário autenticado (obrigatório para policy RLS).
     * @returns URL pública do arquivo ou null em caso de erro.
     */
    async uploadComprovante(file: File, userId: string): Promise<string | null> {
        if (!file || !userId) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Date.now()}_audit.${fileExt}`;
            const filePath = `${userId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('comprovantes')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                });
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('comprovantes').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error('Falha no upload do comprovante:', error);
            throw new Error("Não foi possível salvar o comprovante.");
        }
    },

    async saveRegistro(payload: any) {
        if (!payload.pmo_id) throw new Error("ID do Plano de Manejo inválido.");
        if (!payload.data_registro) throw new Error("Data é obrigatória.");

        let error: PostgrestError | null = null;

        if (payload.id) {
            const { id, ...updateData } = payload;
            // Auditoria simplificada
            if (updateData.detalhes_tecnicos?.historico_alteracoes?.length > 0) {
                const hist = updateData.detalhes_tecnicos.historico_alteracoes;
                const lastLog = hist[hist.length - 1];
                updateData.detalhes_tecnicos.justificativa_edicao = lastLog.motivo;
                updateData.detalhes_tecnicos.data_edicao = lastLog.data;
            }
            const result = await supabase.from('caderno_campo').update(updateData).eq('id', id);
            error = result.error;
        } else {
            const { id, ...insertData } = payload;
            const result = await supabase.from('caderno_campo').insert([insertData]);
            error = result.error;
        }

        if (error) throw new Error(`Erro ao salvar: ${error.message}`);
        return true;
    },

    async saveRecord(tipo: string, form: any, anexo: string | null, pmoId: string | number) {
        if (!pmoId) throw new Error("ID do Plano de Manejo é obrigatório.");
        const payload = { ...form, pmo_id: pmoId, tipo_atividade: tipo };
        if (anexo && payload.detalhes_tecnicos) {
            payload.detalhes_tecnicos.anexo_url = anexo;
        }
        return await this.saveRegistro(payload);
    },

    async getItensPmo(pmoId: string | number) {
        if (!pmoId) return { sementes: [], insumos: [] };
        try {
            const { data, error } = await supabase.from('pmos').select('form_data').eq('id', pmoId).single();
            if (error || !data) return { sementes: [], insumos: [] };

            const fd = data.form_data || {};
            const sementesOrg = fd.secao_9_propagacao_vegetal?.origem_sementes_mudas_organicas?.sementes_mudas_organicas || [];
            const sementesNaoOrg = fd.secao_9_propagacao_vegetal?.origem_sementes_mudas_nao_organicas?.sementes_mudas_nao_organicas || [];
            const insumos = fd.secao_10_fitossanidade?.controle_pragas_doencas || [];

            return {
                sementes: [...(Array.isArray(sementesOrg) ? sementesOrg : []), ...(Array.isArray(sementesNaoOrg) ? sementesNaoOrg : [])],
                insumos: Array.isArray(insumos) ? insumos : []
            };
        } catch (error) {
            console.error('Erro ao buscar itens:', error);
            return { sementes: [], insumos: [] };
        }
    },

    async createQuickItem(pmoId: string | number, tipo: 'semente' | 'insumo', nome: string) {
        if (!pmoId || !tipo || !nome) throw new Error('Parâmetros inválidos');
        try {
            const { data, error } = await supabase.from('pmos').select('form_data').eq('id', pmoId).single();
            if (error) throw error;
            const formData = { ...data.form_data };
            const newId = `quick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Lógica simplificada de append (mantendo a original do JS)
            if (tipo === 'semente') {
                formData.secao_9_propagacao_vegetal ??= {};
                formData.secao_9_propagacao_vegetal.origem_sementes_mudas_organicas ??= {};
                formData.secao_9_propagacao_vegetal.origem_sementes_mudas_organicas.sementes_mudas_organicas ??= [];
                formData.secao_9_propagacao_vegetal.origem_sementes_mudas_organicas.sementes_mudas_organicas.push({
                    _id: newId, tipo: 'semente', especies: nome, origem: '⚡ CADASTRO RÁPIDO (Caderno)', quantidade: '', sistema_organico: true, data_compra: ''
                });
            } else if (tipo === 'insumo') {
                formData.secao_10_fitossanidade ??= {};
                formData.secao_10_fitossanidade.controle_pragas_doencas ??= [];
                formData.secao_10_fitossanidade.controle_pragas_doencas.push({
                    _id: newId, produto_ou_manejo: nome, onde: '', qual_praga_doenca: '', quando: '', procedencia: '⚡ CADASTRO RÁPIDO (Caderno)', composicao: '', marca: '', dosagem: ''
                });
            }

            const { error: updateError } = await supabase.from('pmos').update({ form_data: formData }).eq('id', pmoId);
            if (updateError) throw updateError;
            return nome;
        } catch (error: any) {
            throw new Error(`Falha ao criar ${tipo}: ${error.message}`);
        }
    }
};
