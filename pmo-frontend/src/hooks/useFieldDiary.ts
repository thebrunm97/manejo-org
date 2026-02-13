import { useState, useMemo, useEffect, useCallback } from 'react';
import { CadernoCampoRecord, ActivityType } from '../types/CadernoTypes';
import { cadernoService } from '../services/cadernoService';

export interface FieldDiaryFilters {
    dataInicio: string;
    dataFim: string;
    tipo_atividade: string;
    produto: string;
    local: string;
    incluirCancelados: boolean;
}

export interface UseFieldDiaryReturn {
    // Data
    logs: CadernoCampoRecord[];          // The slice of logs for the current page
    totalLogs: number;                   // Total count after filtering (for pagination)
    allLogs: CadernoCampoRecord[];       // All logs (mostly for export/debug if needed)

    // State
    loading: boolean;
    error: string | null;

    // Filters
    filters: FieldDiaryFilters;
    setFilters: (f: FieldDiaryFilters) => void;

    // Pagination
    page: number;
    rowsPerPage: number;
    setPage: (p: number) => void;
    setRowsPerPage: (r: number) => void;

    // Actions
    refresh: () => Promise<void>;
}

const INITIAL_FILTERS: FieldDiaryFilters = {
    dataInicio: '',
    dataFim: '',
    tipo_atividade: 'Todos',
    produto: '',
    local: '',
    incluirCancelados: false
};

export const useFieldDiary = (pmoId?: number): UseFieldDiaryReturn => {
    const [rawRegistros, setRawRegistros] = useState<CadernoCampoRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter State
    const [filters, setFilters] = useState<FieldDiaryFilters>(INITIAL_FILTERS);

    // Pagination State
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Fetch Data
    const fetchRegistros = useCallback(async () => {
        if (!pmoId) return;

        try {
            setLoading(true);
            setError(null);

            // Note: Currently fetching ALL records for client-side filtering.
            // In a future "Backend Refactor", this could accept filter params.
            const data = await cadernoService.getRegistros(pmoId);
            setRawRegistros(data || []);

        } catch (err: any) {
            console.error('Error fetching field diary:', err);
            setError(err.message || 'Erro ao carregar diário de campo.');
        } finally {
            setLoading(false);
        }
    }, [pmoId]);

    // Initial load
    useEffect(() => {
        fetchRegistros();
    }, [fetchRegistros]);

    // Apply Client-Side Filters
    const filteredRegistros = useMemo(() => {
        return rawRegistros.filter(reg => {
            // 1. Cancelled
            if (!filters.incluirCancelados && reg.tipo_atividade === ActivityType.CANCELADO) {
                return false;
            }

            // 2. Activity Type
            if (filters.tipo_atividade !== 'Todos' && reg.tipo_atividade !== filters.tipo_atividade) {
                return false;
            }

            // 3. Product (Case insensitive substring)
            if (filters.produto) {
                const prod = reg.produto?.toLowerCase() || '';
                if (!prod.includes(filters.produto.toLowerCase())) return false;
            }

            // 4. Location (Talhao/Canteiro substring)
            if (filters.local) {
                // Check legacy field
                const locLegacy = reg.talhao_canteiro?.toLowerCase() || '';

                // Check structured local in activities
                let locStructured = '';
                if (reg.atividades?.length) {
                    locStructured = reg.atividades.map(a =>
                        `${a.local?.talhao} ${a.local?.canteiro}`
                    ).join(' ').toLowerCase();
                }

                const search = filters.local.toLowerCase();
                if (!locLegacy.includes(search) && !locStructured.includes(search)) {
                    return false;
                }
            }

            // 5. Date Range
            if (filters.dataInicio) {
                const regYMD = new Date(reg.data_registro).toISOString().split('T')[0];
                if (regYMD < filters.dataInicio) return false;
            }
            if (filters.dataFim) {
                const regYMD = new Date(reg.data_registro).toISOString().split('T')[0];
                if (regYMD > filters.dataFim) return false;
            }

            return true;
        });
    }, [rawRegistros, filters]);

    // Apply Pagination
    const paginatedRegistros = useMemo(() => {
        const start = page * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredRegistros.slice(start, end);
    }, [filteredRegistros, page, rowsPerPage]);

    // Reset page to 0 when filters change
    useEffect(() => {
        setPage(0);
    }, [filters]);

    return {
        logs: paginatedRegistros,
        totalLogs: filteredRegistros.length,
        allLogs: rawRegistros,
        loading,
        error,
        filters,
        setFilters,
        page,
        rowsPerPage,
        setPage,
        setRowsPerPage,
        refresh: fetchRegistros
    };
};
