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
        <div className="bg-white rounded-3xl border border-agro-ouro/15 p-6 lg:p-8 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col h-full min-h-[200px] group">
            {/* Header: Icon + Label */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-green-50 rounded-2xl text-green-700 transition-transform group-hover:scale-110">
                    <Leaf size={22} />
                </div>
                <span className="text-[10px] font-black text-slate-600 tracking-wider uppercase bg-slate-50 px-2.5 py-1 rounded-lg">
                    PLANO ATUAL
                </span>
            </div>

            {/* Content */}
            {nomePlano ? (
                <div className="flex flex-col flex-1">
                    <h3 className="text-2xl font-black text-slate-950 leading-tight mb-2 break-words font-sans">
                        {nomePlano}
                    </h3>

                    <div className="text-sm text-slate-700 mb-8 flex items-center gap-2 font-bold">
                        <span>v{versao}</span>
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 block shadow-[0_0_8px_rgba(34,197,94,0.5)] fade-in" />
                            <span>{status}</span>
                        </div>
                    </div>

                    {/* Footer: Buttons */}
                    <div className="mt-auto flex gap-3">
                        <button
                            onClick={onVer}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-black py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-green-600/20 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            Ver Plano
                        </button>
                        <button
                            onClick={onEditar}
                            className="p-2.5 text-slate-600 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 hover:border-slate-300"
                            aria-label="Editar plano"
                        >
                            <Edit size={20} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 font-bold text-sm">
                    Nenhum plano selecionado
                </div>
            )}
        </div>
    );
};

export default PlanoAtualCard;
