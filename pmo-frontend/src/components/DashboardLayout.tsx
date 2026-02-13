// src/components/DashboardLayout.tsx

import React, { useState, ReactNode } from 'react';
import { Box, CssBaseline, IconButton, AppBar, Toolbar, Typography, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Sidebar from './Sidebar';

const drawerWidth = 260;

interface DashboardLayoutProps {
    children: ReactNode;
}

import { useAuth } from '../context/AuthContext';

// ...

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const theme = useTheme();
    const { user, logout } = useAuth(); // Call hook here (should work as RouteGuard works)

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <Box
            sx={{
                display: 'grid',
                height: '100vh',
                width: '100vw',
                overflow: 'hidden',
                gridTemplateColumns: { md: `${drawerWidth}px 1fr`, xs: '1fr' },
                gridTemplateRows: { md: '1fr', xs: 'auto 1fr' },
                bgcolor: 'background.default',
            }}
        >
            <CssBaseline />

            {/* APP BAR - Mobile Only */}
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    display: { md: 'none' },
                    gridRow: 1,
                    width: '100%',
                    bgcolor: 'background.paper',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    color: 'text.primary',
                    zIndex: (theme) => theme.zIndex.drawer + 1
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {import.meta.env.VITE_APP_NAME}
                    </Typography>
                </Toolbar>
            </AppBar>

            {/* Sidebar Area */}
            <Sidebar
                mobileOpen={mobileOpen}
                onClose={handleDrawerToggle}
                user={user}
                logout={logout}
            />

            {/* Main Content Area */}
            <Box
                component="main"
                sx={{
                    gridColumn: { md: 2, xs: 1 },
                    gridRow: { md: 1, xs: 2 },
                    height: '100%',
                    overflowY: 'auto',
                    padding: 6,
                    scrollBehavior: 'smooth',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Spacer for Mobile AppBar */}
                <Toolbar sx={{ display: { md: 'none' } }} />

                {/* Content Container */}
                <Box sx={{
                    maxWidth: '1600px',
                    width: '100%',
                    margin: '0 auto',
                    flexGrow: 1
                }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
};

export default DashboardLayout;
