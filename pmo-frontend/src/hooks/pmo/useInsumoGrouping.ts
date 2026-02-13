import { useState, useMemo, useCallback } from 'react';
// import { PmoInsumoItem } from '../../domain/pmo/pmoTypes';

// Interface local se não existir global
export interface InsumoGroup {
    nome: string; // Produto ou Manejo
    items: any[];
}

export const useInsumoGrouping = (
    data: any[],
    onDataChange: (newData: any[]) => void
) => {
    const [expandedGroup, setExpandedGroup] = useState<string | false>(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    // Grouping Logic
    const groupedData = useMemo(() => {
        const groups: Record<string, InsumoGroup> = {};

        data.forEach(item => {
            const nomeKey = (item.produto_ou_manejo || 'Outros').toUpperCase().trim();
            if (!groups[nomeKey]) {
                groups[nomeKey] = {
                    nome: nomeKey,
                    items: []
                };
            }
            groups[nomeKey].items.push(item);
        });

        return Object.values(groups).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [data]);

    // Handlers
    const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpandedGroup(isExpanded ? panel : false);
    };

    const handleItemChange = (id: string | number, field: string, value: any) => {
        const newData = data.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        );
        onDataChange(newData);
    };

    const handleRemoveItem = (id: string | number) => {
        const newData = data.filter(item => item.id !== id);
        onDataChange(newData);
    };

    const handleAddLocalToGroup = (groupName: string) => {
        const newItem = {
            id: `new_${Date.now()}`,
            produto_ou_manejo: groupName,
            onde: '',
            quando: new Date().toISOString().split('T')[0],
            procedencia: 'Externa',
            composicao: 'Não informada',
            marca: 'Própria',
            dose_valor: '',
            dose_unidade: 'kg'
        };
        onDataChange([...data, newItem]);
        setExpandedGroup(groupName); // Ensure expanded
    };

    const handleConfirmAddItem = () => {
        if (!newItemName.trim()) return;
        const nameUpper = newItemName.toUpperCase().trim();

        handleAddLocalToGroup(nameUpper);
        setNewItemName('');
        setIsAddDialogOpen(false);
    };

    return {
        groupedData,
        expandedGroup,
        isAddDialogOpen,
        newItemName,
        setNewItemName,
        handleAccordionChange,
        handleItemChange,
        handleRemoveItem,
        handleAddLocalToGroup,
        setIsAddDialogOpen, // Direct setter exposed
        handleConfirmAddItem
    };
};
