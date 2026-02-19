import React from 'react';
import { Leaf, Edit } from 'lucide-react';

interface PlanoAtualCardProps {
    nomePlano: string | null;
    versao?: number;
    status?: string;
    onVer: () => void;
    onEditar: () => void;
}

const PlanoAtualCard: React.FC<PlanoAtualCardProps> = ({
    nomePlano,
    versao = 1,
    status = 'Em andamento',
    onVer,
    onEditar,
}) => {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden flex flex-col min-h-[180px]">
            {/* Header: Icon + Label */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                    <Leaf size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                    PLANO ATUAL
                </span>
            </div>

            {/* Content */}
            {nomePlano ? (
                <>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight mb-1 break-words">
                        {nomePlano}
                    </h3>

                    <div className="text-sm text-slate-500 mb-6 flex items-center gap-2">
                        <span>v{versao}</span>
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 block" />
                            <span>{status}</span>
                        </div>
                    </div>

                    {/* Footer: Buttons */}
                    <div className="mt-auto flex gap-2">
                        <button
                            onClick={onVer}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                            Ver
                        </button>
                        <button
                            onClick={onEditar}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 hover:border-slate-300"
                            aria-label="Editar plano"
                        >
                            <Edit size={18} />
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    Nenhum plano selecionado
                </div>
            )}
        </div>
    );
};

export default PlanoAtualCard;
