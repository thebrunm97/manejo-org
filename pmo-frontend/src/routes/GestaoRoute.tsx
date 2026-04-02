import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Loader2 } from 'lucide-react';

export const GestaoRoute = () => {
    const { user, isLoading, isLoadingRole } = useAuth();

    // 1. Aguarda verificação de sessão
    if (isLoading || isLoadingRole) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500 animate-pulse">Verificando acesso...</p>
            </div>
        );
    }

    // 2. Se não estiver logado
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 3. Render Dashboard Layout (Injeta o Sidebar com contexto de cooperativa se necessário)
    return (
        <DashboardLayout>
            <Outlet />
        </DashboardLayout>
    );
};
