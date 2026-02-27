import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
    isPrivate?: boolean;
}

export function RouteGuard({ isPrivate = true }: RouteGuardProps) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500 animate-pulse">Autenticando sessão...</p>
            </div>
        );
    }

    if (isPrivate && !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isPrivate && user) {
        return <Navigate to="/dashboard" replace />;
    }

    if (isPrivate) {
        return (
            <DashboardLayout>
                <Outlet />
            </DashboardLayout>
        );
    }

    return <Outlet />;
}
