/**
 * @file pmoTransformers.ts
 * @description Funções puras de transformação de dados do PMO.
 * 
 * ⚠️ REGRA ARQUITETURAL: Este arquivo NÃO deve ter dependências de:
 *    - React (useState, useEffect, etc.)
 *    - Supabase
 *    - Material UI
 * 
 * Isso garante que as funções sejam:
 *    ✅ Testáveis sem mocks
 *    ✅ Reutilizáveis em React Native
 *    ✅ Previsíveis (sem side effects)
 */

import type {
    PmoFormData,
    CulturaAnual,
    ManejoInsumo,
    TableConfig
} from './pmoTypes';

// ==================================================================
// ||                     NUMERIC PARSERS                          ||
// ==================================================================

/**
 * Converte valor para float, tratando vírgula como separador decimal.
 * Retorna null se inválido, vazio ou undefined.
 */
export function parseToFloatOrNull(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? null : num;
}

/**
 * Converte valor para inteiro.
 * Retorna null se inválido, vazio ou undefined.
 */
export function parseToIntOrNull(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseInt(String(value), 10);
    return isNaN(num) ? null : num;
}

// ==================================================================
// ||                    ROW VALIDATORS                            ||
// ==================================================================

/**
 * Verifica se uma linha de tabela está vazia (todos campos null/undefined/'').
 */
export function isRowEmpty(row: unknown): boolean {
    if (!row || typeof row !== 'object') return true;
    return Object.values(row as Record<string, unknown>).every(
        value => value === null || value === undefined || value === ''
    );
}

/**
 * Verifica se uma linha da Seção 5 (Produção Terceirizada) está vazia.
 * Validação específica pelos campos obrigatórios dessa seção.
 */
export function isSecao5RowEmpty(row: Record<string, unknown>): boolean {
    return !row.fornecedor && !row.localidade && !row.produto && !row.quantidade_ano;
}

// ==================================================================
// ||                   TABLE PROCESSING                           ||
// ==================================================================

/**
 * Processa tabelas dentro de uma seção do form_data:
 * - Remove linhas vazias
 * - Aplica conversões numéricas nos campos especificados
 * 
 * @param sectionData - Dados da seção a processar
 * @param tableConfigs - Configurações de cada tabela (caminho + conversões)
 */
export function processSectionTables(
    sectionData: Record<string, unknown> | undefined,
    tableConfigs: TableConfig[]
): void {
    if (!sectionData) return;

    for (const config of tableConfigs) {
        const { path, conversions } = config;

        // Navega até o parent da tabela
        let parent: Record<string, unknown> | undefined = sectionData;
        for (let i = 0; i < path.length - 1; i++) {
            parent = parent?.[path[i]] as Record<string, unknown> | undefined;
        }

        if (parent) {
            const arrayKey = path[path.length - 1];
            const items = parent[arrayKey];

            if (items && Array.isArray(items)) {
                // Remove linhas vazias
                const filteredItems = items.filter(
                    (item: unknown) => !isRowEmpty(item)
                );

                // Aplica conversões numéricas
                filteredItems.forEach((item: Record<string, unknown>) => {
                    if (conversions) {
                        conversions.forEach(conv => {
                            if (Object.prototype.hasOwnProperty.call(item, conv.field)) {
                                item[conv.field] = conv.parser(item[conv.field]);
                            }
                        });
                    }
                });

                parent[arrayKey] = filteredItems;
            }
        }
    }
}

// ==================================================================
// ||                    MAIN TRANSFORMER                          ||
// ==================================================================

/**
 * Limpa e normaliza o form_data antes de persistir no banco.
 * 
 * Operações realizadas:
 * 1. Remove linhas vazias de todas as tabelas
 * 2. Converte strings numéricas para Number (area, quantidade, etc.)
 * 3. Trata campos condicionais (ex: animais só se ha_animais = true)
 * 4. Normaliza datas vazias para null
 * 
 * @param data - form_data bruto do formulário
 * @returns form_data limpo pronto para persistência
 */
export function cleanFormDataForSubmission(data: PmoFormData): PmoFormData {
    // Deep clone para não mutar o original
    const cleanedData = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

    // --- Seção 2: Atividades Produtivas Orgânicas ---
    processSectionTables(
        cleanedData.secao_2_atividades_produtivas_organicas as Record<string, unknown>,
        [
            {
                path: ['producao_primaria_vegetal', 'produtos_primaria_vegetal'],
                conversions: [
                    { field: 'area_plantada', parser: parseToFloatOrNull },
                    { field: 'producao_esperada_ano', parser: parseToFloatOrNull }
                ]
            },
            {
                path: ['producao_primaria_animal', 'animais_primaria_animal'],
                conversions: [
                    { field: 'n_de_animais', parser: parseToIntOrNull },
                    { field: 'area_externa', parser: parseToFloatOrNull },
                    { field: 'area_interna_instalacoes', parser: parseToFloatOrNull },
                    { field: 'media_de_peso_vivo', parser: parseToFloatOrNull }
                ]
            },
            {
                path: ['processamento_produtos_origem_vegetal', 'produtos_processamento_vegetal'],
                conversions: []
            },
            {
                path: ['processamento_produtos_origem_animal', 'produtos_processamento_animal'],
                conversions: []
            }
        ]
    );

    // --- Seção 3: Atividades Produtivas NÃO Orgânicas ---
    processSectionTables(
        cleanedData.secao_3_atividades_produtivas_nao_organicas as Record<string, unknown>,
        [
            {
                path: ['producao_primaria_vegetal_nao_organica', 'produtos_primaria_vegetal_nao_organica'],
                conversions: [
                    { field: 'area_plantada', parser: parseToFloatOrNull },
                    { field: 'producao_esperada_ano', parser: parseToFloatOrNull }
                ]
            },
            {
                path: ['producao_primaria_animal_nao_organica', 'animais_primaria_animal_nao_organica'],
                conversions: [
                    { field: 'n_de_animais', parser: parseToIntOrNull },
                    { field: 'area_externa', parser: parseToFloatOrNull },
                    { field: 'area_interna_instalacoes', parser: parseToFloatOrNull },
                    { field: 'media_de_peso_vivo', parser: parseToFloatOrNull }
                ]
            },
            {
                path: ['processamento_produtos_origem_vegetal_nao_organico', 'produtos_processamento_vegetal_nao_organico'],
                conversions: []
            },
            {
                path: ['processamento_produtos_origem_animal_nao_organico', 'produtos_processamento_animal_nao_organico'],
                conversions: []
            }
        ]
    );

    // --- Seção 4: Animais de Serviço/Subsistência/Companhia ---
    processSectionTables(
        cleanedData.secao_4_animais_servico_subsistencia_companhia as Record<string, unknown>,
        [
            {
                path: ['animais_servico', 'lista_animais_servico'],
                conversions: [{ field: 'quantidade', parser: parseToIntOrNull }]
            },
            {
                path: ['animais_subsistencia_companhia_ornamentais', 'lista_animais_subsistencia'],
                conversions: [{ field: 'quantidade', parser: parseToIntOrNull }]
            }
        ]
    );

    // Limpa dados de animais se não ha_animais_servico_subsistencia_companhia
    const secao4Data = cleanedData.secao_4_animais_servico_subsistencia_companhia as Record<string, unknown>;
    if (secao4Data) {
        const haAnimais = secao4Data.ha_animais_servico_subsistencia_companhia as Record<string, unknown>;
        if (!haAnimais?.ha_animais_servico_subsistencia_companhia) {
            delete secao4Data.animais_servico;
            delete secao4Data.animais_subsistencia_companhia_ornamentais;
        }
    }

    // --- Seção 5: Produção Terceirizada ---
    const secao5Data = cleanedData.secao_5_producao_terceirizada as Record<string, unknown>;
    if (secao5Data?.produtos_terceirizados) {
        let items = secao5Data.produtos_terceirizados as Record<string, unknown>[];

        if (Array.isArray(items)) {
            items = items.filter(item => !isSecao5RowEmpty(item));
            items.forEach(item => {
                item.quantidade_ano = parseToFloatOrNull(item.quantidade_ano);
                if (item.processamento !== true && item.processamento !== false) {
                    item.processamento = null;
                }
            });
            secao5Data.produtos_terceirizados = items;
        }
    }

    // --- Seção Avaliação: Normaliza datas vazias ---
    const avaliacao = cleanedData.secao_avaliacao_plano_manejo as Record<string, unknown>;
    if (avaliacao) {
        const espacoOac = avaliacao.espaco_oac as Record<string, unknown>;
        if (espacoOac && (espacoOac.data_recebimento_plano_manejo === '' || espacoOac.data_recebimento_plano_manejo === 'null')) {
            espacoOac.data_recebimento_plano_manejo = null;
        }

        const statusDoc = avaliacao.status_documento as Record<string, unknown>;
        if (statusDoc && (statusDoc.data_analise === '' || statusDoc.data_analise === 'null')) {
            statusDoc.data_analise = null;
        }
    }

    return cleanedData as PmoFormData;
}

// ==================================================================
// ||                   DATA EXTRACTORS                            ||
// ==================================================================

/**
 * Extrai culturas anuais da Seção 2 para a tabela relacional `culturas_anuais`.
 * 
 * @param formData - form_data completo do PMO
 * @param pmoId - ID do PMO (FK)
 * @returns Array de CulturaAnual prontos para insert
 */
export function extractCulturasAnuais(formData: PmoFormData, pmoId: string): CulturaAnual[] {
    const secao2 = formData.secao_2_atividades_produtivas_organicas as Record<string, unknown>;
    const producaoVegetal = secao2?.producao_primaria_vegetal as Record<string, unknown>;
    const produtos = producaoVegetal?.produtos_primaria_vegetal as Record<string, unknown>[];

    if (!Array.isArray(produtos) || produtos.length === 0) {
        return [];
    }

    return produtos
        .filter(item => !isRowEmpty(item))
        .map(item => ({
            pmo_id: pmoId,
            produto: String(item.produto || ''),
            area_plantada: parseToFloatOrNull(item.area_plantada) ?? 0,
            unidade_area: String(item.area_plantada_unidade || ''),
            producao_estimada: parseToFloatOrNull(item.producao_esperada_ano) ?? 0,
            unidade_producao: String(item.producao_unidade || ''),
            data_plantio: null,
            previsao_colheita: null
        }));
}

/**
 * Extrai insumos de manejo da Seção 8 para a tabela relacional `pmo_manejo`.
 * 
 * @param formData - form_data completo do PMO
 * @param pmoId - ID do PMO (FK)
 * @returns Array de ManejoInsumo prontos para upsert
 */
export function extractManejoInsumos(formData: PmoFormData, pmoId: string): ManejoInsumo[] {
    const secao8 = formData.secao_8_insumos_equipamentos as Record<string, unknown>;
    const insumos = secao8?.insumos_melhorar_fertilidade as Record<string, unknown>[];

    if (!Array.isArray(insumos) || insumos.length === 0) {
        return [];
    }

    return insumos
        .filter(item => !isRowEmpty(item))
        .map(item => ({
            id: (item.id || item._id) as string | undefined,
            pmo_id: pmoId,
            insumo: String(item.produto_ou_manejo || ''),
            fonte: String(item.procedencia || ''),
            quantidade: String(item.dosagem || ''),
            metodo_aplicacao: String(item.quando || ''),
            talhoes_aplicados: item.onde ? { local: String(item.onde) } : null,
            data_aplicacao: null
        }));
}
