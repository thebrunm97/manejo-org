// src/services/whatsappService.ts
/**
 * WhatsApp integration service.
 * Handles code generation for account linking via WhatsApp bot.
 */

import { supabase } from '../supabaseClient';

/**
 * Generate a random 6-character uppercase alphanumeric code.
 */
function generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Generate and save a WhatsApp connection code for the user.
 * 
 * @param userId - The Supabase Auth user ID
 * @returns The generated 6-character uppercase code
 * @throws Error if the database update fails
 */
export async function generateWhatsappCode(userId: string): Promise<string> {
    const code = generateRandomCode();

    const { error } = await supabase
        .from('profiles')
        .update({ codigo_vinculo: code })
        .eq('id', userId);

    if (error) {
        console.error('[whatsappService] Error saving codigo_vinculo:', error);
        throw new Error('Não foi possível gerar o código. Tente novamente.');
    }

    return code;
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
export async function unlinkWhatsapp(userId: string): Promise<{ success: boolean }> {
    const { error } = await supabase
        .from('profiles')
        .update({ telefone: null, codigo_vinculo: null })
        .eq('id', userId);

    if (error) {
        console.error('[whatsappService] Error unlinking WhatsApp:', error);
        throw new Error('Não foi possível desconectar. Tente novamente.');
    }

    return { success: true };
}
