// src/components/MainLayout.tsx — Zero MUI
import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

interface MainLayoutProps {
    children: ReactNode;
    pageTitle?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, pageTitle }) => {
    const { logout } = useAuth();

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <nav className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
                    <h1 className="text-lg font-bold text-gray-900">PMO Digital</h1>
                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </nav>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
