// src/components/PmoForm/Historico_MUI.tsx

import React, { ChangeEvent } from 'react';
import { TextField } from '@mui/material';

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
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => onDataChange({ ...data, [e.target.name]: e.target.value });
    const fieldName = 'historico_propriedade_producao_organica';

    return (
        <>
            <TextField
                name={fieldName}
                label="Descreva o histórico..."
                value={data?.[fieldName] || ''}
                onChange={handleChange}
                error={!!errors?.[fieldName]}
                helperText={errors?.[fieldName] || ' '}
                variant="outlined"
                fullWidth
                multiline
                rows={4}
                required
            />
        </>
    );
};

export default HistoricoMUI;
