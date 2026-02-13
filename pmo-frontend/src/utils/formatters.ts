/**
 * Formata um número de telefone/ID, ofuscando partes dele.
 * Ex: 553499991234 -> "WHATSAPP ID: ****-1234"
 */
export const formatarTelefone = (telefoneFull?: string): string => {
    if (!telefoneFull) return '';
    const numeroLimpo = telefoneFull.split('@')[0];
    if (numeroLimpo.length > 4) {
        const ultimosDigitos = numeroLimpo.slice(-4);
        return `WHATSAPP ID: ****-${ultimosDigitos}`;
    }
    return "Conta Vinculada";
};

/**
 * Formata uma data no padrão brasileiro, evitando o problema de timezone.
 * 
 * IMPORTANTE: Datas no formato YYYY-MM-DD são interpretadas como UTC meia-noite,
 * que no Brasil (-3h) vira 21h do dia anterior. Esta função corrige isso.
 * 
 * @param dateString - String de data (YYYY-MM-DD ou ISO)
 * @param options - Opções de formatação (default: dia, mês e ano)
 * @returns Data formatada em pt-BR
 */
export const formatDateBR = (
    dateString: string | null | undefined,
    options?: Intl.DateTimeFormatOptions
): string => {
    if (!dateString) return '-';

    try {
        let dateToFormat = dateString;

        // FIX: Se for apenas YYYY-MM-DD, adiciona T12:00 para evitar shift de timezone
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            dateToFormat = `${dateString}T12:00:00`;
        }

        return new Date(dateToFormat).toLocaleDateString('pt-BR', options ?? {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
};

/**
 * Retorna uma string relativa de tempo.
 * Ex: "5 min atrás", "2 dias atrás", "Agora mesmo".
 */
export const formatarDataRelativa = (date: Date | string | null): string => {
    if (!date) return 'Nenhuma atividade recente';
    const d = typeof date === 'string' ? new Date(date) : date;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHrs < 24) return `${diffHrs}h atrás`;
    return `${diffDays} dias atrás`;
};

/**
 * Retorna uma saudação baseada na hora do dia (opcional, mas boa prática).
 */
export const obterSaudacao = (): string => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Bom dia';
    if (hours < 18) return 'Boa tarde';
    return 'Boa noite';
};

/**
 * Groups items by unit and calculates totals with smart conversions.
 * 
 * Rules:
 * - Weight (kg, ton): Sum converted to kg. If total >= 1000 kg, display in ton (3 decimals). Else in kg.
 * - Area (m², ha): Sum converted to m². If total >= 10000 m², display in ha (2 decimals). Else in m².
 * - Others: Sum by unit key.
 */
export const formatSmartTotal = (items: any[], valueKey: string, unitKey: string): string => {
    if (!items || items.length === 0) return '-';

    let totalWeightKg = 0;
    let totalAreaM2 = 0;
    const discreteTotals: Record<string, { val: number; label: string }> = {};
    let hasWeight = false;
    let hasArea = false;

    items.forEach(item => {
        // Handle comma decimal separator just in case
        let rawVal = item[valueKey];
        if (typeof rawVal === 'string') {
            rawVal = rawVal.replace(',', '.');
        }
        const val = parseFloat(rawVal);

        if (isNaN(val) || val === 0) return;

        const unit = (item[unitKey] || '').toLowerCase().trim();

        // Weight Normalization
        if (['kg', 'kilo', 'kilograma', 'kilogramas'].includes(unit)) {
            hasWeight = true;
            totalWeightKg += val;
        } else if (['ton', 't', 'tonelada', 'toneladas', 'mg'].includes(unit)) {
            hasWeight = true;
            totalWeightKg += val * 1000;
        }

        // Area Normalization
        else if (['m²', 'm2', 'metro quadrado', 'metros quadrados'].includes(unit)) {
            hasArea = true;
            totalAreaM2 += val;
        } else if (['ha', 'hectare', 'hectares'].includes(unit)) {
            hasArea = true;
            totalAreaM2 += val * 10000;
        }

        // Discrete / Other Units
        else {
            const normUnit = unit || 'unid';
            if (!discreteTotals[normUnit]) {
                discreteTotals[normUnit] = { val: 0, label: item[unitKey] || unit };
            }
            discreteTotals[normUnit].val += val;
        }
    });

    const parts: string[] = [];

    // Format Weight
    if (hasWeight) {
        if (totalWeightKg >= 1000) {
            const tons = totalWeightKg / 1000;
            parts.push(`${tons.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ton`);
        } else if (totalWeightKg > 0) {
            parts.push(`${totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`);
        }
    }

    // Format Area
    if (hasArea) {
        if (totalAreaM2 >= 10000) {
            const ha = totalAreaM2 / 10000;
            parts.push(`${ha.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ha`);
        } else if (totalAreaM2 > 0) {
            parts.push(`${totalAreaM2.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²`);
        }
    }

    // Format Discrete
    Object.values(discreteTotals).forEach(({ val, label }) => {
        if (val > 0) {
            parts.push(`${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${label}`);
        }
    });

    return parts.join(' + ') || '-';
};
