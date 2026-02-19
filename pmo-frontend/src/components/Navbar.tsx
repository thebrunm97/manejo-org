import React from 'react';
import { IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import { cn } from '../utils/cn';

interface NavbarProps {
    onMenuClick: () => void;
    className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick, className }) => {
    const { logout } = useAuth();

    return (
        <header className={cn(
            "w-full h-16 flex-none flex items-center justify-between px-4 sm:px-6 bg-white border-b border-gray-200 shadow-sm md:hidden",
            className
        )}>
            <div className="flex items-center gap-3">
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={onMenuClick}
                    className="md:hidden text-slate-600 hover:bg-slate-100 rounded-md p-2"
                >
                    <MenuIcon />
                </IconButton>
                <div className="text-lg font-bold text-primary-main truncate md:hidden">
                    {import.meta.env.VITE_APP_NAME || 'Manejo Org'}
                </div>
                {/* Desktop Title / Breadcrumb Placeholder */}
                <div className="hidden md:block text-lg font-semibold text-text-primary">
                    Dashboard
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Add standard actions here later (Notifications, etc) */}
                <button
                    onClick={logout}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Sair"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    );
};

export default Navbar;
