/**
 * @file usePlanosListLogic.ts
 * @description Hook para gerenciar a lógica da listagem de PMOs.
 * 
 * ⚠️ REGRA ARQUITETURAL: Este arquivo NÃO deve conter:
 *    - JSX
 *    - Imports de @mui/*
 *    - window.confirm ou outros elementos de UI
 * 
 * Isso garante reutilização em React Native.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// Domain Types
import type { PmoListItem, UserProfile } from '../../domain/pmo/pmoTypes';

// Service Functions
import {
    fetchAllPmos,
    deletePmo,
    fetchUserProfile,
    setActivePmo
} from '../../services/pmoService';

// ==================================================================
// ||                         TYPES                                ||
// ==================================================================

export interface UsePlanosListLogicOptions {
    /** Se deve carregar automaticamente ao montar */
    autoLoad?: boolean; // default: true
}

export interface UsePlanosListLogicReturn {
    // ─────────────────────────────────────────────────────────────
    // STATE - List Data
    // ─────────────────────────────────────────────────────────────
    pmos: PmoListItem[];
    userProfile: UserProfile | null;

    /** ID do PMO ativo (atalho para userProfile.pmo_ativo_id) */
    activePmoId: string | null;

    // ─────────────────────────────────────────────────────────────
    // STATE - Granular Loading (para UX otimizada)
    // ─────────────────────────────────────────────────────────────

    /** true durante o carregamento inicial da lista */
    listLoading: boolean;

    /** ID do PMO sendo ativado (null se nenhum) */
    activatingId: string | null;

    /** ID do PMO sendo deletado (null se nenhum) */
    deletingId: string | null;

    // ─────────────────────────────────────────────────────────────
    // STATE - Errors
    // ─────────────────────────────────────────────────────────────
    error: string | null;

    // ─────────────────────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────────────────────

    /** Recarrega a lista de PMOs */
    refreshList: () => Promise<void>;

    /** 
     * Ativa um PMO para o usuário.
     * @returns true se sucesso, false se erro
     */
    handleActivatePmo: (pmoId: string) => Promise<boolean>;

    /**
     * Exclui um PMO.
     * ⚠️ A View DEVE mostrar confirmação antes de chamar.
     * @returns true se sucesso, false se erro
     */
    handleDeletePmo: (pmoId: string) => Promise<boolean>;

    /** Limpa erro */
    clearError: () => void;
}

// ==================================================================
// ||                       MAIN HOOK                              ||
// ==================================================================

export function usePlanosListLogic(
    options: UsePlanosListLogicOptions = {}
): UsePlanosListLogicReturn {
    const { autoLoad = true } = options;
    const { user } = useAuth();

    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────
    const [pmos, setPmos] = useState<PmoListItem[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Granular loading states
    const [listLoading, setListLoading] = useState(true);
    const [activatingId, setActivatingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────────
    // DERIVED VALUES
    // ─────────────────────────────────────────────────────────────
    const activePmoId = userProfile?.pmo_ativo_id ?? null;

    // ─────────────────────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────────────────────

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    /**
     * Carrega a lista de PMOs e o perfil do usuário.
     */
    const refreshList = useCallback(async () => {
        setListLoading(true);
        setError(null);

        try {
            // Fetch PMO list
            // Passamos user?.id para garantir que, mesmo sendo admin, busque apenas OS SEUS planos nesta tela
            const pmosResult = await fetchAllPmos(user?.id);
            if (!pmosResult.success) {
                throw new Error(pmosResult.error || 'Erro ao carregar planos');
            }
            setPmos(pmosResult.data || []);

            // Fetch user profile for active PMO
            if (user?.id) {
                const profileResult = await fetchUserProfile(user.id);
                if (profileResult.success && profileResult.data) {
                    setUserProfile(profileResult.data);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
            setError(message);
            console.error('[usePlanosListLogic] refreshList error:', err);
        } finally {
            setListLoading(false);
        }
    }, [user?.id]);

    /**
     * Ativa um PMO para o usuário.
     */
    const handleActivatePmo = useCallback(async (pmoId: string): Promise<boolean> => {
        if (!user?.id) {
            setError('Usuário não autenticado');
            return false;
        }

        // Já está ativo?
        if (activePmoId === pmoId) {
            return true;
        }

        setActivatingId(pmoId);
        setError(null);

        try {
            const result = await setActivePmo(user.id, pmoId);

            if (!result.success) {
                throw new Error(result.error || 'Erro ao ativar plano');
            }

            // Update local state (optimistic)
            setUserProfile(prev => prev
                ? { ...prev, pmo_ativo_id: pmoId }
                : { id: user.id, pmo_ativo_id: pmoId }
            );

            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao ativar plano';
            setError(message);
            console.error('[usePlanosListLogic] handleActivatePmo error:', err);
            return false;
        } finally {
            setActivatingId(null);
        }
    }, [user?.id, activePmoId]);

    /**
     * Exclui um PMO.
     * ⚠️ Confirmação visual deve ser feita pela View antes de chamar.
     */
    const handleDeletePmo = useCallback(async (pmoId: string): Promise<boolean> => {
        setDeletingId(pmoId);
        setError(null);

        try {
            const result = await deletePmo(pmoId);

            if (!result.success) {
                throw new Error(result.error || 'Erro ao excluir plano');
            }

            // Remove from local state (optimistic update)
            setPmos(prev => prev.filter(p => p.id !== pmoId));

            // If deleted PMO was active, clear it
            if (activePmoId === pmoId) {
                setUserProfile(prev => prev
                    ? { ...prev, pmo_ativo_id: null }
                    : null
                );
            }

            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao excluir plano';
            setError(message);
            console.error('[usePlanosListLogic] handleDeletePmo error:', err);
            return false;
        } finally {
            setDeletingId(null);
        }
    }, [activePmoId]);

    // ─────────────────────────────────────────────────────────────
    // EFFECTS
    // ─────────────────────────────────────────────────────────────

    // Initial load
    useEffect(() => {
        if (autoLoad) {
            refreshList();
        }
    }, [autoLoad, refreshList]);

    // ─────────────────────────────────────────────────────────────
    // RETURN
    // ─────────────────────────────────────────────────────────────
    return {
        // State - Data
        pmos,
        userProfile,
        activePmoId,

        // State - Loading (granular)
        listLoading,
        activatingId,
        deletingId,

        // State - Errors
        error,

        // Actions
        refreshList,
        handleActivatePmo,
        handleDeletePmo,
        clearError
    };
}

export default usePlanosListLogic;
