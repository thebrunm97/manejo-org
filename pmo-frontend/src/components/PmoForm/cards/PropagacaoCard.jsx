// src/components/PmoForm/cards/PropagacaoCard.jsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React from 'react';
import { Edit, Trash2, Sprout, Calendar } from 'lucide-react';

const PropagacaoCard = ({ item, onEdit, onDelete }) => {
    const isOrganic = item.sistema_organico === true;

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm border-l-4 border-l-green-600 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="p-4">
                {/* Header com Tipo + Ações */}
                <div className="flex justify-between items-start mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-wide bg-green-600 text-white">
                        {item.tipo === 'semente' ? 'Semente' : 'Muda'}
                    </span>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => onEdit(item)}
                            title="Editar"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                        >
                            <Edit size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(item)}
                            title="Excluir"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Título Principal */}
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                    <Sprout size={20} className="text-green-600 shrink-0" />
                    {item.especies || 'Não especificado'}
                </h3>

                {/* Chips de Informação */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500 text-blue-500">
                        Origem: {item.origem || 'N/A'}
                    </span>
                    {item.sistema_organico !== null && (
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isOrganic
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-500'
                                }`}
                        >
                            {isOrganic ? 'Orgânico' : 'Convencional'}
                        </span>
                    )}
                </div>

                {/* Metadados */}
                <div className="flex flex-col gap-1">
                    {item.quantidade && (
                        <p className="text-sm text-gray-500">
                            <strong>Quantidade:</strong> {item.quantidade}
                        </p>
                    )}
                    {item.data_compra && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar size={14} />
                            <strong>Compra:</strong> {new Date(item.data_compra).toLocaleDateString('pt-BR')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropagacaoCard;
