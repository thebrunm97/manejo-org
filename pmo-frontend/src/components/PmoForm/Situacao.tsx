// src/components/PmoForm/Situacao.tsx
// Zero MUI — Tailwind + HTML nativo (Select → native <select>)

import React, { ChangeEvent } from 'react';

interface SituacaoData {
    situacao_propriedade_producao_organica?: string;
    [key: string]: any;
}

interface SituacaoMUIProps {
    data: SituacaoData | null | undefined;
    onDataChange: (data: SituacaoData) => void;
    errors?: Record<string, string>;
}

const opcoes = [
    "Toda a propriedade já é orgânica",
    "Toda a propriedade está em conversão",
    "Há produção não orgânica e em conversão (conversão parcial)",
    "Há produção orgânica e em conversão",
    "Há produção orgânica e não orgânica (produção paralela)",
    "Há produção orgânica, não orgânica e em conversão"
];

const SituacaoMUI: React.FC<SituacaoMUIProps> = ({ data, onDataChange, errors }) => {
    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        onDataChange({ ...data, [e.target.name]: e.target.value });
    };

    const fieldName = 'situacao_propriedade_producao_organica';
    const hasError = !!errors?.[fieldName];
    const errorMessage = errors?.[fieldName];

    return (
        <div>
            <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700 mb-1">
                Situação da Propriedade <span className="text-red-500">*</span>
            </label>
            <select
                id={fieldName}
                name={fieldName}
                value={data?.[fieldName] || ''}
                onChange={handleChange}
                required
                className={`w-full rounded-md border shadow-sm px-3 py-2 text-sm outline-none bg-white
                    ${hasError
                        ? 'border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500'}`}
            >
                <option value="" disabled>Selecione uma opção</option>
                {opcoes.map(opcao => (
                    <option key={opcao} value={opcao}>{opcao}</option>
                ))}
            </select>
            {hasError && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
        </div>
    );
};

export default SituacaoMUI;
