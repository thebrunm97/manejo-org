// src/services/whatsappService.ts
/**
 * WhatsApp integration service.
 * Handles code generation for account linking via WhatsApp bot.
 */

import { supabase } from '../supabaseClient';

/**
 * Generate and save a WhatsApp connection code for the user.
 *
 * O código é gerado dentro da RPC `generate_whatsapp_link_code` (nunca no
 * cliente) — expira em 10 minutos e é revogado no primeiro uso pelo bot
 * (DT-109). `update_profile` não grava esse campo por design: ele fica de
 * fora do whitelist da RPC genérica de propósito, para forçar a geração a
 * passar sempre por aqui.
 *
 * @returns The generated 6-character uppercase code
 * @throws Error if the database update fails
 */
export async function generateWhatsappCode(_userId: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_whatsapp_link_code');

    if (error || !data || data.length === 0) {
        console.error('[whatsappService] Error generating codigo_vinculo:', error);
        throw new Error('Não foi possível gerar o código. Tente novamente.');
    }

    return data[0].codigo;
}

/**
 * Get the WhatsApp bot number from environment.
 * Returns null if not configured.
 */
export function getWhatsappBotNumber(): string | null {
    return import.meta.env.VITE_WHATSAPP_BOT_NUMBER || '553497202727';
}

/**
 * Unlink WhatsApp from user account.
 * Clears both telefone and codigo_vinculo fields.
 * 
 * @param userId - The Supabase Auth user ID
 * @returns Object with success status
 * @throws Error if the database update fails
 */
export async function unlinkWhatsapp(_userId: string): Promise<{ success: boolean }> {
    const { error } = await supabase.rpc('update_profile', {
        p_updates: { telefone: null }
    });

    if (error) {
        console.error('[whatsappService] Error unlinking WhatsApp:', error);
        throw new Error('Não foi possível desconectar. Tente novamente.');
    }

    // codigo_vinculo fica fora do whitelist de update_profile de propósito
    // (DT-109) — revogado por uma RPC dedicada.
    const { error: revokeError } = await supabase.rpc('revoke_whatsapp_link_code');
    if (revokeError) {
        console.error('[whatsappService] Error revoking codigo_vinculo:', revokeError);
    }

    return { success: true };
}
