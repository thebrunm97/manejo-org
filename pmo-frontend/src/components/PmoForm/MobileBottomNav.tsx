// src/components/PmoForm/MobileBottomNav.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, MoreVertical, Save, LayoutGrid, LayoutDashboard } from 'lucide-react';

interface MobileBottomNavProps {
    onNext: () => void;
    onPrev: () => void;
    onSaveDraft: () => void;
    onGoToSections: () => void;
    onGoToDashboard?: () => void;
    isNextDisabled?: boolean;
    isPrevDisabled?: boolean;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onNext,
    onPrev,
    onSaveDraft,
    onGoToSections,
    onGoToDashboard,
    isNextDisabled = false,
    isPrevDisabled = false,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const handleAction = (action: () => void) => {
        action();
        setMenuOpen(false);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-between px-3 py-2 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            {/* Left: Back + More */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onPrev}
                    disabled={isPrevDisabled}
                    title="Anterior"
                    className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ArrowLeft size={22} />
                </button>

                {/* More Options */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="mais opções"
                        className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <MoreVertical size={22} />
                    </button>

                    {/* Dropdown Menu */}
                    {menuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px] py-1 z-50">
                            {onGoToDashboard && (
                                <button
                                    onClick={() => handleAction(onGoToDashboard)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <LayoutDashboard size={18} className="text-gray-500" />
                                    Voltar ao Painel
                                </button>
                            )}
                            <button
                                onClick={() => handleAction(onGoToSections)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <LayoutGrid size={18} className="text-gray-500" />
                                Ver Seções
                            </button>
                            <button
                                onClick={() => handleAction(onSaveDraft)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Save size={18} className="text-gray-500" />
                                Salvar Rascunho
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Primary Action */}
            <button
                onClick={onNext}
                disabled={isNextDisabled}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Próximo
                <ArrowRight size={18} />
            </button>
        </nav>
    );
};

export default MobileBottomNav;
