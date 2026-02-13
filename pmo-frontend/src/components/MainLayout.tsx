// src/components/MainLayout.tsx

import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, Typography, Button, Container, AppBar, Toolbar, useTheme } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';

interface MainLayoutProps {
    children: ReactNode;
    pageTitle?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, pageTitle }) => {
    const { logout } = useAuth();
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar
                position="static"
                elevation={0}
                sx={{
                    bgcolor: 'background.paper',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    color: 'text.primary'
                }}
            >
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
                        PMO Digital
                    </Typography>
                    <Button
                        color="inherit"
                        startIcon={<LogoutIcon />}
                        onClick={logout}
                        sx={{ fontWeight: 600 }}
                    >
                        Logout
                    </Button>
                </Toolbar>
            </AppBar>

            {/* Main Content */}
            <Container component="main" maxWidth="xl" sx={{ mt: 6, mb: 6, flexGrow: 1 }}>
                {children}
            </Container>
        </Box>
    );
};

export default MainLayout;
