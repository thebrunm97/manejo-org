export const soilLogic = {
    // Calcula Silte automaticamente (100 - Argila - Areia)
    calculateSilt(argila, areia) {
        const arg = parseFloat(argila) || 0;
        const ar = parseFloat(areia) || 0;
        // Garante que não fique negativo e tenha max 1 casa decimal
        return Math.max(0, parseFloat((100 - arg - ar).toFixed(1)));
    },

    // Classificação Textural baseada na % de Argila
    getClassificacaoTextural(argila) {
        const arg = parseFloat(argila) || 0;
        if (arg < 15) return 'Arenoso';
        if (arg >= 15 && arg < 35) return 'Médio';
        if (arg >= 35 && arg <= 60) return 'Argiloso';
        if (arg > 60) return 'Muito Argiloso';
        return 'Não Classificado';
    },

    // Metas por Cultura
    getCropTargets(cultura) {
        // Normaliza string para comparação
        const crop = (cultura || '').toLowerCase();

        if (crop.includes('soja')) return { v_ideal: 60, ph_ideal: 6.0, ph_min: 5.5, ph_max: 6.5 };
        if (crop.includes('milho')) return { v_ideal: 70, ph_ideal: 6.0, ph_min: 5.5, ph_max: 6.5 };
        if (crop.includes('café') || crop.includes('cafe')) return { v_ideal: 60, ph_ideal: 6.0, ph_min: 5.0, ph_max: 6.0 };
        if (crop.includes('feijão') || crop.includes('feijao')) return { v_ideal: 70, ph_ideal: 6.0, ph_min: 5.5, ph_max: 6.5 };

        // Default
        return { v_ideal: 60, ph_ideal: 6.0, ph_min: 5.5, ph_max: 6.5 };
    }
};
