import { supabase } from '../supabaseClient';

export interface OnboardingData {
  userId: string;
  fullName: string;
  propName: string;
  areaHa: number;
  talhaoName: string;
}

export interface OnboardingResponse {
  success: boolean;
  propriedade_id?: number;
  talhao_id?: number;
  error?: string;
}

/**
 * Executes the atomic onboarding process via Supabase RPC.
 * Creates Profile (name), Property, and initial Talhão in one transaction.
 */
export async function executeOnboarding(data: OnboardingData): Promise<OnboardingResponse> {
  try {
    const { data: result, error } = await supabase.rpc('setup_initial_profile', {
      p_user_id: data.userId,
      p_nome: data.fullName,
      p_propriedade_nome: data.propName,
      p_area_ha: data.areaHa,
      p_talhao_nome: data.talhaoName
    });

    if (error) {
      console.error('[OnboardingService] RPC Error:', error);
      return { success: false, error: error.message };
    }

    return result as OnboardingResponse;
  } catch (err) {
    console.error('[OnboardingService] Unexpected Error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
