// src/components/PmoForm/DadosCadastrais_MUI.tsx
// Zero MUI — Box → Tailwind grid. DebouncedTextField is already Tailwind-native.

import React from 'react';
import DebouncedTextField from '../Common/DebouncedTextField';

interface DadosCadastraisData {
    nome_produtor?: string;
    cpf?: string;
    endereco_propriedade_base_fisica_produtiva?: string;
    telefone?: string;
    email?: string;
    responsavel_preenchimento?: string;
    data_preenchimento?: string;
    [key: string]: any;
}

interface DadosCadastraisMUIProps {
    data: DadosCadastraisData | null | undefined;
    onDataChange: (data: DadosCadastraisData) => void;
    errors?: Record<string, string>;
}

interface FieldConfig {
    name: string;
    label: string;
    type?: string;
    required: boolean;
}

const fields: FieldConfig[] = [
    { name: 'nome_produtor', label: 'Nome do Produtor', required: true },
    { name: 'cpf', label: 'CPF', required: true },
    { name: 'endereco_propriedade_base_fisica_produtiva', label: 'Endereço da Propriedade', required: true },
    { name: 'telefone', label: 'Telefone', type: 'tel', required: true },
    { name: 'email', label: 'E-mail', type: 'email', required: true },
    { name: 'responsavel_preenchimento', label: 'Responsável pelo Preenchimento', required: true },
    { name: 'data_preenchimento', label: 'Data de Preenchimento', type: 'date', required: true },
];

const DadosCadastraisMUI: React.FC<DadosCadastraisMUIProps> = ({ data, onDataChange, errors }) => {
    const handleChange = (name: string, value: string) => {
        onDataChange({ ...data, [name]: value });
    };

    const safeData = data || {};
    const safeErrors = errors || {};

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map((field) => (
                <DebouncedTextField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    value={safeData[field.name] || ''}
                    onChange={(val: string) => handleChange(field.name, val)}
                    error={!!safeErrors[field.name]}
                    helperText={safeErrors[field.name] || ' '}
                    type={field.type || 'text'}
                    required={field.required}
                />
            ))}
        </div>
    );
};

export default DadosCadastraisMUI;
