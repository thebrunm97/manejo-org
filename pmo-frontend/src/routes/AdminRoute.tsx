import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/layouts/AdminLayout';
import { Loader2 } from 'lucide-react';

export const AdminRoute = () => {
    const { user, isAdmin, isLoading, isLoadingRole } = useAuth();

    // 1. Aguarda verificação de sessão E perfil de administrador
    if (isLoading || isLoadingRole) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500 animate-pulse">Verificando permissões...</p>
            </div>
        );
    }

    // 2. Se não estiver logado
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 3. Verifica se é admin (após os loadings concluírem)
    if (!isAdmin) {
        console.warn('[AdminRoute] Access Denied. Redirecting to home.');
        return <Navigate to="/dashboard" replace />;
    }

    // 4. Render Admin Layout (RouteGuard handled by DashboardLayout already in AdminLayout, but we just Outlet here)
    return (
        <AdminLayout>
            <Outlet />
        </AdminLayout>
    );
};
