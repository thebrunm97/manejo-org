// src/components/PmoForm/MapaCroqui_MUI.tsx

import React, { ChangeEvent } from 'react';
import { TextField } from '@mui/material';

interface MapaCroquiData {
    mapa_croqui_propriedade?: string;
    [key: string]: any;
}

interface MapaCroquiErrors {
    mapa_croqui_propriedade?: string;
    [key: string]: any;
}

interface MapaCroquiMUIProps {
    data: MapaCroquiData;
    onDataChange: (data: MapaCroquiData) => void;
    errors?: MapaCroquiErrors;
}

const MapaCroquiMUI: React.FC<MapaCroquiMUIProps> = ({ data, onDataChange, errors }) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onDataChange({ ...data, [e.target.name]: e.target.value });
    };

    const fieldName = 'mapa_croqui_propriedade';
    const hasError = !!errors?.[fieldName];
    const errorMessage = errors?.[fieldName] || ' ';

    return (
        <>
            <TextField
                name={fieldName}
                label="Descrição do Mapa ou Croqui"
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

export default MapaCroquiMUI;
