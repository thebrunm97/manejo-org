// src/components/DashboardLayout.tsx

import React, { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';

interface DashboardLayoutProps {
    children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { user, logout } = useAuth();
    const location = useLocation();

    const isMapView = location.pathname === '/mapa';

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
            {/* Sidebar with Z-Index Shield */}
            <div className="z-[100] relative md:flex shrink-0">
                <Sidebar
                    mobileOpen={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    user={user}
                    logout={logout}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden relative bg-slate-100">
                {/* Navbar with Z-Index Shield */}
                <Navbar onMenuClick={handleDrawerToggle} className="z-[100]" />

                <main className={cn(
                    "flex-1 w-full relative scroll-smooth",
                    isMapView 
                        ? "p-0 overflow-hidden" 
                        : "p-4 md:p-6 overflow-y-auto overflow-x-hidden"
                )}>
                    <div className={cn(
                        "w-full h-full box-border",
                        isMapView ? "h-full w-full" : "max-w-7xl mx-auto px-2 sm:px-4"
                    )}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
