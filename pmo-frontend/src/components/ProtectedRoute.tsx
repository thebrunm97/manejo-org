// src/components/ProtectedRoute.tsx

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { authToken, isLoading } = useAuth();
    const location = useLocation();

    // SECURITY: Show nothing while checking auth to prevent content flash
    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    backgroundColor: 'background.default',
                }}
            >
                <CircularProgress />
            </Box>
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
