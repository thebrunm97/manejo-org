import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Grid,
    Select, MenuItem, InputLabel, FormControl
} from '@mui/material';

interface SuggestionRefinementDialogProps {
    open: boolean;
    initialData: any;
    onClose: () => void;
    onConfirm: (data: any) => void;
}

export default function SuggestionRefinementDialog({
    open,
    initialData,
    onClose,
    onConfirm
}: SuggestionRefinementDialogProps) {
    const [formData, setFormData] = useState({
        talhao_canteiro: '',
        area_plantada: 0,
        area_plantada_unidade: 'm²',
        producao_esperada_ano: 0,
        producao_unidade: 'kg'
    });

    useEffect(() => {
        if (open && initialData) {
            setFormData({
                talhao_canteiro: initialData.talhao_canteiro || initialData.local || '',
                // Prefer area_plantada if calculated by bot, otherwise use quantity
                area_plantada: Number(initialData.area_plantada) || Number(initialData.quantidade_valor) || 0,
                // Prefer explicit area unit, fallback to m² if generic
                area_plantada_unidade: initialData.area_plantada_unidade || initialData.quantidade_unidade || 'm²',
                producao_esperada_ano: Number(initialData.producao_anual) || 0,
                producao_unidade: initialData.unidade_producao || 'kg'
            });
        }
    }, [open, initialData]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleConfirm = () => {
        onConfirm({
            ...initialData, // Keep original fields (like produto)
            ...formData
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ bgcolor: 'secondary.main', color: 'white' }}>
                Refinar Sugestão de Plantio
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Produto: {initialData?.produto || 'Novo Cultivo'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Ajuste os valores estimados pela Inteligência Artificial antes de salvar.
                </Typography>

                <Grid container spacing={2} sx={{ mt: 1 }}>
                    {/* Local */}
                    <Grid item xs={12}>
                        <TextField
                            label="Local (Talhão/Canteiro)"
                            fullWidth
                            value={formData.talhao_canteiro}
                            onChange={(e) => handleChange('talhao_canteiro', e.target.value)}
                        />
                    </Grid>

                    {/* Área Plantada */}
                    <Grid item xs={8}>
                        <TextField
                            label="Área / Quantidade Plantada"
                            type="number"
                            fullWidth
                            value={formData.area_plantada}
                            onChange={(e) => handleChange('area_plantada', Number(e.target.value))}
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <FormControl fullWidth>
                            <InputLabel>Unidade</InputLabel>
                            <Select
                                label="Unidade"
                                value={formData.area_plantada_unidade}
                                onChange={(e) => handleChange('area_plantada_unidade', e.target.value)}
                            >
                                <MenuItem value="m²">m²</MenuItem>
                                <MenuItem value="ha">ha</MenuItem>
                                <MenuItem value="mudas">mudas</MenuItem>
                                <MenuItem value="unid">unid</MenuItem>
                                <MenuItem value="covas">covas</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Produção Esperada */}
                    <Grid item xs={8}>
                        <TextField
                            label="Produção Esperada / Ano"
                            type="number"
                            fullWidth
                            value={formData.producao_esperada_ano}
                            onChange={(e) => handleChange('producao_esperada_ano', Number(e.target.value))}
                            helperText="Estimativa de colheita total"
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <FormControl fullWidth>
                            <InputLabel>Unidade</InputLabel>
                            <Select
                                label="Unidade"
                                value={formData.producao_unidade}
                                onChange={(e) => handleChange('producao_unidade', e.target.value)}
                            >
                                <MenuItem value="kg">kg</MenuItem>
                                <MenuItem value="ton">ton</MenuItem>
                                <MenuItem value="maço">maço</MenuItem>
                                <MenuItem value="unid">unid</MenuItem>
                                <MenuItem value="cx">cx</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleConfirm} variant="contained" color="secondary">
                    Confirmar e Salvar
                </Button>
            </DialogActions>
        </Dialog>
    );
}
