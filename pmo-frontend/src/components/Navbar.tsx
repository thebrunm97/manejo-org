import React, { useState } from 'react';
import { Menu, LogOut, Home, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import PropertySelectorModal from './Common/PropertySelectorModal';

interface NavbarProps {
    onMenuClick: () => void;
    className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick, className }) => {
    const { logout, currentPropriedade, allPropriedades } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <header className={cn(
                "w-full h-16 flex-none flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200/60 shadow-soft md:hidden",
                className
            )}>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        aria-label="open drawer"
                        onClick={onMenuClick}
                        className="md:hidden text-slate-600 hover:bg-slate-100 rounded-md p-2"
                    >
                        <Menu size={24} />
                    </button>
                    <div className="text-lg font-black text-agro-floresta truncate md:hidden uppercase tracking-tight">
                        {(() => {
                            const name = import.meta.env.VITE_APP_NAME || 'ManejoOrg';
                            return name.toLowerCase().endsWith('org') ? (
                                <>
                                    {name.substring(0, name.length - 3)}
                                    <span className="text-agro-ouro">ORG</span>
                                </>
                            ) : name;
                        })()}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Mobile Property Switcher */}
                    {currentPropriedade && allPropriedades.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors max-w-[140px]"
                            title="Trocar fazenda"
                        >
                            <Home size={12} className="shrink-0" />
                            <span className="truncate">{currentPropriedade.nome}</span>
                            <ArrowRightLeft size={11} className="shrink-0 text-emerald-500" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={logout}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Sair"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <PropertySelectorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

export default Navbar;
