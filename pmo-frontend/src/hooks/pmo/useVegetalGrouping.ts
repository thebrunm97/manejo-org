import { useState, useMemo, useCallback } from 'react';
import { VegetalItem } from '../../domain/pmo/pmoTypes';

export interface CulturaGroup {
    nome: string;
    items: VegetalItem[];
    totalArea: number;
    areaUnidade: string;
    totalProducao: number;
    producaoUnidade: string;
}

const generateUniqueId = (): number =>
    Date.now() + Math.random();

const normalizeProduto = (produto?: string): string =>
    (produto || 'SEM NOME').toUpperCase().trim();

// Converte área para hectares para soma consistente
const toHectares = (value: number | undefined, unit: string | undefined): number => {
    if (!value || isNaN(value)) return 0;
    if (unit === 'm²') return value / 10000;
    return value; // Assume hectares
};

export const useVegetalGrouping = (
    data: VegetalItem[],
    onDataChange: (newData: VegetalItem[]) => void
) => {
    // Estado para controlar qual accordion está expandido
    const [expandedGroup, setExpandedGroup] = useState<string | false>(false);

    // Estado para o dialog de nova cultura
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newCultureName, setNewCultureName] = useState('');

    // --- AGRUPAMENTO E CÁLCULOS ---
    const groupedData = useMemo<CulturaGroup[]>(() => {
        const groups: Record<string, VegetalItem[]> = {};

        // Agrupar por produto normalizado
        (data || []).forEach(item => {
            const key = normalizeProduto(item.produto);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });

        // Converter para array com cálculos
        return Object.entries(groups)
            .map(([nome, items]): CulturaGroup => {
                // Calcular totais (convertendo tudo para hectares)
                const totalAreaHa = items.reduce((sum, item) => {
                    return sum + toHectares(item.area_plantada, item.area_plantada_unidade);
                }, 0);

                // Usar unidade do primeiro item com área definida, ou 'ha' como padrão
                const areaUnidade = items.find(i => i.area_plantada_unidade)?.area_plantada_unidade || 'ha';

                // Somar produção (assume mesma unidade)
                const totalProducao = items.reduce((sum, item) => {
                    return sum + (item.producao_esperada_ano || 0);
                }, 0);

                const producaoUnidade = items.find(i => i.producao_unidade)?.producao_unidade || 'kg';

                return {
                    nome,
                    items,
                    totalArea: totalAreaHa,
                    areaUnidade: 'ha', // Sempre mostra em ha no resumo
                    totalProducao,
                    producaoUnidade,
                };
            })
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [data]);

    // --- HANDLERS ---

    const handleAccordionChange = useCallback(
        (groupName: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
            setExpandedGroup(isExpanded ? groupName : false);
        },
        []
    );

    const handleItemChange = useCallback(
        (itemId: string | number, field: keyof VegetalItem, value: any) => {
            const newData = data.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            );
            onDataChange(newData);
        },
        [data, onDataChange]
    );

    const handleRemoveItem = useCallback(
        (itemId: string | number) => {
            const newData = data.filter(item => item.id !== itemId);
            onDataChange(newData);
        },
        [data, onDataChange]
    );

    const handleAddLocalToGroup = useCallback(
        (culturaName: string) => {
            const newItem: VegetalItem = {
                id: generateUniqueId(),
                produto: culturaName,
                talhoes_canteiros: '',
                area_plantada: 0,
                area_plantada_unidade: 'ha',
                producao_esperada_ano: 0,
                producao_unidade: 'kg',
            };
            onDataChange([...data, newItem]);
        },
        [data, onDataChange]
    );

    const handleOpenAddDialog = useCallback(() => {
        setNewCultureName('');
        setIsAddDialogOpen(true);
    }, []);

    const handleCloseAddDialog = useCallback(() => {
        setIsAddDialogOpen(false);
    }, []);

    const handleConfirmAddCulture = useCallback(() => {
        const trimmedName = newCultureName.trim().toUpperCase();
        if (!trimmedName) return;

        const newItem: VegetalItem = {
            id: generateUniqueId(),
            produto: trimmedName,
            talhoes_canteiros: '',
            area_plantada: 0,
            area_plantada_unidade: 'ha',
            producao_esperada_ano: 0,
            producao_unidade: 'kg',
        };
        onDataChange([...data, newItem]);
        setExpandedGroup(trimmedName);
        setIsAddDialogOpen(false);
        setNewCultureName('');
    }, [newCultureName, data, onDataChange]);

    return {
        // State
        groupedData,
        expandedGroup,
        isAddDialogOpen,
        newCultureName,

        // Actions (Setters)
        setNewCultureName,

        // Handlers
        handleAccordionChange,
        handleItemChange,
        handleRemoveItem,
        handleAddLocalToGroup,
        handleOpenAddDialog,
        handleCloseAddDialog,
        handleConfirmAddCulture
    };
};
