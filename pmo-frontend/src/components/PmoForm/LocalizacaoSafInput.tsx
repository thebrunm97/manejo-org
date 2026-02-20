// src/components/PmoForm/LocalizacaoSafInput.tsx
// Refatorado — Zero MUI. Usa datalist nativo + Tailwind.

import React, { useState, useEffect, ChangeEvent } from 'react';

// Listas de opções para SAF
const TALHOES = ['Talhão 1', 'Talhão 2', 'Talhão 3', 'SAF Experimental', 'SAF Principal', 'Horta Mandala'];
const MICRO_LOCAIS = [
    'Linha de Árvores',
    'Entrelinha',
    'Berço',
    'Borda',
    'Canteiro',
    'Entrelinha de Café',
    'Linha de Bananeiras',
    'Estrato Baixo',
    'Estrato Médio',
    'Estrato Alto'
];

interface LocalizacaoSafInputProps {
    value?: string;
    onChange?: (value: string) => void;
    size?: 'small' | 'medium';
}

const LocalizacaoSafInput: React.FC<LocalizacaoSafInputProps> = ({
    value = '',
    onChange,
    size = 'small'
}) => {
    const [talhao, setTalhao] = useState<string>('');
    const [detalhe, setDetalhe] = useState<string>('');

    // Parser: Separa o valor inicial em talhão e detalhe
    useEffect(() => {
        if (value && typeof value === 'string' && value.includes(' - ')) {
            const parts = value.split(' - ');
            setTalhao(parts[0].trim());
            setDetalhe(parts[1].trim());
        } else if (value && typeof value === 'string' && value.trim()) {
            setTalhao(value.trim());
            setDetalhe('');
        } else {
            setTalhao('');
            setDetalhe('');
        }
    }, [value]);

    // Concatena e notifica mudança
    const handleUpdate = (newTalhao: string, newDetalhe: string) => {
        let resultado = '';

        if (newTalhao && newDetalhe) {
            resultado = `${newTalhao} - ${newDetalhe}`;
        } else if (newTalhao) {
            resultado = newTalhao;
        } else if (newDetalhe) {
            resultado = newDetalhe;
        }

        if (onChange) {
            onChange(resultado);
        }
    };

    const handleTalhaoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setTalhao(newValue);
        handleUpdate(newValue, detalhe);
    };

    const handleDetalheChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setDetalhe(newValue);
        handleUpdate(talhao, newValue);
    };

    const inputCls = `w-full border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-sm ${size === 'small' ? 'p-1.5' : 'p-2'
        }`;

    return (
        <div className="grid grid-cols-2 gap-2">
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Talhão</label>
                <input
                    type="text"
                    list="saf-talhoes"
                    value={talhao}
                    onChange={handleTalhaoChange}
                    placeholder="Ex: Talhão 1"
                    className={inputCls}
                />
                <datalist id="saf-talhoes">
                    {TALHOES.map(t => <option key={t} value={t} />)}
                </datalist>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Micro-Local</label>
                <input
                    type="text"
                    list="saf-micro-locais"
                    value={detalhe}
                    onChange={handleDetalheChange}
                    placeholder="Ex: Entrelinha"
                    className={inputCls}
                />
                <datalist id="saf-micro-locais">
                    {MICRO_LOCAIS.map(m => <option key={m} value={m} />)}
                </datalist>
            </div>
        </div>
    );
};

export default LocalizacaoSafInput;
