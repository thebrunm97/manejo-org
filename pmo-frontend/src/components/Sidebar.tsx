// src/components/Sidebar.tsx

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Sprout,
  Map as MapIcon,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  User as UserIcon,
  Sparkles,
  Home,
  ChevronDown,
  CircleDollarSign,
  Building,
  HandHelping,
  MessageSquare,
} from 'lucide-react';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { SCREENS, RouteName } from '../routes/routeNames';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import PropertySelectorModal from './Common/PropertySelectorModal';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

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
  const { t } = useTranslation('common');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

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
    { name: t('nav.dashboard'), icon: <LayoutDashboard size={22} />, path: SCREENS.HOME },
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
    menuItems.push({ name: 'Monitor ao Vivo', icon: <MessageSquare size={22} />, path: SCREENS.LIVE_CHAT_MONITOR });
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
      case SCREENS.LIVE_CHAT_MONITOR: return '/admin/chat';
      case SCREENS.PROFILE: return '/perfil';
      case SCREENS.PROPERTY_PROFILE: return '/propriedade';
      case SCREENS.FINANCEIRO: return '/financeiro';
      case SCREENS.COOP_ORGANIZACOES: return '/coop/organizacoes';
      case SCREENS.MURAL: return '/mural';
      default: return '';
    }
  };

  const SidebarContent = ({ isDesktop = false }: { isDesktop?: boolean }) => (
    <div className="flex flex-col h-full bg-agro-floresta text-agro-creme overflow-hidden">
      {/* 1. Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-agro-ouro rounded-lg flex items-center justify-center text-agro-floresta font-black shadow-lg shadow-agro-ouro/20">
            {appInitials}
          </div>
          <span className="font-black text-lg tracking-tight text-agro-creme uppercase">
            {appName.toLowerCase().endsWith('org') ? (
              <>
                {appName.substring(0, appName.length - 3)}
                <span className="text-agro-ouro group-hover:drop-shadow-[0_0_8px_rgba(197,160,89,0.4)] transition-all">ORG</span>
              </>
            ) : (
              appName
            )}
          </span>
        </div>
      </div>

      {/* 1b. Property Switcher (shown when user has properties) */}
      {currentPropriedade && (
        <div className="px-3 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={() => setModalOpen(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/5",
              "bg-white/5 hover:bg-white/10 transition-all group",
              allPropriedades.length <= 1 && "cursor-default hover:bg-white/5"
            )}
            title={allPropriedades.length > 1 ? "Trocar fazenda" : currentPropriedade.nome}
            disabled={allPropriedades.length <= 1}
          >
            <div className="w-7 h-7 bg-agro-ouro/20 rounded-lg flex items-center justify-center shrink-0">
              <Home size={14} className="text-agro-ouro" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-black text-agro-creme truncate leading-tight uppercase tracking-wide">{currentPropriedade.nome}</p>
              <p className="text-[10px] text-agro-creme/80 font-bold leading-tight capitalize">
                {(currentPropriedade?.modalidade_predominante?.toLowerCase() ?? 'orgânico')}
              </p>
            </div>
            {allPropriedades.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-bold text-agro-creme/60 bg-white/5 rounded-md px-1.5 py-0.5 border border-white/5">
                  {allPropriedades.length}
                </span>
                <ChevronDown size={13} className="text-agro-creme/60 group-hover:text-agro-ouro transition-colors" />
              </div>
            )}
          </button>
        </div>
      )}

      {/* 2. Menu */}
      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="px-6 mb-2 text-[10px] font-black text-agro-creme/40 uppercase tracking-[0.2em]">
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
                  "w-full flex items-center px-4 py-3 text-[13px] font-bold rounded-[0.9rem] mx-2 mb-1 transition-all relative max-w-[calc(100%-16px)] group",
                  active
                    ? "bg-agro-ouro text-agro-floresta shadow-lg shadow-agro-ouro/10"
                    : "text-agro-creme/85 hover:bg-white/5 hover:text-agro-creme"
                )}
              >
                <span className={cn("mr-3 transition-colors", active ? "text-agro-floresta" : "text-agro-creme/60 group-hover:text-agro-creme")}>
                  {item.icon}
                </span>
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Rodapé */}
      <div className="p-4 border-t border-white/5 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2.5 text-sm font-bold text-agro-creme/60 rounded-xl hover:text-rose-400 hover:bg-rose-500/10 transition-colors group"
        >
          <LogOut size={20} className="mr-3 text-agro-creme/50 group-hover:text-rose-400" />
          {t('nav.logout')}
        </button>

        <div className="mt-4 px-2">
            <LanguageSwitcher />
        </div>

        <div className="mt-4 p-3 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-agro-ouro/20 border border-agro-ouro/30 flex items-center justify-center text-agro-ouro font-black text-xs shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : user?.email ? (
              user.email.charAt(0).toUpperCase()
            ) : (
              <UserIcon size={14} />
            )}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-black text-agro-creme truncate uppercase tracking-wide">
              {displayName}
            </div>
            <div className="text-[10px] text-agro-creme/50 font-black uppercase tracking-widest">
              {profile?.plan_tier ? `Plano ${profile.plan_tier.toLowerCase() === 'premium' ? 'Pro' : profile.plan_tier.charAt(0).toUpperCase() + profile.plan_tier.slice(1).toLowerCase()}` : 'Plano Pro'}
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
          "absolute inset-y-0 left-0 w-[280px] bg-agro-floresta shadow-soft transition-transform duration-300 ease-in-out border-r border-white/5",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden md:flex w-64 flex-col h-full bg-agro-floresta border-r border-white/5 text-agro-creme shrink-0 overflow-hidden">
        <SidebarContent isDesktop />
      </aside>

      {/* Property Selector Modal */}
      <PropertySelectorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

export default Sidebar;
