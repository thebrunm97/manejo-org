import { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, CoopDashboardStats, checkIfGestor } from '../../services/coopDashboardService';

export function useCoopDashboard(orgId: number | null) {
    const [stats, setStats] = useState<CoopDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGestor, setIsGestor] = useState<boolean | null>(null);

    const fetchStats = useCallback(async () => {
        if (!orgId) {
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            setError(null);
            
            // Verificamos permissão e logo após os dados
            const [gestorRes, statsRes] = await Promise.all([
                checkIfGestor(orgId),
                getDashboardStats(orgId)
            ]);

            setIsGestor(gestorRes);

            if (statsRes.success && statsRes.data) {
                setStats(statsRes.data);
            } else {
                setError(statsRes.error || 'Erro desconhecido ao buscar dados da cooperativa');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        if (orgId) {
            fetchStats();
        }
    }, [orgId, fetchStats]);

    return { 
        stats, 
        loading, 
        error, 
        isGestor,
        refresh: fetchStats 
    };
}
