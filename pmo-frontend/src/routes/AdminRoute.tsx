import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/layouts/AdminLayout';

export const AdminRoute = () => {
    const { isAdmin, isLoading, isLoadingRole } = useAuth();

    console.log('[AdminRoute] Check:', { isLoading, isLoadingRole, isAdmin });

    // 1. Aguarda verificação de sessão
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // 2. Aguarda verificação de role (admin RPC)
    if (isLoadingRole) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // 3. Only check permissions AFTER both loadings are false
    if (!isAdmin) {
        console.warn('[AdminRoute] Access Denied. Redirecting to home.');
        return <Navigate to="/" replace />;
    }

    // 4. Render Admin Layout
    return (
        <AdminLayout>
            <Outlet />
        </AdminLayout>
    );
};
