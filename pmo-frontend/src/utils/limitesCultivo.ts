/**
 * @file limitesCultivo.ts
 * @description Centralizes the business logic for plan-based limits (Seed Plan vs. Cooperative).
 */

import { UserProfile } from '../domain/pmo/pmoTypes';

export const LIMITE_SEMENTE_PROPRIEDADES = 1;
export const LIMITE_SEMENTE_TALHOES = 2;

/**
 * Checks if the user is in the "Plano Semente" (Seed Plan).
 * By default, users are in the Seed Plan unless they are admins or assigned to a coop.
 * 
 * @param profile User profile from AuthContext
 * @returns boolean
 */
export const isPlanoSemente = (profile: UserProfile | null): boolean => {
    if (!profile) return true;
    
    // Admins have no limits
    if (profile.role === 'admin') return false;
    
    // Users in a plan tier other than 'semente' or 'free' are not in Seed Plan
    if (profile.plan_tier && !['semente', 'free'].includes(profile.plan_tier.toLowerCase())) {
        return false;
    }

    // Default to Seed Plan
    return true;
};

/**
 * Checks if the user can create a new property.
 */
export const podeCriarPropriedade = (
    profile: UserProfile | null, 
    propriedadesAtuais: number
): { can: boolean; message?: string } => {
    if (!isPlanoSemente(profile)) return { can: true };

    if (propriedadesAtuais >= LIMITE_SEMENTE_PROPRIEDADES) {
        return {
            can: false,
            message: "🌱 Você atingiu o limite do Plano Semente (1 Fazenda). Para gerenciar múltiplas propriedades, expanda seu cultivo tornando-se um Cooperado."
        };
    }

    return { can: true };
};

/**
 * Checks if a property can have more talhões.
 */
export const podeCriarTalhao = (
    profile: UserProfile | null,
    talhoesAtuais: number
): { can: boolean; message?: string } => {
    if (!isPlanoSemente(profile)) return { can: true };

    if (talhoesAtuais >= LIMITE_SEMENTE_TALHOES) {
        return {
            can: false,
            message: "🌱 Sua propriedade atingiu o limite de 2 talhões do Plano Semente. Junte-se à Cooperativa para mapear áreas ilimitadas!"
        };
    }

    return { can: true };
};
