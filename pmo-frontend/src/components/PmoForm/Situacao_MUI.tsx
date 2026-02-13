// src/components/PmoForm/Situacao_MUI.tsx

import React, { ChangeEvent } from 'react';
import { TextField, MenuItem } from '@mui/material';

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
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onDataChange({ ...data, [e.target.name]: e.target.value });
    };

    const fieldName = 'situacao_propriedade_producao_organica';

    return (
        <>
            <TextField
                name={fieldName}
                label="Situação da Propriedade"
                value={data?.[fieldName] || ''}
                onChange={handleChange}
                error={!!errors?.[fieldName]}
                helperText={errors?.[fieldName] || ' '}
                select
                fullWidth
                variant="outlined"
                required
            >
                <MenuItem value="" disabled>Selecione uma opção</MenuItem>
                {opcoes.map(opcao => (
                    <MenuItem key={opcao} value={opcao}>{opcao}</MenuItem>
                ))}
            </TextField>
        </>
    );
};

export default SituacaoMUI;
