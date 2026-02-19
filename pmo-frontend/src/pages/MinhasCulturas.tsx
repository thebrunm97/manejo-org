// src/pages/MinhasCulturas.tsx

import React from 'react';
import { Sprout, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MinhasCulturas: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 mb-10">
            <div className="bg-transparent text-center flex flex-col items-center gap-8 py-12 px-6">
                <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mb-4 shadow-[0_0_0_10px_rgba(16,185,129,0.1)]">
                    <Sprout size={64} className="text-emerald-600" strokeWidth={1.5} />
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">
                    Gestão de Culturas
                </h1>

                <p className="text-slate-500 text-lg leading-relaxed max-w-lg">
                    Estamos preparando uma área exclusiva para você gerenciar o ciclo de vida das suas culturas, desde o plantio até a colheita, com estatísticas detalhadas.
                </p>

                <div className="mt-2">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border border-green-200 bg-green-50 text-green-700">
                        Em Breve
                    </span>
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg shadow-green-600/20 transition-all hover:-translate-y-0.5"
                >
                    <ArrowLeft size={20} />
                    Voltar para Visão Geral
                </button>
            </div>
        </div>
    );
};

export default MinhasCulturas;
