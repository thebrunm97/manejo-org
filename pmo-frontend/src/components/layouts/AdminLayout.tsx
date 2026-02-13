import React from 'react';
import { Box, Typography } from '@mui/material';
import DashboardLayout from '../DashboardLayout'; // Reuse existing layout structure or wrap it

interface AdminLayoutProps {
    children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    return (
        <DashboardLayout>
            <Box sx={{ borderBottom: 2, borderColor: 'primary.main', mb: 3, pb: 1 }}>
                <Typography variant="overline" color="primary" sx={{ fontWeight: 'bold' }}>
                    ADMINISTRAÇÃO
                </Typography>
            </Box>

            {children}
        </DashboardLayout>
    );
};

export default AdminLayout;
