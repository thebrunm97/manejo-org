import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import {
  LayoutDashboard,
  Sprout,
  Map as MapIcon,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  Sparkles
} from 'lucide-react';


import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { SCREENS, RouteName } from '../routes/routeNames';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 260; // Largura do menu

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  user: any;
  logout: () => void;
}

const Sidebar = ({ mobileOpen = false, onClose, user, logout }: SidebarProps) => {
  const theme = useTheme();
  const { navigateTo, goToLogin, currentPath } = useAppNavigation();
  // Auth from props now

  // Dynamic app branding
  const appName = import.meta.env.VITE_APP_NAME || 'Manejo Org';
  const appInitials = appName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const { isAdmin } = useAuth();

  const menuItems: { name: string; icon: any; path: RouteName }[] = [
    { name: 'Visão Geral', icon: <LayoutDashboard size={22} />, path: SCREENS.HOME },
    { name: 'Planos de Manejo', icon: <ClipboardList size={22} />, path: SCREENS.PMO_LIST },
    { name: 'Caderno de Campo', icon: <MenuIcon size={22} />, path: SCREENS.NOTEBOOK },
    { name: 'Mapa da Propriedade', icon: <MapIcon size={22} />, path: SCREENS.MAP },
    { name: 'Minhas Culturas', icon: <Sprout size={22} />, path: SCREENS.CROPS },
    { name: 'Novidades', icon: <Sparkles size={22} />, path: SCREENS.CHANGELOG },
  ];


  // Add Admin Item if user is admin
  if (isAdmin) {
    menuItems.push({
      name: 'Administração',
      icon: <LayoutDashboard size={22} />,
      path: SCREENS.ADMIN
    });
  }

  const handleLogout = async () => {
    await logout();
    goToLogin();
  };

  const handleNavigate = (path: RouteName) => {
    navigateTo(path);
    if (onClose) onClose();
  };

  // Styles based on Theme
  // Using Slate-900 (text.primary) for Sidebar background to keep it dark
  const sidebarBg = theme.palette.text.primary;
  const sidebarText = theme.palette.common.white;
  const sidebarMuted = alpha(theme.palette.common.white, 0.6);
  const activeBg = alpha(theme.palette.primary.main, 0.16);
  const activeColor = theme.palette.common.white; // or primary.light
  const activeBorder = theme.palette.primary.main;
  const borderColor = alpha(theme.palette.common.white, 0.1);

  // Helper to check if item is active (simple check, can be improved for nested routes)
  // useAppNavigation converts SCREENS to paths, but currentPath is a string path.
  // Ideally, useAppNavigation could expose a 'currentScreen', but for now we can infer or simpler: 
  // Map back or just check if the path (derived from SCRRENS) matches currentPath.
  // Actually, let's keep it simple: we know the paths from previous knowledge or import them?
  // Since we don't have the path map exposed, let's trust useAppNavigation returns the same location hooks.
  // Wait, I removed ROUTE_PATHS export. I should probably match by path string for highlighting.
  // BUT, useAppNavigation gives me `currentPath`.
  // Let's assume exact match for now or just check if it includes.
  // For 'HOME' it's '/', which matches everything if using 'startsWith'.

  // To avoid complexity, I will just replicate the logic slightly or check if the hook can help.
  // The user asked to "use MapsTo(SCREENS) in links".

  // WORKAROUND for highlighting:
  // We can't easily map 'currentPath' back to SCREEN without the map.
  // However, `menuItems` now uses SCREENS.
  // `handleNavigate` uses `navigateTo(SCREEN)`.
  // To verify `active`, we might need to know the path string for that SCREEN.
  // Let's temporarily map them here or use a helper?
  // Actually, simpler: define the paths map here locally for UI highlighting if needed, OR import ROUTE_PATHS if I exported it.
  // I didn't export ROUTE_PATHS in useAppNavigation.ts.

  // Let's rely on checking if the user is on the page by simple string check for now, 
  // OR export ROUTE_PATHS from useAppNavigation in a future step.
  // For now I will manually map for the highlighting logic to keep it working:

  const getPathForScreen = (screen: RouteName) => {
    switch (screen) {
      case SCREENS.HOME: return '/dashboard';
      case SCREENS.PMO_LIST: return '/planos';
      case SCREENS.NOTEBOOK: return '/caderno';
      case SCREENS.MAP: return '/mapa';
      case SCREENS.CROPS: return '/culturas';
      case SCREENS.CHANGELOG: return '/changelog';
      default: return '';
    }

  };

  const drawerContent = (
    <>
      {/* 1. Logo */}
      <Box sx={{
        p: 6, // 24px
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        borderBottom: `1px solid ${borderColor}`
      }}>
        <Box sx={{
          width: 35,
          height: 35,
          bgcolor: 'primary.main',
          borderRadius: 2, // 8px (md) since radius scale is xs:4, sm:6, md:8
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.contrastText',
          fontWeight: 'bold',
          boxShadow: `0 0 15px ${alpha(theme.palette.primary.main, 0.4)}`
        }}>
          {appInitials}
        </Box>
        <Typography variant="h6" sx={{ color: sidebarText, fontWeight: 700, letterSpacing: '-0.5px' }}>
          {appName}
        </Typography>
      </Box>

      {/* 2. Menu */}
      <Box sx={{
        overflowY: 'auto',
        mt: 4,
        flexGrow: 1,
        scrollbarWidth: 'none',  // Firefox
        '&::-webkit-scrollbar': { display: 'none' } // Chrome/Safari
      }}>
        <Typography variant="caption" sx={{ ml: 6, mb: 2, display: 'block', fontWeight: 600, color: sidebarMuted }}>
          GESTÃO
        </Typography>
        <List>
          {(menuItems || []).map((item) => {
            // Architect Request: Simple and robust selection logic
            const isHome = item.path === SCREENS.HOME;
            // "Visão Geral" selects on /dashboard OR / (root)
            // Admin selects on startsWith /admin (handled below separately or generic here)
            // Others select on startsWith

            const targetPath = getPathForScreen(item.path);

            let active = false;

            if (isHome) {
              active = currentPath === '/dashboard' || currentPath === '/';
            } else {
              // Ensure targetPath is valid string
              active = targetPath.length > 1 && currentPath.startsWith(targetPath);
            }

            return (
              <ListItem key={item.name} disablePadding sx={{ mb: 1, px: 3 }}>
                <ListItemButton
                  onClick={() => handleNavigate(item.path)}
                  sx={{
                    borderRadius: 1, // Uses shape.borderRadius (default 6px/sm)
                    mb: 1,
                    borderLeft: active ? `3px solid ${theme.palette.primary.light}` : '3px solid transparent',
                    bgcolor: active ? activeBg : 'transparent',
                    color: active ? activeColor : sidebarMuted,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.common.white, 0.05),
                      color: sidebarText
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: active ? theme.palette.primary.light : 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: active ? 600 : 400,
                      color: 'inherit'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* 3. Rodapé */}
      <Box sx={{ p: 4, borderTop: `1px solid ${borderColor}` }}>
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 1,
                color: sidebarMuted,
                '&:hover': {
                  color: theme.palette.error.main,
                  bgcolor: alpha(theme.palette.error.main, 0.1)
                },
                transition: 'all 0.2s'
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}><LogOut size={20} /></ListItemIcon>
              <ListItemText primary="Sair" primaryTypographyProps={{ fontSize: '0.9rem' }} />
            </ListItemButton>
          </ListItem>
        </List>

        <Box sx={{ mt: 4, p: 3, bgcolor: alpha(theme.palette.common.white, 0.03), borderRadius: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem', color: 'primary.contrastText' }}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ color: sidebarText, lineHeight: 1.2 }}>
              {user?.email?.split('@')[0]}
            </Typography>
            <Typography variant="caption" sx={{ color: sidebarMuted }}>
              Plano Premium
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
    >
      {/* MOBILE DRAWER */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            backgroundColor: sidebarBg,
            color: sidebarText,
            borderRight: `1px solid ${theme.palette.divider}`
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* DESKTOP DRAWER */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            backgroundColor: sidebarBg,
            color: sidebarText,
            borderRight: 'none' // Grid handles separation or main container
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;