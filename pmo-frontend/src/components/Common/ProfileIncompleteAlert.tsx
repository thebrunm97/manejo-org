import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAppNavigation } from '../../hooks/navigation/useAppNavigation';

interface ProfileIncompleteAlertProps {
    show: boolean;
}

const ProfileIncompleteAlert: React.FC<ProfileIncompleteAlertProps> = ({ show }) => {
    const { navigateTo } = useAppNavigation();

    if (!show) return null;

    return (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-full text-yellow-600 shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <p className="text-sm font-bold text-yellow-800">Seu perfil está incompleto</p>
                    <p className="text-xs text-yellow-700">Adicione seu WhatsApp para ativar as funcionalidades de Inteligência Artificial.</p>
                </div>
            </div>
            <button
                type="button"
                onClick={() => navigateTo('perfil' as any)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-bold transition-all hover:shadow-md shrink-0 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
            >
                Completar Agora
                <ArrowRight size={14} />
            </button>
        </div>
    );
};

export default ProfileIncompleteAlert;
