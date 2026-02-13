import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/layouts/AdminLayout';

export const AdminRoute = () => {
    const { isAdmin, isLoading } = useAuth();

    console.log('[AdminRoute] Check:', { isLoading, isAdmin });

    // 1. Wait for Auth Loading to finish (critical)
    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // 2. Only check permissions AFTER loading is false
    if (!isAdmin) {
        console.warn('[AdminRoute] Access Denied. Redirecting to home.');
        return <Navigate to="/" replace />;
    }

    // 3. Render Admin Layout
    return (
        <AdminLayout>
            <Outlet />
        </AdminLayout>
    );
};
