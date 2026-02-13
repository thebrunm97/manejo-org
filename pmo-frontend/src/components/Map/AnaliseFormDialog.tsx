// src/components/Map/AnaliseFormDialog.tsx

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Grid, Typography, Divider, Box,
    InputAdornment, Alert
} from '@mui/material';
import { analiseService } from '../../services/analiseService';
import { soilLogic } from '../../utils/soilLogic';

// Types
interface AnaliseData {
    id?: string;
    data_analise?: string;
    ph?: string | number;
    ph_agua?: string | number;
    fosforo?: string | number;
    potassio?: string | number;
    calcio?: string | number;
    magnesio?: string | number;
    saturacao_bases?: string | number;
    materia_organica?: string | number;
    argila?: string | number;
    areia?: string | number;
    silte?: string | number;
}

interface AnaliseFormData {
    id?: string;
    data_analise: string;
    ph: string;
    fosforo: string;
    potassio: string;
    calcio: string;
    magnesio: string;
    saturacao_bases: string;
    materia_organica: string;
    argila: string;
    areia: string;
    silte: string | number;
}

interface AnaliseFormDialogProps {
    open: boolean;
    onClose: () => void;
    talhaoId: string;
    onSaveSuccess: () => void;
    initialData?: AnaliseData | null;
}

const AnaliseFormDialog: React.FC<AnaliseFormDialogProps> = ({ open, onClose, talhaoId, onSaveSuccess, initialData = null }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<AnaliseFormData>({
        data_analise: new Date().toISOString().split('T')[0],
        ph: '', fosforo: '', potassio: '', calcio: '', magnesio: '',
        saturacao_bases: '', materia_organica: '', argila: '', areia: '', silte: ''
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    id: initialData.id,
                    data_analise: String(initialData.data_analise || new Date().toISOString().split('T')[0]),
                    ph: String(initialData.ph || initialData.ph_agua || ''),
                    fosforo: String(initialData.fosforo || ''),
                    potassio: String(initialData.potassio || ''),
                    calcio: String(initialData.calcio || ''),
                    magnesio: String(initialData.magnesio || ''),
                    saturacao_bases: String(initialData.saturacao_bases || ''),
                    materia_organica: String(initialData.materia_organica || ''),
                    argila: String(initialData.argila || ''),
                    areia: String(initialData.areia || ''),
                    silte: String(initialData.silte || '')
                });
            } else {
                setFormData({
                    data_analise: new Date().toISOString().split('T')[0],
                    ph: '', fosforo: '', potassio: '', calcio: '', magnesio: '',
                    saturacao_bases: '', materia_organica: '', argila: '', areia: '', silte: ''
                });
            }
        }
    }, [initialData, open]);

    useEffect(() => {
        const argila = formData.argila;
        const areia = formData.areia;
        if (argila !== '' || areia !== '') {
            const calculatedSilte = soilLogic.calculateSilt(argila, areia);
            setFormData(prev => {
                if (parseFloat(String(prev.silte)) === calculatedSilte) return prev;
                return { ...prev, silte: calculatedSilte };
            });
        }
    }, [formData.argila, formData.areia]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isTextureInvalid = (): boolean => {
        const argila = parseFloat(formData.argila) || 0;
        const areia = parseFloat(formData.areia) || 0;
        return (argila + areia) > 100;
    };

    const handleSubmit = async () => {
        if (isTextureInvalid()) return;
        setLoading(true);
        try {
            const payload = { ...formData, talhao_id: talhaoId, ph: formData.ph, saturacao_bases: formData.saturacao_bases };
            await analiseService.saveAnalise(payload);
            onSaveSuccess();
            onClose();
        } catch (error) {
            alert('Erro ao salvar análise.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #e0e0e0' }}>
                {initialData ? 'Editar Análise de Solo' : 'Nova Análise de Solo'}
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                <Box sx={{ mt: 2 }}>
                    <TextField label="Data da Análise" type="date" name="data_analise" value={formData.data_analise} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} sx={{ mb: 3 }} />

                    <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 2 }}>QUÍMICA DO SOLO</Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6}><TextField label="pH (H₂O)" name="ph" type="number" value={formData.ph} onChange={handleChange} fullWidth size="small" /></Grid>
                        <Grid item xs={6}><TextField label="M.O. (%)" name="materia_organica" type="number" value={formData.materia_organica} onChange={handleChange} fullWidth size="small" /></Grid>
                        <Grid item xs={6}><TextField label="P (mg/dm³)" name="fosforo" type="number" value={formData.fosforo} onChange={handleChange} fullWidth size="small" /></Grid>
                        <Grid item xs={6}><TextField label="K (mg/dm³)" name="potassio" type="number" value={formData.potassio} onChange={handleChange} fullWidth size="small" /></Grid>
                        <Grid item xs={4}><TextField label="Ca (cmol)" name="calcio" type="number" value={formData.calcio} onChange={handleChange} fullWidth size="small" /></Grid>
                        <Grid item xs={4}><TextField label="Mg (cmol)" name="magnesio" type="number" value={formData.magnesio} onChange={handleChange} fullWidth size="small" /></Grid>
                        <Grid item xs={4}><TextField label="V (%) (Sat. Bases)" name="saturacao_bases" type="number" value={formData.saturacao_bases} onChange={handleChange} fullWidth size="small" InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /></Grid>
                    </Grid>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="subtitle2" fontWeight={700} color="secondary" sx={{ mb: 2 }}>FÍSICA (TEXTURA)</Typography>
                    {isTextureInvalid() && <Alert severity="error" sx={{ mb: 2 }}>A soma de Argila e Areia não pode exceder 100%</Alert>}

                    <Grid container spacing={2}>
                        <Grid item xs={4}><TextField label="Argila (%)" name="argila" type="number" value={formData.argila} onChange={handleChange} fullWidth size="small" inputProps={{ min: 0, max: 100 }} /></Grid>
                        <Grid item xs={4}><TextField label="Areia (%)" name="areia" type="number" value={formData.areia} onChange={handleChange} fullWidth size="small" inputProps={{ min: 0, max: 100 }} /></Grid>
                        <Grid item xs={4}><TextField label="Silte (%)" name="silte" type="number" value={formData.silte} InputProps={{ readOnly: true, sx: { bgcolor: '#f5f5f5' } }} fullWidth size="small" helperText="Calculado automaticamente" /></Grid>
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
                <Button onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button onClick={handleSubmit} variant="contained" color="success" disabled={loading || isTextureInvalid()}>{loading ? 'Salvando...' : 'Salvar Análise'}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default AnaliseFormDialog;
