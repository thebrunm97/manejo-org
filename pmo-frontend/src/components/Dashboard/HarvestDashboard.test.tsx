import { describe, it, expect } from 'vitest';
import { CadernoCampoRecord } from '../../types/CadernoTypes';
import { SummaryData } from '../../types/HarvestTypes';

// --- EXTRACTED FUNCTIONS FOR TESTING ---
// These replicate the logic from HarvestDashboard.tsx for unit testing

const formatTotalsForDisplay = (totals: Record<string, number>): string => {
    const parts: string[] = [];
    const weightUnits = ['kg', 'kilo', 'kilograma'];
    const tonUnits = ['ton', 't', 'tonelada'];
    let totalKg = 0;
    let hasWeight = false;

    Object.entries(totals).forEach(([unit, val]) => {
        const u = unit.toLowerCase();
        if (weightUnits.includes(u)) {
            totalKg += val;
            hasWeight = true;
        } else if (tonUnits.includes(u)) {
            totalKg += val * 1000;
            hasWeight = true;
        }
    });

    if (hasWeight && totalKg > 0) {
        if (totalKg >= 1000) {
            parts.push(`${(totalKg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ton`);
        } else {
            parts.push(`${totalKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`);
        }
    }

    Object.entries(totals).forEach(([unit, val]) => {
        const u = unit.toLowerCase();
        if (!weightUnits.includes(u) && !tonUnits.includes(u) && val > 0) {
            parts.push(`${val.toLocaleString('pt-BR')} ${unit}`);
        }
    });

    return parts.join(' + ') || '0';
};

const calcularResumo = (dados: Partial<CadernoCampoRecord>[]): SummaryData => {
    const harvestData = dados.filter(d => d.tipo_atividade === 'Colheita');

    const totalPorProduto = harvestData.reduce((acc: SummaryData, item) => {
        const prodKey = (item.produto || '').trim().toUpperCase() || 'NÃO IDENTIFICADO';
        const displayName = (item.produto || 'Não identificado').trim();
        const unidade = (item.quantidade_unidade || 'kg').toLowerCase().trim();
        const qtd = Number(item.quantidade_valor) || 0;

        if (!acc[prodKey]) {
            acc[prodKey] = {
                displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase(),
                totals: {}
            };
        }

        acc[prodKey].totals[unidade] = (acc[prodKey].totals[unidade] || 0) + qtd;

        return acc;
    }, {} as SummaryData);

    return totalPorProduto;
};

// --- TESTS ---

describe('calcularResumo', () => {
    it('normaliza produtos com trim e uppercase', () => {
        const dados = [
            { tipo_atividade: 'Colheita', produto: '  Alface Crespa  ', quantidade_valor: 10, quantidade_unidade: 'kg' },
            { tipo_atividade: 'Colheita', produto: 'alface crespa', quantidade_valor: 5, quantidade_unidade: 'kg' },
        ];
        const result = calcularResumo(dados);

        expect(Object.keys(result)).toHaveLength(1);
        expect(result['ALFACE CRESPA']).toBeDefined();
        expect(result['ALFACE CRESPA'].totals.kg).toBe(15);
    });

    it('agrupa por unidade diferente', () => {
        const dados = [
            { tipo_atividade: 'Colheita', produto: 'Alface', quantidade_valor: 10, quantidade_unidade: 'kg' },
            { tipo_atividade: 'Colheita', produto: 'Alface', quantidade_valor: 5, quantidade_unidade: 'maço' },
        ];
        const result = calcularResumo(dados);

        expect(result['ALFACE'].totals.kg).toBe(10);
        expect(result['ALFACE'].totals['maço']).toBe(5);
    });

    it('ignora atividades que não são Colheita', () => {
        const dados = [
            { tipo_atividade: 'Plantio', produto: 'Tomate', quantidade_valor: 100, quantidade_unidade: 'unid' },
            { tipo_atividade: 'Colheita', produto: 'Tomate', quantidade_valor: 50, quantidade_unidade: 'kg' },
        ];
        const result = calcularResumo(dados);

        expect(result['TOMATE'].totals.kg).toBe(50);
        expect(result['TOMATE'].totals.unid).toBeUndefined();
    });

    it('cria displayName com capitalização correta', () => {
        const dados = [
            { tipo_atividade: 'Colheita', produto: 'ALFACE CRESPA', quantidade_valor: 10, quantidade_unidade: 'kg' },
        ];
        const result = calcularResumo(dados);

        expect(result['ALFACE CRESPA'].displayName).toBe('Alface crespa');
    });

    it('usa NÃO IDENTIFICADO para produtos vazios', () => {
        const dados = [
            { tipo_atividade: 'Colheita', produto: '', quantidade_valor: 10, quantidade_unidade: 'kg' },
            { tipo_atividade: 'Colheita', produto: null, quantidade_valor: 5, quantidade_unidade: 'kg' },
        ];
        const result = calcularResumo(dados as any);

        expect(result['NÃO IDENTIFICADO']).toBeDefined();
        expect(result['NÃO IDENTIFICADO'].totals.kg).toBe(15);
    });

    it('usa kg como unidade padrão quando não especificada', () => {
        const dados = [
            { tipo_atividade: 'Colheita', produto: 'Cenoura', quantidade_valor: 20, quantidade_unidade: null },
        ];
        const result = calcularResumo(dados as any);

        expect(result['CENOURA'].totals.kg).toBe(20);
    });
});

describe('formatTotalsForDisplay', () => {
    it('formata kg simples', () => {
        const totals = { kg: 150 };
        expect(formatTotalsForDisplay(totals)).toBe('150 kg');
    });

    it('converte para toneladas quando >= 1000kg', () => {
        const totals = { kg: 1500 };
        const result = formatTotalsForDisplay(totals);
        expect(result).toContain('ton');
        expect(result).toContain('1,5');
    });

    it('soma múltiplas unidades de peso', () => {
        const totals = { kg: 500, ton: 1 };
        const result = formatTotalsForDisplay(totals);
        expect(result).toContain('1,5');
        expect(result).toContain('ton');
    });

    it('exibe unidades discretas separadamente', () => {
        const totals = { kg: 100, 'maço': 30 };
        const result = formatTotalsForDisplay(totals);
        expect(result).toContain('100 kg');
        expect(result).toContain('30 maço');
        expect(result).toContain('+');
    });

    it('retorna "0" para totais vazios', () => {
        expect(formatTotalsForDisplay({})).toBe('0');
    });

    it('exibe múltiplas unidades discretas', () => {
        const totals = { 'maço': 10, 'unid': 5, 'cx': 2 };
        const result = formatTotalsForDisplay(totals);
        expect(result).toContain('10 maço');
        expect(result).toContain('5 unid');
        expect(result).toContain('2 cx');
    });
});
