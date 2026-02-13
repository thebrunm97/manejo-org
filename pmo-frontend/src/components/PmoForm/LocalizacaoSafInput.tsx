// src/components/PmoForm/LocalizacaoSafInput.tsx

import React, { useState, useEffect, SyntheticEvent } from 'react';
import { Autocomplete, TextField, Grid } from '@mui/material';

// Listas de opções para SAF
const TALHOES = ['Talhão 1', 'Talhão 2', 'Talhão 3', 'SAF Experimental', 'SAF Principal', 'Horta Mandala'];
const MICRO_LOCAIS = [
    'Linha de Árvores',
    'Entrelinha',
    'Berço',
    'Borda',
    'Canteiro',
    'Entrelinha de Café',
    'Linha de Bananeiras',
    'Estrato Baixo',
    'Estrato Médio',
    'Estrato Alto'
];

interface LocalizacaoSafInputProps {
    value?: string;
    onChange?: (value: string) => void;
    size?: 'small' | 'medium';
}

const LocalizacaoSafInput: React.FC<LocalizacaoSafInputProps> = ({
    value = '',
    onChange,
    size = 'small'
}) => {
    const [talhao, setTalhao] = useState<string>('');
    const [detalhe, setDetalhe] = useState<string>('');

    // Parser: Separa o valor inicial em talhão e detalhe
    useEffect(() => {
        if (value && typeof value === 'string' && value.includes(' - ')) {
            const parts = value.split(' - ');
            setTalhao(parts[0].trim());
            setDetalhe(parts[1].trim());
        } else if (value && typeof value === 'string' && value.trim()) {
            setTalhao(value.trim());
            setDetalhe('');
        } else {
            setTalhao('');
            setDetalhe('');
        }
    }, [value]);

    // Concatena e notifica mudança
    const handleUpdate = (newTalhao: string, newDetalhe: string) => {
        let resultado = '';

        if (newTalhao && newDetalhe) {
            resultado = `${newTalhao} - ${newDetalhe}`;
        } else if (newTalhao) {
            resultado = newTalhao;
        } else if (newDetalhe) {
            resultado = newDetalhe;
        }

        if (onChange) {
            onChange(resultado);
        }
    };

    const handleTalhaoChange = (_event: SyntheticEvent, newValue: string | null) => {
        setTalhao(newValue || '');
        handleUpdate(newValue || '', detalhe);
    };

    const handleDetalheChange = (_event: SyntheticEvent, newValue: string | null) => {
        setDetalhe(newValue || '');
        handleUpdate(talhao, newValue || '');
    };

    return (
        <Grid container spacing={1}>
            <Grid item xs={6}>
                <Autocomplete
                    freeSolo
                    size={size}
                    options={TALHOES}
                    value={talhao}
                    onChange={handleTalhaoChange}
                    onInputChange={handleTalhaoChange}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Talhão"
                            placeholder="Ex: Talhão 1"
                            size={size}
                        />
                    )}
                />
            </Grid>
            <Grid item xs={6}>
                <Autocomplete
                    freeSolo
                    size={size}
                    options={MICRO_LOCAIS}
                    value={detalhe}
                    onChange={handleDetalheChange}
                    onInputChange={handleDetalheChange}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Micro-Local"
                            placeholder="Ex: Entrelinha"
                            size={size}
                        />
                    )}
                />
            </Grid>
        </Grid>
    );
};

export default LocalizacaoSafInput;
