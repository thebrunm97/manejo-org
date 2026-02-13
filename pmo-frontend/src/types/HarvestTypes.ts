import { Database } from './supabase';

export interface HarvestDashboardProps {
    pmoId: string | number;
    onDataUpdate?: (lastActivity: Date) => void;
}

// Extracted from Database definitions or defined manually if file reading fails
// Assuming standard Supabase generation structure
type CadernoCampoRow = Database['public']['Tables']['caderno_campo']['Row'];

export interface HarvestRecord extends CadernoCampoRow {
    // Enforce specific types for fields used in the dashboard to avoid 'any'
    // and handle potential nulls from the database
    id: string;
    pmo_id: number; // Corrected to match generated Database type (number)
    quantidade_valor: number | null;
    quantidade_unidade: string | null;
    produto: string | null;
    data_registro: string;
    tipo_atividade: string | null;
    talhao_canteiro: string | null;
    // Make detailed technical fields optional or flexible
    detalhes_tecnicos: any | null;
}

export interface ProductSummary {
    displayName: string;
    totals: Record<string, number>;  // { "kg": 150, "maço": 30 }
}

export interface SummaryData {
    [produtoKey: string]: ProductSummary;
}
