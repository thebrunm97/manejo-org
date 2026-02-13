/**
 * Regras de validação de insumos para agricultura orgânica.
 * Baseado na Lei 10.831/2003 e IN 46/2011.
 * 
 * Este módulo fornece validação client-side para feedback imediato ao produtor.
 * O backend (Python) também valida, garantindo segurança em camadas.
 */

export interface OrganicRule {
    status: 'proibido' | 'atencao' | 'permitido';
    msg: string;
}

export const ORGANIC_INPUTS_RULES: Record<string, OrganicRule> = {
    // === PROIBIDOS (Sintéticos / Químicos) ===

    // Herbicidas
    "glifosato": { status: "proibido", msg: "⛔ PROIBIDO: Herbicida sintético (Lei 10.831)." },
    "glyphosate": { status: "proibido", msg: "⛔ PROIBIDO: Herbicida sintético." },
    "roundup": { status: "proibido", msg: "⛔ PROIBIDO: Marca comercial de Glifosato." },
    "2,4-d": { status: "proibido", msg: "⛔ PROIBIDO: Herbicida sintético." },
    "paraquat": { status: "proibido", msg: "⛔ PROIBIDO: Herbicida altamente tóxico." },
    "atrazina": { status: "proibido", msg: "⛔ PROIBIDO: Herbicida sintético." },

    // Fertilizantes Sintéticos
    "npk": { status: "proibido", msg: "⛔ PROIBIDO: Adubo sintético de alta solubilidade." },
    "ureia": { status: "proibido", msg: "⛔ PROIBIDO: Nitrogênio sintético." },
    "uréia": { status: "proibido", msg: "⛔ PROIBIDO: Nitrogênio sintético." },
    "sulfato de amônio": { status: "proibido", msg: "⛔ PROIBIDO: Nitrogênio sintético." },
    "nitrato de amônio": { status: "proibido", msg: "⛔ PROIBIDO: Fertilizante sintético." },
    "superfosfato": { status: "proibido", msg: "⛔ PROIBIDO: Fosfato de alta solubilidade." },

    // Inseticidas Sintéticos
    "carbofurano": { status: "proibido", msg: "⛔ PROIBIDO: Inseticida nematicida sintético." },
    "imidacloprid": { status: "proibido", msg: "⛔ PROIBIDO: Neonicotinóide (tóxico para abelhas)." },
    "fipronil": { status: "proibido", msg: "⛔ PROIBIDO: Inseticida sintético." },
    "lambda-cialotrina": { status: "proibido", msg: "⛔ PROIBIDO: Piretroide sintético." },
    "cipermetrina": { status: "proibido", msg: "⛔ PROIBIDO: Piretroide sintético." },

    // Fungicidas Sintéticos
    "mancozeb": { status: "proibido", msg: "⛔ PROIBIDO: Fungicida ditiocarbamato." },
    "tebuconazol": { status: "proibido", msg: "⛔ PROIBIDO: Fungicida triazol sintético." },
    "azoxistrobina": { status: "proibido", msg: "⛔ PROIBIDO: Fungicida estrobilurina." },

    // === ATENÇÃO (Permitidos com Restrições) ===

    "cobre": { status: "atencao", msg: "⚠️ ATENÇÃO: Limite de uso (Máx 6kg Cu/ha/ano - IN 46)." },
    "calda bordalesa": { status: "atencao", msg: "⚠️ ATENÇÃO: Monitorar acúmulo de Cobre no solo." },
    "sulfato de cobre": { status: "atencao", msg: "⚠️ ATENÇÃO: Limite de 6kg Cu/ha/ano." },
    "oxicloreto de cobre": { status: "atencao", msg: "⚠️ ATENÇÃO: Limite de 6kg Cu/ha/ano." },
    "enxofre": { status: "atencao", msg: "⚠️ ATENÇÃO: Permitido, mas evitar aplicação em clima quente." },
    "calda sulfocálcica": { status: "atencao", msg: "⚠️ ATENÇÃO: Permitida, observar dosagem e intervalo." },
    "óleo mineral": { status: "atencao", msg: "⚠️ ATENÇÃO: Uso restrito conforme IN 46." },
    "oleo mineral": { status: "atencao", msg: "⚠️ ATENÇÃO: Uso restrito conforme IN 46." },
};

/**
 * Verifica se um insumo é permitido na agricultura orgânica.
 * 
 * @param input - Nome do insumo a ser verificado
 * @returns OrganicRule se encontrar match, null se não encontrar (permitido por padrão)
 * 
 * @example
 * const result = checkOrganicInput("Roundup 500ml");
 * // { status: "proibido", msg: "⛔ PROIBIDO: Marca comercial de Glifosato." }
 */
export const checkOrganicInput = (input: string): OrganicRule | null => {
    if (!input || typeof input !== 'string') return null;

    const lowerInput = input.toLowerCase().trim();
    if (!lowerInput) return null;

    for (const [key, rule] of Object.entries(ORGANIC_INPUTS_RULES)) {
        if (lowerInput.includes(key)) {
            return rule;
        }
    }

    return null;
};

/**
 * Helper para verificar se um insumo é proibido.
 */
export const isProhibitedInput = (input: string): boolean => {
    const rule = checkOrganicInput(input);
    return rule?.status === 'proibido';
};

/**
 * Helper para verificar se um insumo requer atenção.
 */
export const requiresAttention = (input: string): boolean => {
    const rule = checkOrganicInput(input);
    return rule?.status === 'atencao';
};
