// src/components/DashboardLayout.tsx

import React, { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';

interface DashboardLayoutProps {
    children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { user, logout } = useAuth();

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
            {/* Sidebar */}
            <Sidebar
                mobileOpen={mobileOpen}
                onClose={() => setMobileOpen(false)}
                user={user}
                logout={logout}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden relative bg-slate-100">
                <Navbar onMenuClick={handleDrawerToggle} />

                <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative p-4 md:p-6 scroll-smooth">
                    <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 box-border">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
