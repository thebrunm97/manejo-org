// src/components/ProtectedRoute.tsx

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { authToken, isLoading } = useAuth();
    const location = useLocation();

    // SECURITY: Show nothing while checking auth to prevent content flash
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // SECURITY: Immediate redirect if no token - no content rendered
    if (!authToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Token exists and is valid - render protected content
    return <>{children}</>;
};

export default ProtectedRoute;
