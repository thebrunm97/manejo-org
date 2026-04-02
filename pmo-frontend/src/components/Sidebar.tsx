// src/components/Sidebar.tsx

import { useState } from 'react';
import {
  LayoutDashboard,
  Sprout,
  Map as MapIcon,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  User as UserIcon,
  Database,
  Sparkles,
  Home,
  ArrowRightLeft,
  ChevronDown,
  CircleDollarSign,
  Building,
  HandHelping,
} from 'lucide-react';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { SCREENS, RouteName } from '../routes/routeNames';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import PropertySelectorModal from './Common/PropertySelectorModal';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  user: any;
  logout: () => void;
}

const Sidebar = ({ mobileOpen = false, onClose, user, logout }: SidebarProps) => {
  const { navigateTo, goToLogin, currentPath } = useAppNavigation();
  const { profile, isAdmin, isLoadingRole, currentPropriedade, allPropriedades } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const getDisplayName = () => {
    if (profile?.nome) {
      const parts = profile.nome.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
    return user?.email?.split('@')[0] || 'Produtor';
  };

  const displayName = getDisplayName();

  const hasPmoAtivo = !!profile?.pmo_ativo_id;
  const isConventionalOnly = currentPropriedade?.modalidade_predominante === 'CONVENCIONAL' && !currentPropriedade?.tem_producao_paralela;

  const shouldShowPmo = isAdmin || (hasPmoAtivo && !isConventionalOnly);
  const shouldShowMap = isAdmin || !isConventionalOnly;

  const appName = import.meta.env.VITE_APP_NAME || 'Manejo Org';
  const appInitials = appName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const allMenuItems: { name: string; icon: any; path: RouteName; pmoOnly?: boolean; mapOnly?: boolean }[] = [
    { name: 'Visão Geral', icon: <LayoutDashboard size={22} />, path: SCREENS.HOME },
    { name: 'Planos de Manejo', icon: <ClipboardList size={22} />, path: SCREENS.PMO_LIST, pmoOnly: true },
    { name: 'Caderno de Campo', icon: <MenuIcon size={22} />, path: SCREENS.NOTEBOOK },
    { name: 'Financeiro / DRE', icon: <CircleDollarSign size={22} />, path: SCREENS.FINANCEIRO },
    { name: 'Mapa da Propriedade', icon: <MapIcon size={22} />, path: SCREENS.MAP, mapOnly: true },
    { name: 'Minhas Culturas', icon: <Sprout size={22} />, path: SCREENS.CROPS },
    { name: 'Novidades', icon: <Sparkles size={22} />, path: SCREENS.CHANGELOG },
    { name: 'Dados da Propriedade', icon: <Home size={22} />, path: SCREENS.PROPERTY_PROFILE },
    { name: 'Meu Perfil', icon: <UserIcon size={22} />, path: SCREENS.PROFILE },
    { name: 'Mural de Demandas', icon: <HandHelping size={22} />, path: SCREENS.MURAL },
    { name: 'Painel Cooperativa', icon: <Building size={22} />, path: SCREENS.COOP_ORGANIZACOES },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (item.pmoOnly) return shouldShowPmo;
    if (item.mapOnly) return shouldShowMap;
    return true;
  });

  if (isAdmin || isLoadingRole) {
    menuItems.push({ name: 'Administração', icon: <LayoutDashboard size={22} />, path: SCREENS.ADMIN });
    menuItems.push({ name: 'Ingestão (RAG)', icon: <Database size={22} />, path: SCREENS.KNOWLEDGE_MONITORING });
  }

  const handleLogout = async () => {
    await logout();
    goToLogin();
  };

  const handleNavigate = (path: RouteName) => {
    navigateTo(path);
    if (onClose) onClose();
  };

  const getPathForScreen = (screen: RouteName) => {
    switch (screen) {
      case SCREENS.HOME: return '/dashboard';
      case SCREENS.PMO_LIST: return '/planos';
      case SCREENS.NOTEBOOK: return '/caderno';
      case SCREENS.MAP: return '/mapa';
      case SCREENS.CROPS: return '/culturas';
      case SCREENS.CHANGELOG: return '/changelog';
      case SCREENS.ADMIN: return '/admin';
      case SCREENS.KNOWLEDGE_MONITORING: return '/admin/conhecimento';
      case SCREENS.PROFILE: return '/perfil';
      case SCREENS.PROPERTY_PROFILE: return '/propriedade';
      case SCREENS.FINANCEIRO: return '/financeiro';
      case SCREENS.COOP_ORGANIZACOES: return '/coop/organizacoes';
      case SCREENS.MURAL: return '/mural';
      default: return '';
    }
  };

  const SidebarContent = ({ isDesktop = false }: { isDesktop?: boolean }) => (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* 1. Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-900/20">
            {appInitials}
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            {appName}
          </span>
        </div>
      </div>

      {/* 1b. Property Switcher (shown when user has properties) */}
      {currentPropriedade && (
        <div className="px-3 py-3 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setModalOpen(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
              "bg-slate-800/60 hover:bg-slate-700/80 transition-all group",
              allPropriedades.length <= 1 && "cursor-default hover:bg-slate-800/60"
            )}
            title={allPropriedades.length > 1 ? "Trocar fazenda" : currentPropriedade.nome}
            disabled={allPropriedades.length <= 1}
          >
            <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
              <Home size={14} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-white truncate leading-tight">{currentPropriedade.nome}</p>
              <p className="text-[10px] text-slate-400 font-medium leading-tight capitalize">
                {currentPropriedade.modalidade_predominante.toLowerCase()}
              </p>
            </div>
            {allPropriedades.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-700 rounded-md px-1.5 py-0.5">
                  {allPropriedades.length}
                </span>
                <ChevronDown size={13} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
              </div>
            )}
            {allPropriedades.length > 1 && (
              <ArrowRightLeft size={13} className="text-slate-500 group-hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 absolute" />
            )}
          </button>
        </div>
      )}

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
            } else if (targetPath === '/admin') {
              active = currentPath === '/admin';
            } else {
              active = targetPath.length > 1 && currentPath.startsWith(targetPath);
            }

            return (
              <button
                key={item.name}
                id={(isDesktop && item.path === SCREENS.MAP) ? "tour-sidebar-map" : undefined}
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
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : user?.email ? (
              user.email.charAt(0).toUpperCase()
            ) : (
              <UserIcon size={14} />
            )}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-gray-200 truncate">
              {displayName}
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
          "fixed inset-0 z-40 md:hidden transition-all duration-300 ease-in-out",
          mobileOpen ? "opacity-100 pointer-events-auto visible" : "opacity-0 pointer-events-none invisible"
        )}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className={cn(
          "absolute inset-y-0 left-0 w-[280px] bg-slate-900 shadow-soft transition-transform duration-300 ease-in-out border-r border-slate-800",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden md:flex w-64 flex-col h-full bg-slate-900 border-r border-slate-800 text-white shrink-0 overflow-hidden">
        <SidebarContent isDesktop />
      </aside>

      {/* Property Selector Modal */}
      <PropertySelectorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

export default Sidebar;
