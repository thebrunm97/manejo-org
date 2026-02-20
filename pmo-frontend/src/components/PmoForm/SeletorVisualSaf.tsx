// src/components/PmoForm/SeletorVisualSaf.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, ChangeEvent } from 'react';
import { Plus, Sprout, Route, X } from 'lucide-react';

// Types
interface Espaco {
    id: number;
    nome: string;
    tipo: 'canteiro' | 'entrelinha';
}

interface Layout {
    [talhao: string]: Espaco[];
}

interface NovoEspaco {
    nome: string;
    tipo: 'canteiro' | 'entrelinha';
}

interface SeletorVisualSafProps {
    value?: string;
    onChange?: (value: string) => void;
}

// Mock data
const MOCK_LAYOUT: Layout = {
    'Talhão 1': [
        { id: 1, nome: 'Canteiro 01', tipo: 'canteiro' },
        { id: 2, nome: 'Entrelinha A', tipo: 'entrelinha' },
        { id: 3, nome: 'Canteiro 02', tipo: 'canteiro' },
        { id: 4, nome: 'Entrelinha B', tipo: 'entrelinha' },
        { id: 5, nome: 'Canteiro 03', tipo: 'canteiro' }
    ],
    'Talhão 2': [
        { id: 6, nome: 'Canteiro A1', tipo: 'canteiro' },
        { id: 7, nome: 'Canteiro A2', tipo: 'canteiro' },
        { id: 8, nome: 'Entrelinha Central', tipo: 'entrelinha' }
    ],
    'SAF Experimental': [
        { id: 9, nome: 'Linha de Árvores', tipo: 'canteiro' },
        { id: 10, nome: 'Entrelinha Norte', tipo: 'entrelinha' },
        { id: 11, nome: 'Entrelinha Sul', tipo: 'entrelinha' },
        { id: 12, nome: 'Berço Frutíferas', tipo: 'canteiro' }
    ]
};

const SeletorVisualSaf: React.FC<SeletorVisualSafProps> = ({ value = '', onChange }) => {
    const talhoes = Object.keys(MOCK_LAYOUT);

    const [talhaoAtual, setTalhaoAtual] = useState(talhoes[0]);
    const [layout, setLayout] = useState<Layout>(MOCK_LAYOUT);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [novoEspaco, setNovoEspaco] = useState<NovoEspaco>({ nome: '', tipo: 'canteiro' });

    const [talhaoSelecionado, espacoSelecionado] = value && value.includes(' - ')
        ? value.split(' - ')
        : ['', ''];

    const handleEspacoClick = (espaco: Espaco) => {
        const novoValor = `${talhaoAtual} - ${espaco.nome}`;
        if (onChange) onChange(novoValor);
    };

    const handleAdicionarEspaco = () => {
        if (!novoEspaco.nome.trim()) {
            alert('Por favor, informe o nome do espaço');
            return;
        }

        const novoId = Math.max(...Object.values(layout).flat().map(e => e.id), 0) + 1;
        const espacoCriado: Espaco = { id: novoId, nome: novoEspaco.nome.trim(), tipo: novoEspaco.tipo };

        setLayout(prev => ({
            ...prev,
            [talhaoAtual]: [...(prev[talhaoAtual] || []), espacoCriado]
        }));

        setNovoEspaco({ nome: '', tipo: 'canteiro' });
        setDialogOpen(false);
        handleEspacoClick(espacoCriado);
    };

    const renderEspacoCard = (espaco: Espaco) => {
        const isCanteiro = espaco.tipo === 'canteiro';
        const isSelected = talhaoSelecionado === talhaoAtual && espacoSelecionado === espaco.nome;

        return (
            <button
                type="button"
                key={espaco.id}
                onClick={() => handleEspacoClick(espaco)}
                className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer text-center ${isSelected
                    ? 'border-green-500 shadow-lg ring-2 ring-green-200'
                    : isCanteiro
                        ? 'border-green-200 bg-green-50 hover:border-green-400'
                        : 'border-amber-300 bg-amber-50 hover:border-amber-500'
                    }`}
            >
                {isCanteiro
                    ? <Sprout size={36} className="text-green-600" />
                    : <Route size={36} className="text-amber-700" />
                }
                <span className="text-sm font-semibold text-gray-800">{espaco.nome}</span>
                <span className="text-xs text-gray-500">{isCanteiro ? 'Canteiro' : 'Entrelinha'}</span>
            </button>
        );
    };

    return (
        <div className="w-full my-3">
            {/* Tabs */}
            <div className="flex space-x-1 border-b border-gray-200 mb-4 overflow-x-auto">
                {talhoes.map(talhao => (
                    <button
                        type="button"
                        key={talhao}
                        onClick={() => setTalhaoAtual(talhao)}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${talhaoAtual === talhao
                            ? 'text-green-700 bg-green-50 border-b-2 border-green-500'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {talhao}
                    </button>
                ))}
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {(layout[talhaoAtual] || []).map(espaco => renderEspacoCard(espaco))}

                {/* Add Button Card */}
                <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 min-h-[140px] cursor-pointer transition-all hover:border-green-500 hover:bg-green-50"
                >
                    <Plus size={36} className="text-green-500" />
                    <span className="text-sm text-gray-500">Adicionar Espaço</span>
                </button>
            </div>

            {/* Selection indicator */}
            {value && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-xs text-gray-500">Selecionado:</span>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
            )}

            {/* Add Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDialogOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                            <h3 className="text-base font-semibold text-gray-800">Adicionar Novo Espaço em {talhaoAtual}</h3>
                            <button type="button" onClick={() => setDialogOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
                        </div>

                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Espaço</label>
                                <input
                                    type="text"
                                    value={novoEspaco.nome}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNovoEspaco(prev => ({ ...prev, nome: e.target.value }))}
                                    autoFocus
                                    placeholder="Ex: Canteiro 04, Entrelinha C"
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>

                            <div>
                                <p className="text-sm text-gray-700 mb-2">Tipo de Espaço:</p>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                                        <input
                                            type="radio" name="tipo-espaco" value="canteiro"
                                            checked={novoEspaco.tipo === 'canteiro'}
                                            onChange={(e) => setNovoEspaco(prev => ({ ...prev, tipo: e.target.value as 'canteiro' | 'entrelinha' }))}
                                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                                        />
                                        <Sprout size={18} className="text-green-600" />
                                        <span className="text-sm">Canteiro / Linha de Cultivo</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                                        <input
                                            type="radio" name="tipo-espaco" value="entrelinha"
                                            checked={novoEspaco.tipo === 'entrelinha'}
                                            onChange={(e) => setNovoEspaco(prev => ({ ...prev, tipo: e.target.value as 'canteiro' | 'entrelinha' }))}
                                            className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                                        />
                                        <Route size={18} className="text-amber-700" />
                                        <span className="text-sm">Entrelinha / Caminho</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                            <button type="button" onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button type="button" onClick={handleAdicionarEspaco} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg">
                                <Plus size={16} /> Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeletorVisualSaf;
