import React from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  useTheme,
  Drawer,
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
import { cn } from '../utils/cn';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  user: any;
  logout: () => void;
}

const Sidebar = ({ mobileOpen = false, onClose, user, logout }: SidebarProps) => {
  const theme = useTheme();
  const { navigateTo, goToLogin, currentPath } = useAppNavigation();
  const { isAdmin, isLoadingRole } = useAuth();

  const appName = import.meta.env.VITE_APP_NAME || 'Manejo Org';
  const appInitials = appName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const menuItems: { name: string; icon: any; path: RouteName }[] = [
    { name: 'Visão Geral', icon: <LayoutDashboard size={22} />, path: SCREENS.HOME },
    { name: 'Planos de Manejo', icon: <ClipboardList size={22} />, path: SCREENS.PMO_LIST },
    { name: 'Caderno de Campo', icon: <MenuIcon size={22} />, path: SCREENS.NOTEBOOK },
    { name: 'Mapa da Propriedade', icon: <MapIcon size={22} />, path: SCREENS.MAP },
    { name: 'Minhas Culturas', icon: <Sprout size={22} />, path: SCREENS.CROPS },
    { name: 'Novidades', icon: <Sparkles size={22} />, path: SCREENS.CHANGELOG },
  ];

  if (isAdmin || isLoadingRole) {
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

  // Helper to map screens to paths for highlighting
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#111827] text-white">
      {/* 1. Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-green-900/20">
            {appInitials}
          </div>
          <span className="font-bold text-lg tracking-wide text-white">
            {appName}
          </span>
        </div>
      </div>

      {/* 2. Menu */}
      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
        <div className="px-6 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          GESTÃO
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isHome = item.path === SCREENS.HOME;
            const targetPath = getPathForScreen(item.path);
            let active = false;

            if (isHome) {
              active = currentPath === '/dashboard' || currentPath === '/';
            } else {
              active = targetPath.length > 1 && currentPath.startsWith(targetPath);
            }

            return (
              <button
                key={item.name}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  "w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg mx-2 mb-1 transition-colors relative max-w-[calc(100%-16px)]",
                  active
                    ? "bg-[#16a34a] text-white shadow-lg shadow-green-900/20"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <span className={cn("mr-3", active ? "text-white" : "text-gray-400 group-hover:text-white")}>
                  {item.icon}
                </span>
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Rodapé */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-400 rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={20} className="mr-3" />
          Sair
        </button>

        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg flex items-center gap-3 border border-gray-800">
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#16a34a', fontSize: '0.8rem' }}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-gray-200 truncate">
              {user?.email?.split('@')[0]}
            </div>
            <div className="text-xs text-gray-500">
              Plano Premium
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer (MUI) */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 260,
            backgroundColor: '#111827',
            color: 'white',
            borderRight: '1px solid #1f2937'
          },
        }}
      >
        <SidebarContent />
      </Drawer>

      {/* Desktop Sidebar (Flex Item - Not Fixed) */}
      <aside className="hidden md:flex w-64 flex-col h-full bg-[#111827] border-r border-gray-800 text-white shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
