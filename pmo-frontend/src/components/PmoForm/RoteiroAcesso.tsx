// src/components/PmoForm/RoteiroAcesso.tsx
// Zero MUI — Tailwind + HTML nativo

import React, { ChangeEvent } from 'react';

interface RoteiroAcessoData {
    roteiro_acesso?: string;
    [key: string]: any;
}

interface RoteiroAcessoErrors {
    roteiro_acesso?: string;
    [key: string]: any;
}

interface RoteiroAcessoMUIProps {
    data: RoteiroAcessoData;
    onDataChange: (data: RoteiroAcessoData) => void;
    errors?: RoteiroAcessoErrors;
}

const RoteiroAcessoMUI: React.FC<RoteiroAcessoMUIProps> = ({ data, onDataChange, errors }) => {
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        onDataChange({ ...data, [e.target.name]: e.target.value });
    };

    const fieldName = 'roteiro_acesso';
    const hasError = !!errors?.[fieldName];
    const errorMessage = errors?.[fieldName];

    return (
        <div>
            <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700 mb-1">
                Descrição do Roteiro de Acesso <span className="text-red-500">*</span>
            </label>
            <textarea
                id={fieldName}
                name={fieldName}
                value={data?.[fieldName] || ''}
                onChange={handleChange}
                rows={3}
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

export default RoteiroAcessoMUI;
