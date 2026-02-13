import React, { useState, useEffect } from 'react';
import {
    Drawer, Box, Typography, IconButton, Tabs, Tab, List, ListItem, ListItemText,
    ListItemIcon, Fab, Chip, Alert, Tooltip, Button, TextField, Grid,
    Paper, ToggleButton, ToggleButtonGroup, Divider, LinearProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, Radio, RadioGroup, FormControlLabel, FormControl, Switch, InputAdornment, FormLabel,
    Snackbar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// --- MUI Icons (Safe replacement for Lucide) ---
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GrassIcon from '@mui/icons-material/Grass';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ForestIcon from '@mui/icons-material/Forest';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ScienceIcon from '@mui/icons-material/Science'; // Activity
import SpaIcon from '@mui/icons-material/Spa';
import EditIcon from '@mui/icons-material/Edit'; // Edit2
import SaveIcon from '@mui/icons-material/Save'; // Save

import { locationService } from '../../services/locationService';

// --- Helper: Soil Classification ---
const getSoilClassification = (clay: number, sand: number) => {
    if (!clay && !sand) return "Indefinido";
    // Garante números para comparação
    const c = parseFloat(String(clay));
    const s = parseFloat(String(sand));

    if (c >= 60) return "Muito Argiloso";
    if (c >= 35) return "Argiloso";
    if (s >= 70 && c < 15) return "Arenoso";
    if (c >= 20 && c < 35 && s < 45) return "Franco-Argiloso";
    if (c < 35 && s > 45) return "Franco-Arenoso";
    return "Franco (Médio)";
};

// Interface Props (Aligned with PropertyMap usage)
interface TalhaoDetailsDrawerProps {
    open: boolean;
    onClose: () => void;
    talhao: any;
    onDeleteCanteiro: (id: string | number) => void;
    onAddCanteiro?: () => void;
    // PropertyMap passes 'onUpdateStart', User Code asked for 'onUpdate'. We'll adapt.
    onUpdateStart?: () => void;
}

const TalhaoDetailsDrawer: React.FC<TalhaoDetailsDrawerProps> = ({
    open,
    onClose,
    talhao,
    onDeleteCanteiro,
    onAddCanteiro,
    onUpdateStart
}) => {
    const theme = useTheme();
    const [tabIndex, setTabIndex] = useState(0);

    // --- Feedback State ---
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });

    const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

    // --- State for Create Modal ---
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [batchData, setBatchData] = useState({
        type: 'canteiro', // canteiro, linha, tanque
        baseName: '',
        width: '',
        length: '',
        isBatch: false,
        quantity: 1,
        startNumber: 1
    });

    // Helper to open modal
    const handleOpenCreateModal = () => {
        setBatchData({
            type: 'canteiro',
            baseName: '',
            width: '',
            length: '',
            isBatch: false,
            quantity: 1,
            startNumber: 1
        });
        setCreateModalOpen(true);
    };

    const handleBatchSave = async () => {
        if (!talhao) return;
        try {
            const payloads = [];

            const w = parseFloat(batchData.width.replace(',', '.')) || 0;
            const l = parseFloat(batchData.length.replace(',', '.')) || 0;
            const area = (w > 0 && l > 0) ? (w * l) : null;

            const count = batchData.isBatch ? (Math.max(1, batchData.quantity)) : 1;
            const start = batchData.isBatch ? (Math.max(1, batchData.startNumber)) : 1;

            for (let i = 0; i < count; i++) {
                const num = start + i;
                // Se for batch, adiciona número. Se for single, usa apenas o nome base (ou nome default se vazio)
                let finalName = batchData.baseName;
                if (!finalName) finalName = batchData.type === 'linha' ? 'Linha' : (batchData.type === 'tanque' ? 'Tanque' : 'Canteiro');

                if (batchData.isBatch) {
                    finalName = `${finalName} ${num}`;
                }

                payloads.push({
                    talhao_id: talhao.id,
                    nome: finalName,
                    tipo: batchData.type,
                    largura: w || null,
                    comprimento: l || null,
                    area_total_m2: area,
                    status: 'ativo'
                });
            }

            if (locationService.createCanteirosBatch) {
                await locationService.createCanteirosBatch(payloads);
                // Refresh
                if (onUpdateStart) onUpdateStart();
                setCreateModalOpen(false);
                setSnackbar({ open: true, message: `${count} estruturas criadas com sucesso!`, severity: 'success' });
            } else {
                console.error("createCanteirosBatch not implemented");
            }

        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: "Erro ao criar estruturas.", severity: 'error' });
        }
    };

    // --- Tab Switching Logic (If Talhao changes, reset?) ---
    // User logic didn't have tabs, but we need them for Canteiros.

    // --- Soil State ---
    const [isEditing, setIsEditing] = useState(false);
    const [unitMode, setUnitMode] = useState<'percent' | 'g_kg'>('percent');

    // Form Data
    const [formData, setFormData] = useState({
        ph_solo: '', materia_organica: '', v_percent: '',
        fosforo: '', potassio: '',
        teor_argila: '', silte: '', areia: ''
    });

    // Valid saving state
    const [saving, setSaving] = useState(false);

    // Load Data
    useEffect(() => {
        if (talhao) {
            setFormData({
                ph_solo: talhao.ph_solo || '',
                materia_organica: talhao.materia_organica || '',
                v_percent: talhao.v_percent || '',
                fosforo: talhao.fosforo || '',
                potassio: talhao.potassio || '',
                teor_argila: talhao.teor_argila || '',
                silte: talhao.silte || '',
                areia: talhao.areia || ''
            });
        }
    }, [talhao, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value };

        // --- Lógica de Auto-Cálculo da Textura (Triangulação) ---
        // Agora calcula REMOVENDO o excesso do terceiro elemento, mesmo se ele já existir.
        if (['teor_argila', 'silte', 'areia'].includes(name)) {
            const totalTarget = unitMode === 'percent' ? 100 : 1000;

            const getVal = (k: string) => {
                const raw = newFormData[k as keyof typeof newFormData];
                if (raw === '' || raw === undefined) return NaN;
                return parseFloat(String(raw).replace(',', '.')) || 0;
            };

            const argila = getVal('teor_argila');
            const silte = getVal('silte');
            const areia = getVal('areia');

            const isVal = (n: number) => !isNaN(n);

            if (name === 'teor_argila') {
                // Mudou Argila: Ajusta Areia (se Silte existir), senão Ajusta Silte (se Areia existir)
                if (isVal(silte)) {
                    newFormData.areia = Math.max(0, totalTarget - argila - silte).toString().replace('.', ',');
                } else if (isVal(areia)) {
                    newFormData.silte = Math.max(0, totalTarget - argila - areia).toString().replace('.', ',');
                }
            } else if (name === 'silte') {
                // Mudou Silte: Ajusta Areia (se Argila existir)
                if (isVal(argila)) {
                    newFormData.areia = Math.max(0, totalTarget - argila - silte).toString().replace('.', ',');
                } else if (isVal(areia)) {
                    newFormData.teor_argila = Math.max(0, totalTarget - silte - areia).toString().replace('.', ',');
                }
            } else if (name === 'areia') {
                // Mudou Areia: Ajusta Silte (se Argila existir)
                if (isVal(argila)) {
                    newFormData.silte = Math.max(0, totalTarget - argila - areia).toString().replace('.', ',');
                } else if (isVal(silte)) {
                    newFormData.teor_argila = Math.max(0, totalTarget - silte - areia).toString().replace('.', ',');
                }
            }
        }

        setFormData(newFormData);
    };

    const handleSave = async () => {
        if (!talhao) return;
        setSaving(true);
        try {
            // Safe Number Parsing (Comma support)
            const parseNum = (val: any) => {
                if (!val && val !== 0) return null;
                return parseFloat(String(val).replace(',', '.'));
            };

            const payload = {
                ph_solo: parseNum(formData.ph_solo),
                v_percent: parseNum(formData.v_percent),
                materia_organica: parseNum(formData.materia_organica),
                fosforo: parseNum(formData.fosforo),
                potassio: parseNum(formData.potassio),
                teor_argila: parseNum(formData.teor_argila),
                silte: parseNum(formData.silte),
                areia: parseNum(formData.areia)
            };

            // Using locationService as confirmed in project structure
            await locationService.updateTalhao(talhao.id, payload);

            setIsEditing(false);
            if (onUpdateStart) onUpdateStart();
            setSnackbar({ open: true, message: "Dados salvos com sucesso!", severity: 'success' });

        } catch (error: any) {
            console.error(error);
            const msg = error.message || "Erro desconhecido ao salvar.";
            setSnackbar({ open: true, message: `Erro ao salvar: ${msg}`, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (!talhao) return null;

    // --- CÁLCULOS VISUAIS ---
    const argilaVal = parseFloat(String(formData.teor_argila).replace(',', '.')) || 0;
    const silteVal = parseFloat(String(formData.silte).replace(',', '.')) || 0;
    const areiaVal = parseFloat(String(formData.areia).replace(',', '.')) || 0;

    const argilaPct = unitMode === 'g_kg' ? argilaVal / 10 : argilaVal;
    const siltePct = unitMode === 'g_kg' ? silteVal / 10 : silteVal; // Needed for linear progress
    const areiaPct = unitMode === 'g_kg' ? areiaVal / 10 : areiaVal;

    const classificacao = getSoilClassification(argilaPct, areiaPct);

    const total = argilaVal + silteVal + areiaVal;
    const baseEsperada = unitMode === 'percent' ? 100 : 1000;
    // Tolerância 0.5 para floats
    const isTotalCorrect = Math.abs(total - baseEsperada) < 0.5;

    // Helper for Canteiro Icons
    const getIcon = (nome: string) => {
        const lower = nome.toLowerCase();
        if (lower.includes('tanque') || lower.includes('água')) return <WaterDropIcon color="primary" />;
        if (lower.includes('linha') || lower.includes('saf')) return <ForestIcon color="warning" />;
        return <GrassIcon color="success" />;
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
            PaperProps={{ sx: { width: { xs: '100%', md: 500 }, display: 'flex', flexDirection: 'column' } }}
        >
            {/* Header */}
            {/* --- HEADER COM NAVEGAÇÃO MOBILE --- */}
            <Box
                p={2}
                borderBottom={`1px solid ${theme.palette.divider}`}
                display="flex"
                alignItems="center"
                gap={1}
            >
                <IconButton onClick={onClose} edge="start" aria-label="voltar">
                    <ArrowBackIcon />
                </IconButton>

                <Box flexGrow={1}>
                    <Typography variant="h6" lineHeight={1.2}>
                        {talhao.nome || 'Talhão Sem Nome'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                        {talhao.area_ha ? `${talhao.area_ha} ha` : `${talhao.area_total_m2 || 0} m²`} • {talhao.cultura || 'Sem cultura'}
                    </Typography>
                </Box>

                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} variant="fullWidth">
                    <Tab icon={<GrassIcon fontSize="small" />} label="Estrutura" iconPosition="start" />
                    <Tab icon={<ScienceIcon fontSize="small" />} label="Saúde Solo" iconPosition="start" />
                </Tabs>
            </Box>

            <Box sx={{ p: 0, flexGrow: 1, overflowY: 'auto' }}>

                {/* === TAB 0: STRUCTURE === */}
                {tabIndex === 0 && (
                    <Box sx={{ p: 0 }}>
                        {(!talhao.canteiros || talhao.canteiros.length === 0) ? (
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <GrassIcon sx={{ fontSize: 40, opacity: 0.2 }} />
                                <Typography variant="body1">Nenhum canteiro ou linha cadastrados.</Typography>
                                <Button variant="text" onClick={handleOpenCreateModal} sx={{ mt: 1 }}>Adicionar Agora</Button>
                            </Box>
                        ) : (
                            <List>
                                <Box sx={{ px: 2, py: 1, bgcolor: '#f0fdf4', display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <Typography variant="caption" color="success.main" fontWeight="bold">
                                        {talhao.canteiros.length} ESTRUTURAS REGISTRADAS
                                    </Typography>
                                </Box>
                                {talhao.canteiros.map((canteiro: any) => (
                                    <ListItem
                                        key={canteiro.id}
                                        divider
                                        secondaryAction={
                                            <Tooltip title="Excluir Permanentemente">
                                                <IconButton edge="end" aria-label="delete" onClick={() => onDeleteCanteiro(canteiro.id)}>
                                                    <DeleteIcon color="error" fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        }
                                    >
                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                            {getIcon(canteiro.nome)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={canteiro.nome}
                                            secondary={canteiro.status !== 'ativo' ? `Status: ${canteiro.status}` : null}
                                            primaryTypographyProps={{ fontWeight: 500 }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                        {/* Footer for Tab 0 */}
                        <Box sx={{ p: 2, borderTop: '1px solid #eee', textAlign: 'right', mt: 2 }}>
                            <Fab color="primary" variant="extended" size="medium" onClick={handleOpenCreateModal}>
                                <AddIcon sx={{ mr: 1 }} />
                                Novo Canteiro
                            </Fab>
                        </Box>
                    </Box>
                )}

                {/* === TAB 1: SOIL HEALTH === */}
                {tabIndex === 1 && (
                    <Box sx={{ p: 3 }}>

                        {/* Title & Action */}
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                                <SpaIcon color="success" /> Saúde do Solo
                            </Typography>
                            <Button
                                startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                                variant={isEditing ? "contained" : "outlined"}
                                onClick={isEditing ? handleSave : () => setIsEditing(true)}
                                disabled={saving}
                                color="primary"
                            >
                                {isEditing ? (saving ? "Salvando..." : "Salvar") : "Editar"}
                            </Button>
                        </Box>

                        {isEditing ? (
                            // --- EDIT FORM ---
                            <Box display="flex" flexDirection="column" gap={2}>
                                <Alert severity="info" sx={{ mb: 1 }}>
                                    Insira os dados da sua análise de solo.
                                </Alert>

                                <Typography variant="subtitle2" fontWeight="bold">Química</Typography>
                                <Grid container spacing={2}>
                                    <Grid xs={4}>
                                        <TextField label="pH (H₂O)" name="ph_solo" value={formData.ph_solo} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                    <Grid xs={4}>
                                        <TextField label="M.O. (%)" name="materia_organica" value={formData.materia_organica} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                    <Grid xs={4}>
                                        <TextField label="V (%)" name="v_percent" value={formData.v_percent} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                </Grid>

                                <Typography variant="subtitle2" fontWeight="bold" mt={1}>Nutrientes (mg/dm³)</Typography>
                                <Grid container spacing={2}>
                                    <Grid xs={6}>
                                        <TextField label="Fósforo (P)" name="fosforo" value={formData.fosforo} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                    <Grid xs={6}>
                                        <TextField label="Potássio (K)" name="potassio" value={formData.potassio} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                </Grid>

                                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                    <Typography variant="subtitle2" fontWeight="bold">Física (Textura)</Typography>
                                    <ToggleButtonGroup
                                        value={unitMode}
                                        exclusive
                                        onChange={(e, newMode) => newMode && setUnitMode(newMode)}
                                        size="small"
                                        color="primary"
                                    >
                                        <ToggleButton value="percent">%</ToggleButton>
                                        <ToggleButton value="g_kg">g/kg</ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>

                                <Grid container spacing={2}>
                                    <Grid xs={4}>
                                        <TextField label="Argila" name="teor_argila" value={formData.teor_argila} onChange={handleChange} fullWidth size="small" type="number" color="warning" focused />
                                    </Grid>
                                    <Grid xs={4}>
                                        <TextField label="Silte" name="silte" value={formData.silte} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                    <Grid xs={4}>
                                        <TextField label="Areia" name="areia" value={formData.areia} onChange={handleChange} fullWidth size="small" type="number" />
                                    </Grid>
                                </Grid>

                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Chip label={classificacao} color="secondary" size="small" />
                                    <Typography variant="caption" color={isTotalCorrect ? "success.main" : "error.main"} fontWeight="bold">
                                        Total: {total.toFixed(1)} / {baseEsperada}
                                    </Typography>
                                </Box>
                            </Box>
                        ) : (
                            // --- VIEW MODE ---
                            <Box display="flex" flexDirection="column" gap={3}>
                                {/* Química */}
                                <Box>
                                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="body2">pH (Água)</Typography>
                                        <Typography fontWeight="bold">{formData.ph_solo || '-'}</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={Math.min((Number(formData.ph_solo) / 8) * 100, 100)} color="success" sx={{ height: 8, borderRadius: 4 }} />

                                    <Box display="flex" justifyContent="space-between" mt={2} mb={0.5}>
                                        <Typography variant="body2">Saturação por Bases (V%)</Typography>
                                        <Typography fontWeight="bold">{formData.v_percent || '-'}%</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={Number(formData.v_percent) || 0} color="primary" sx={{ height: 8, borderRadius: 4 }} />
                                </Box>

                                {/* Cards de Nutrientes */}
                                <Grid container spacing={2}>
                                    <Grid xs={6}>
                                        <Box bgcolor={theme.palette.grey[100]} p={2} borderRadius={2}>
                                            <Typography variant="caption" color="textSecondary">Fósforo (P)</Typography>
                                            <Typography variant="h6" fontWeight="bold">{formData.fosforo || '-'} <Typography component="span" variant="caption">mg/dm³</Typography></Typography>
                                        </Box>
                                    </Grid>
                                    <Grid xs={6}>
                                        <Box bgcolor={theme.palette.grey[100]} p={2} borderRadius={2}>
                                            <Typography variant="caption" color="textSecondary">Potássio (K)</Typography>
                                            <Typography variant="h6" fontWeight="bold">{formData.potassio || '-'} <Typography component="span" variant="caption">mg/dm³</Typography></Typography>
                                        </Box>
                                    </Grid>
                                </Grid>

                                {/* Textura */}
                                <Box border={`1px solid ${theme.palette.divider}`} p={2} borderRadius={2}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                        <Typography variant="subtitle2" fontWeight="bold">Textura & Física</Typography>
                                        <Chip label={classificacao} sx={{ bgcolor: '#795548', color: 'white', fontWeight: 'bold' }} size="small" />
                                    </Box>

                                    {/* Barra de Textura Empilhada */}
                                    <Box display="flex" height={20} borderRadius={1} overflow="hidden" width="100%">
                                        <Tooltip title={`Argila: ${argilaVal}%`}><Box width={`${Math.min(argilaPct, 100)}%`} bgcolor="#795548" /></Tooltip>
                                        <Tooltip title={`Silte: ${silteVal}%`}><Box width={`${Math.min(siltePct, 100)}%`} bgcolor="#A1887F" /></Tooltip>
                                        <Tooltip title={`Areia: ${areiaPct}%`}><Box width={`${Math.min(areiaPct, 100)}%`} bgcolor="#D7CCC8" /></Tooltip>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between" mt={1}>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box width={8} height={8} bgcolor="#795548" borderRadius="50%" /> Argila</Typography>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box width={8} height={8} bgcolor="#A1887F" borderRadius="50%" /> Silte</Typography>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box width={8} height={8} bgcolor="#D7CCC8" borderRadius="50%" /> Areia</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>


            {/* --- CREATE MODAL --- */}
            <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Nova Estrutura</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>

                        {/* Type Selection */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">Tipo de Estrutura</FormLabel>
                            <RadioGroup
                                row
                                value={batchData.type}
                                onChange={(e) => setBatchData({ ...batchData, type: e.target.value })}
                            >
                                <FormControlLabel value="canteiro" control={<Radio />} label="Canteiro" />
                                <FormControlLabel value="linha" control={<Radio />} label="Linha (SAF)" />
                                <FormControlLabel value="tanque" control={<Radio />} label="Tanque" />
                            </RadioGroup>
                        </FormControl>

                        {/* Basic Info */}
                        <TextField
                            label={batchData.isBatch ? "Nome Base (ex: Linha de Café)" : "Nome da Estrutura"}
                            fullWidth
                            value={batchData.baseName}
                            onChange={(e) => setBatchData({ ...batchData, baseName: e.target.value })}
                            placeholder={batchData.isBatch ? "Ex: Linha" : "Ex: Canteiro 1"}
                        />

                        {/* Dimensions */}
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Largura (m)"
                                type="number"
                                fullWidth
                                value={batchData.width}
                                onChange={(e) => setBatchData({ ...batchData, width: e.target.value })}
                            />
                            <TextField
                                label="Comprimento (m)"
                                type="number"
                                fullWidth
                                value={batchData.length}
                                onChange={(e) => setBatchData({ ...batchData, length: e.target.value })}
                            />
                        </Box>

                        {/* Batch Switch */}
                        <Box display="flex" alignItems="center" justifyContent="space-between" bgcolor="#f5f5f5" p={1} borderRadius={1}>
                            <Typography variant="body2" fontWeight="bold">Gerar Múltiplos</Typography>
                            <Switch
                                checked={batchData.isBatch}
                                onChange={(e) => setBatchData({ ...batchData, isBatch: e.target.checked })}
                            />
                        </Box>

                        {/* Batch Fields */}
                        {batchData.isBatch && (
                            <Box display="flex" gap={2} bgcolor="#e8f5e9" p={2} borderRadius={1} flexDirection="column">
                                <Box display="flex" gap={2}>
                                    <TextField
                                        label="Quantidade"
                                        type="number"
                                        fullWidth
                                        value={batchData.quantity}
                                        onChange={(e) => setBatchData({ ...batchData, quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                                    />
                                    <TextField
                                        label="Nº Inicial"
                                        type="number"
                                        fullWidth
                                        value={batchData.startNumber}
                                        onChange={(e) => setBatchData({ ...batchData, startNumber: Math.max(0, parseInt(e.target.value) || 0) })}
                                    />
                                </Box>
                                <Typography variant="caption" color="textSecondary">
                                    Serão criadas {batchData.quantity} estruturas: "{batchData.baseName || 'Item'} {batchData.startNumber}" até "{batchData.baseName || 'Item'} {batchData.startNumber + batchData.quantity - 1}"
                                </Typography>
                            </Box>
                        )}

                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBatchSave} variant="contained" color="primary">
                        {batchData.isBatch ? `Gerar ${batchData.quantity} items` : 'Criar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>

        </Drawer >
    );
};

export default TalhaoDetailsDrawer;
