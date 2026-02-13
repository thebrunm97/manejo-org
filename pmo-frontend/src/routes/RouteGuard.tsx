import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';

interface RouteGuardProps {
    isPrivate?: boolean;
}

export function RouteGuard({ isPrivate = true }: RouteGuardProps) {
    const { user, isLoading } = useAuth();

    if (isLoading) return <div>Carregando...</div>;

    if (isPrivate && !user) return <Navigate to="/login" replace />;
    if (!isPrivate && user) return <Navigate to="/dashboard" replace />;

    if (isPrivate) {
        return (
            <DashboardLayout>
                <Outlet />
            </DashboardLayout>
        );
    }

    return <Outlet />;
}
