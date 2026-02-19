// src/components/PmoForm/AreaPropriedade_MUI.tsx
// Zero MUI — Box → Tailwind grid. DebouncedTextField is already Tailwind-native.

import React from 'react';
import DebouncedTextField from '../Common/DebouncedTextField';

interface AreaPropriedadeData {
    area_producao_organica_hectares?: string | number;
    area_producao_nao_organica_hectares?: string | number;
    area_producao_em_conversao_hectares?: string | number;
    areas_protegidas_hectares?: string | number;
    area_ocupada_instalacoes_benfeitorias_hectares?: string | number;
    area_total_propriedade_hectares?: string | number;
    [key: string]: any;
}

interface AreaPropriedadeMUIProps {
    data: AreaPropriedadeData | null | undefined;
    onDataChange: (data: AreaPropriedadeData) => void;
    errors?: Record<string, string>;
}

interface FieldConfig {
    name: string;
    label: string;
    required: boolean;
}

const fields: FieldConfig[] = [
    { name: 'area_producao_organica_hectares', label: 'Área de Produção Orgânica (ha)', required: false },
    { name: 'area_producao_nao_organica_hectares', label: 'Área Não Orgânica (ha)', required: false },
    { name: 'area_producao_em_conversao_hectares', label: 'Área em Conversão (ha)', required: false },
    { name: 'areas_protegidas_hectares', label: 'Áreas Protegidas (ha)', required: false },
    { name: 'area_ocupada_instalacoes_benfeitorias_hectares', label: 'Área de Instalações (ha)', required: false },
    { name: 'area_total_propriedade_hectares', label: 'Área Total (ha)', required: true },
];

const AreaPropriedadeMUI: React.FC<AreaPropriedadeMUIProps> = ({ data, onDataChange, errors }) => {
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
                    value={String(safeData[field.name] ?? '')}
                    onChange={(val: string) => handleChange(field.name, val)}
                    error={!!safeErrors[field.name]}
                    helperText={safeErrors[field.name] || ' '}
                    type="number"
                    required={field.required}
                    inputProps={{ step: '0.01', min: '0' }}
                />
            ))}
        </div>
    );
};

export default AreaPropriedadeMUI;
