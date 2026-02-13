// src/components/PmoForm/Coordenadas_MUI.tsx

import React, { useState, ChangeEvent } from 'react';
import { Grid, TextField, Button, Box, CircularProgress, FormHelperText } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';

interface CoordenadasData {
    latitude?: string;
    longitude?: string;
    [key: string]: any;
}

interface CoordenadasMUIProps {
    data: CoordenadasData | null | undefined;
    onDataChange: (data: CoordenadasData) => void;
    errors?: Record<string, string>;
}

const CoordenadasMUI: React.FC<CoordenadasMUIProps> = ({ data, onDataChange, errors }) => {
    const [geoError, setGeoError] = useState<string>('');
    const [isFetching, setIsFetching] = useState<boolean>(false);

    const safeData = data || {};
    const safeErrors = errors || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onDataChange({ ...safeData, [e.target.name]: e.target.value });
    };

    const handleGetCoordinates = () => {
        if (!navigator.geolocation) {
            setGeoError('A Geolocalização não é suportada pelo seu navegador.');
            return;
        }

        setIsFetching(true);
        setGeoError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                onDataChange({
                    ...safeData,
                    latitude: latitude.toFixed(6),
                    longitude: longitude.toFixed(6),
                });
                setIsFetching(false);
            },
            (error) => {
                switch (error.code) {
                    case 1: setGeoError("Permissão para obter a localização foi negada."); break;
                    case 2: setGeoError("A informação de localização não está disponível."); break;
                    case 3: setGeoError("A requisição para obter a localização expirou."); break;
                    default: setGeoError("Ocorreu um erro desconhecido ao obter a localização."); break;
                }
                setIsFetching(false);
            }
        );
    };

    return (
        <>
            {/* Botão de geolocalização */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={handleGetCoordinates}
                    disabled={isFetching}
                    startIcon={isFetching ? <CircularProgress size={16} /> : <MyLocationIcon />}
                >
                    {isFetching ? 'Obtendo...' : 'Usar Localização'}
                </Button>
            </Box>

            {/* Grid de campos */}
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        name="latitude"
                        label="Latitude"
                        value={safeData.latitude || ''}
                        onChange={handleChange}
                        error={!!safeErrors.latitude}
                        helperText={safeErrors.latitude || ' '}
                        fullWidth
                        required
                        variant="outlined"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        name="longitude"
                        label="Longitude"
                        value={safeData.longitude || ''}
                        onChange={handleChange}
                        error={!!safeErrors.longitude}
                        helperText={safeErrors.longitude || ' '}
                        fullWidth
                        required
                        variant="outlined"
                    />
                </Grid>
            </Grid>

            {/* Erro de geolocalização */}
            {geoError && (
                <FormHelperText error sx={{ mt: 1 }}>
                    {geoError}
                </FormHelperText>
            )}
        </>
    );
};

export default CoordenadasMUI;
