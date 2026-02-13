import { useState, useEffect, useCallback } from 'react';
import { cadernoService } from '../../services/cadernoService';
import { VegetalItem } from '../../domain/pmo/pmoTypes';

export const useVegetalImportLogic = (pmoId: string | number | undefined, currentItems: VegetalItem[], propriedadeId?: number) => {
    const [suggestions, setSuggestions] = useState<VegetalItem[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. Função de busca estável
    const fetchSuggestions = useCallback(async () => {
        // Conversão segura de ID
        const numericPmoId = pmoId ? parseInt(pmoId.toString(), 10) : null;

        console.log('🔵 [DEBUG] fetchSuggestions chamado. PMO ID:', numericPmoId, 'Propriedade ID:', propriedadeId);

        if (propriedadeId) {
            console.log('📡 [HOOK] Buscando por Propriedade:', propriedadeId);
        } else if (numericPmoId) {
            console.log('📡 [HOOK] Buscando por PMO:', numericPmoId);
        }

        setLoading(true);
        try {
            console.log('📡 [DEBUG] Chamando cadernoService...');
            // Passamos ambos. O Service decide a prioridade.
            const registros = await cadernoService.getRegistros(numericPmoId, propriedadeId);
            console.log(`📦 [DEBUG] Recebidos ${registros.length} registros brutos.`);

            const keywords = ['plantio', 'semeadura', 'transplante', 'cultivo', 'início', 'mudas'];
            const suggestionsTemp: VegetalItem[] = [];

            registros.forEach((reg: any) => {
                const tipo = (reg.tipo_atividade || reg.atividade?.tipo || reg.descricao || '').toLowerCase();
                const isPlantio = keywords.some(k => tipo.includes(k));

                if (isPlantio) {
                    const produtoNome = (
                        reg.produto ||
                        (reg.atividades?.[0]?.produto) ||
                        'DESCONHECIDO'
                    ).toUpperCase().trim();

                    const localNome = (
                        reg.talhoes?.nome ||
                        (reg.atividades?.[0]?.local) ||
                        'Local não informado'
                    );

                    // Desduplicação
                    const jaExiste = currentItems.some(item =>
                        item.produto?.toUpperCase() === produtoNome &&
                        item.talhoes_canteiros === localNome
                    );

                    if (!jaExiste) {
                        suggestionsTemp.push({
                            id: reg.id, // ID original do caderno
                            produto: produtoNome,
                            talhoes_canteiros: localNome,
                            area_plantada: 0,
                            area_plantada_unidade: 'ha',
                            producao_esperada_ano: 0,
                            producao_unidade: 'kg',
                            ['data_plantio_temp' as any]: reg.data_registro
                        });
                    }
                }
            });

            console.log(`✅ [DEBUG] ${suggestionsTemp.length} sugestões filtradas.`);
            setSuggestions(suggestionsTemp);
        } catch (error) {
            console.error('❌ [DEBUG] Erro na busca:', error);
        } finally {
            setLoading(false);
        }
    }, [pmoId, currentItems, propriedadeId]); // Dependências corretas

    // 2. Efeito para rodar automaticamente
    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);

    // 3. Função de Importação com Geração de ID Único Seguro
    const importItems = (itemsToImport: VegetalItem[]) => {
        return itemsToImport.map((item, index) => {
            const { ['data_plantio_temp' as any]: _, ...cleanItem } = item;
            // Usa Timestamp + Random + Index para garantir unicidade absoluta e evitar erro de Key
            return {
                ...cleanItem,
                id: Date.now() + Math.random() + index
            };
        });
    };

    return { suggestions, loading, importItems, fetchSuggestions };
};