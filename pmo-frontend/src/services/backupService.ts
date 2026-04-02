import { supabase } from '../supabaseClient';

/**
 * Interface representing the structure of the exported backup.
 */
export interface PropertyBackup {
  propriedade: string;
  data_exportacao: string;
  talhoes: any[];
  financeiro: any[];
  caderno_campo: any[];
}

/**
 * Fetches all property-related data and triggers a client-side JSON download.
 * @param propriedadeId ID of the property to export
 * @param nomePropriedade Name of the property for the filename
 */
export const exportarBackupPropriedade = async (propriedadeId: number, nomePropriedade: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`[BackupService] Iniciando exportação para propriedade ${propriedadeId} (${nomePropriedade})`);

    // 1. Fetch all data in parallel for efficiency
    const [talhoesRes, financeiroRes, cadernoRes] = await Promise.all([
      supabase
        .from('talhoes')
        .select('*')
        .eq('propriedade_id', propriedadeId),
      supabase
        .from('transacoes_financeiras')
        .select('*')
        .eq('propriedade_id', propriedadeId),
      supabase
        .from('caderno_campo')
        .select('*')
        .eq('propriedade_id', propriedadeId)
    ]);

    // Check for errors in any of the requests
    if (talhoesRes.error) throw talhoesRes.error;
    if (financeiroRes.error) throw financeiroRes.error;
    if (cadernoRes.error) throw cadernoRes.error;

    // 2. Aggregate data into the backup object
    const backupData: PropertyBackup = {
      propriedade: nomePropriedade,
      data_exportacao: new Date().toISOString(),
      talhoes: talhoesRes.data || [],
      financeiro: financeiroRes.data || [],
      caderno_campo: cadernoRes.data || []
    };

    // 3. Trigger Client-Side Download
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = nomePropriedade.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    link.href = url;
    link.download = `backup_${safeName}_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    
    // 4. Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error: any) {
    console.error('[BackupService] Erro ao exportar backup:', error);
    return { 
      success: false, 
      error: error.message || 'Erro ao gerar arquivo de backup.' 
    };
  }
};
