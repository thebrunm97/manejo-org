// src/components/PmoForm/Historico.tsx
// Zero MUI — Tailwind + HTML nativo

import React, { ChangeEvent } from 'react';

interface HistoricoData {
    historico_propriedade_producao_organica?: string;
    [key: string]: any;
}

interface HistoricoErrors {
    historico_propriedade_producao_organica?: string;
    [key: string]: any;
}

interface HistoricoMUIProps {
    data: HistoricoData;
    onDataChange: (data: HistoricoData) => void;
    errors?: HistoricoErrors;
}

const HistoricoMUI: React.FC<HistoricoMUIProps> = ({ data, onDataChange, errors }) => {
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => onDataChange({ ...data, [e.target.name]: e.target.value });
    const fieldName = 'historico_propriedade_producao_organica';
    const hasError = !!errors?.[fieldName];
    const errorMessage = errors?.[fieldName];

    return (
        <div>
            <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700 mb-1">
                Descreva o histórico... <span className="text-red-500">*</span>
            </label>
            <textarea
                id={fieldName}
                name={fieldName}
                value={data?.[fieldName] || ''}
                onChange={handleChange}
                rows={4}
                required
                className={`w-full rounded-md border shadow-sm px-3 py-2 text-sm outline-none placeholder-gray-400 resize-y
                    ${hasError
                        ? 'border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500'}`}
            />
            {hasError && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
        </div>
    );
};

export default HistoricoMUI;
