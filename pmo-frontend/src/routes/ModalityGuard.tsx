// src/routes/ModalityGuard.tsx

import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

/**
 * ModalityGuard prevents Conventional-only properties from accessing Organic/PMO features.
 * Access is granted if:
 * 1. The property is ORGANICO or TRANSICAO
 * 2. OR the property is CONVENCIONAL but has production parallel enabled.
 */
export const ModalityGuard: React.FC = () => {
    const { currentPropriedade, isLoading, isLoadingRole, isAdmin, profile } = useAuth();

    useEffect(() => {
        if (!isLoading && !isLoadingRole && currentPropriedade && !isAdmin && profile?.role !== 'admin') {
            const isConventional = currentPropriedade.modalidade_predominante === 'CONVENCIONAL';
            const hasParallel = currentPropriedade.tem_producao_paralela === true;

            if (isConventional && !hasParallel) {
                toast.warning('Acesso restrito a áreas Orgânicas/Transição.', {
                    toastId: 'modality-blocked' // Prevent duplicates
                });
            }
        }
    }, [currentPropriedade, isLoading, isLoadingRole, isAdmin, profile]);

    if (isLoading || isLoadingRole) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Bypass for Admins
    if (isAdmin || profile?.role === 'admin') {
        return <Outlet />;
    }

    if (!currentPropriedade) {
        // Fallback safety if property data didn't load
        console.warn('[ModalityGuard] No active property found for user.');
        return <Navigate to="/dashboard" replace />;
    }

    const isConventional = currentPropriedade.modalidade_predominante === 'CONVENCIONAL';
    const hasParallel = currentPropriedade.tem_producao_paralela === true;

    // Block if Conventional-only
    if (isConventional && !hasParallel) {
        return <Navigate to="/dashboard" replace />;
    }


    return <Outlet />;
};
