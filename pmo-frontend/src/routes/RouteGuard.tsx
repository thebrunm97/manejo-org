import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
    isPrivate?: boolean;
}

export function RouteGuard({ isPrivate = true }: RouteGuardProps) {
    const { user, isLoading, isLoadingProfile, currentPropriedade, allPropriedades } = useAuth();
    const location = useLocation();

    if (isLoading || (isPrivate && user && isLoadingProfile)) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500 animate-pulse">
                    {isLoading ? 'Autenticando sessão...' : 'Carregando perfil e propriedades...'}
                </p>
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
        // Onboarding redirect: when user is new and has no property created
        const shouldRedirectToOnboarding =
            !isLoadingProfile &&
            allPropriedades.length === 0 &&
            location.pathname !== '/onboarding';

        if (shouldRedirectToOnboarding) {
            return <Navigate to="/onboarding" replace />;
        }

        // Hub redirect: when user has multiple farms and no active property selected,
        // send them to /hub to choose — but don't redirect if they're already heading to /hub.
        const shouldRedirectToHub =
            !isLoadingProfile &&
            allPropriedades.length > 1 &&
            currentPropriedade === null &&
            location.pathname !== '/hub';

        if (shouldRedirectToHub) {
            return <Navigate to="/hub" replace />;
        }

        if (location.pathname === '/onboarding') {
            return <Outlet />;
        }

        return (
            <DashboardLayout>
                <Outlet />
            </DashboardLayout>
        );
    }

    return <Outlet />;
}
