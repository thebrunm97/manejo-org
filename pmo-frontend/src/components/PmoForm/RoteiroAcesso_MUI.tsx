// src/components/PmoForm/RoteiroAcesso_MUI.tsx

import React, { ChangeEvent } from 'react';
import { TextField } from '@mui/material';

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
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onDataChange({ ...data, [e.target.name]: e.target.value });
    };

    const fieldName = 'roteiro_acesso';
    const hasError = !!errors?.[fieldName];
    const errorMessage = errors?.[fieldName] || ' ';

    return (
        <>
            <TextField
                name={fieldName}
                label="Descrição do Roteiro de Acesso"
                value={data?.[fieldName] || ''}
                onChange={handleChange}
                error={hasError}
                helperText={errorMessage}
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                required
            />
        </>
    );
};

export default RoteiroAcessoMUI;
