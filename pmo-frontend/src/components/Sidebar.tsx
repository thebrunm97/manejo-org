// src/components/Sidebar.tsx

import React from 'react';
import {
  LayoutDashboard,
  Sprout,
  Map as MapIcon,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  Sparkles,
  User as UserIcon
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
      case SCREENS.ADMIN: return '/admin';
      default: return '';
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#111827] text-white overflow-hidden">
      {/* 1. Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 shrink-0">
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
      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                  "w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg mx-2 mb-1 transition-all relative max-w-[calc(100%-16px)] group",
                  active
                    ? "bg-[#16a34a] text-white shadow-lg shadow-green-900/40"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
                )}
              >
                <span className={cn("mr-3 transition-colors", active ? "text-white" : "text-gray-400 group-hover:text-white text-gray-500")}>
                  {item.icon}
                </span>
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Rodapé */}
      <div className="p-4 border-t border-gray-800 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-400 rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-colors group"
        >
          <LogOut size={20} className="mr-3 text-gray-500 group-hover:text-red-400" />
          Sair
        </button>

        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg flex items-center gap-3 border border-gray-800">
          <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-600/30 flex items-center justify-center text-green-500 font-bold text-xs shrink-0 overflow-hidden">
            {user?.email ? (
              user.email.charAt(0).toUpperCase()
            ) : (
              <UserIcon size={14} />
            )}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-gray-200 truncate">
              {user?.email?.split('@')[0] || 'Produtor'}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-tight">
              Plano Premium
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar - Offcanvas Pattern */}
      <div
        className={cn(
          "fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ease-in-out",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop overlay */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sidebar Panel */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[280px] bg-[#111827] shadow-2xl transition-transform duration-300 ease-in-out border-r border-gray-800",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden md:flex w-64 flex-col h-full bg-[#111827] border-r border-gray-800 text-white shrink-0 overflow-hidden">
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
