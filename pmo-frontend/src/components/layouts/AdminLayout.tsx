import React from 'react';
import DashboardLayout from '../DashboardLayout';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    return (
        <DashboardLayout>
            <div className="border-b-2 border-green-600 mb-3 pb-1">
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                    ADMINISTRAÇÃO
                </span>
            </div>
            {children}
        </DashboardLayout>
    );
};

export default AdminLayout;
