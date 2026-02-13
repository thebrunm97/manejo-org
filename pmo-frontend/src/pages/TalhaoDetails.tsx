// src/pages/TalhaoDetails.tsx (Page version)

import React, { useState, SyntheticEvent, ReactNode } from 'react';
import {
    Box, Typography, Tabs, Tab, Paper, CircularProgress, Chip, Stack, IconButton, Card, Divider, Tooltip, Grid
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import HistoryIcon from '@mui/icons-material/History';
import LayersIcon from '@mui/icons-material/Layers';
import BiotechIcon from '@mui/icons-material/Biotech';

// Types
interface Nutriente {
    label: string;
    valor: number;
    ideal: number;
    status: string;
    unit: string;
    color: string;
}

interface Analise {
    data_analise: string;
    profundidade: string;
    iqs: number;
    iqs_label: string;
    quimica: {
        ph: number;
        nutrientes: Nutriente[];
    };
    fisica: {
        argila: number;
        areia: number;
        silte: number;
        classificacao: string;
    };
}

interface Talhao {
    nome: string;
    area_ha?: number;
    area?: number;
    cultura?: string;
}

interface TabPanelProps {
    children: ReactNode;
    value: number;
    index: number;
}

interface NutrientGaugeProps {
    label: string;
    value: number;
    unit: string;
    min?: number;
    max?: number;
    ideal: number;
}

interface TalhaoDetailsProps {
    talhao: Talhao | null;
    onBack?: () => void;
}

// Mock data
const MOCK_ANALISE: Analise = {
    data_analise: '2023-09-15',
    profundidade: '0-20 cm',
    iqs: 78,
    iqs_label: 'Alta Fertilidade',
    quimica: {
        ph: 5.8,
        nutrientes: [
            { label: 'pH (H₂O)', valor: 5.8, ideal: 6.0, status: 'Médio', unit: '', color: 'warning' },
            { label: 'Saturação (V%)', valor: 60, ideal: 70, status: 'Médio', unit: '%', color: 'info' },
            { label: 'Fósforo (P)', valor: 12, ideal: 15, status: 'Baixo', unit: 'mg/dm³', color: 'warning' },
            { label: 'Potássio (K)', valor: 140, ideal: 120, status: 'Alto', unit: 'mg/dm³', color: 'success' }
        ]
    },
    fisica: {
        argila: 55,
        areia: 30,
        silte: 15,
        classificacao: 'MUITO ARGILOSO'
    }
};

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
    <div role="tabpanel" hidden={value !== index} {...other} style={{ height: '100%', overflowY: 'auto' }}>
        {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
);

const NutrientGauge: React.FC<NutrientGaugeProps> = ({ label, value, unit, min = 0, max = 100, ideal }) => {
    const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
    const idealPercentage = Math.min(Math.max(((ideal - min) / (max - min)) * 100, 0), 100);

    let statusLabel = 'Ideal';
    let statusColor = 'success';

    if (value < ideal * 0.8) { statusLabel = 'Baixo'; statusColor = 'warning'; }
    if (value > ideal * 1.2) { statusLabel = 'Alto'; statusColor = 'error'; }
    if (label.includes('pH') && (value < 5.5 || value > 6.5)) { statusLabel = 'Atenção'; statusColor = 'warning'; }

    return (
        <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600} color="text.secondary">{label}</Typography>
                <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ fontSize: '1rem' }}>
                    {value} <span style={{ fontSize: '0.7em', color: '#9ca3af', fontWeight: 400 }}>{unit}</span>
                </Typography>
            </Box>
            <Box sx={{ position: 'relative', height: 8, bgcolor: '#f1f5f9', borderRadius: 4, mb: 1 }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${percentage}%`, bgcolor: (statusColor === 'success' ? '#10b981' : statusColor === 'warning' ? '#f59e0b' : '#ef4444'), borderRadius: 4, transition: 'width 0.5s ease' }} />
                <Box sx={{ position: 'absolute', left: `${idealPercentage}%`, top: -2, height: 12, width: 2, bgcolor: '#111827', zIndex: 1 }} />
            </Box>
            <Chip label={statusLabel} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, border: 'none', bgcolor: statusColor === 'success' ? '#ecfdf5' : '#fffbeb', color: statusColor === 'success' ? '#047857' : '#b45309' }} />
        </Box>
    );
};

const TalhaoDetails: React.FC<TalhaoDetailsProps> = ({ talhao, onBack }) => {
    const [tabValue, setTabValue] = useState(1);

    const handleChange = (_event: SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    if (!talhao) return null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc' }}>
            <Paper elevation={0} sx={{ p: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 2, borderRadius: 0 }}>
                {onBack && (
                    <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
                        <ArrowBackIcon fontSize="small" sx={{ color: '#475569' }} />
                    </IconButton>
                )}
                <Box>
                    <Typography variant="h6" fontWeight={800} color="#0f172a" lineHeight={1.2}>{talhao.nome}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={`${talhao.area_ha || talhao.area || '--'} ha`} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 600 }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>{talhao.cultura || 'Cultura não definida'}</Typography>
                    </Stack>
                </Box>
            </Paper>

            <Paper elevation={0} square sx={{ borderBottom: '1px solid #e2e8f0' }}>
                <Tabs value={tabValue} onChange={handleChange} variant="fullWidth" sx={{ minHeight: 48, '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0', bgcolor: '#16a34a' }, '& .MuiTab-root': { textTransform: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', '&.Mui-selected': { color: '#16a34a' } } }}>
                    <Tab label="Visão Geral" />
                    <Tab label="Saúde do Solo" icon={<ScienceIcon fontSize="small" style={{ marginBottom: 0, marginRight: 6 }} />} iconPosition="start" />
                    <Tab label="Histórico" icon={<HistoryIcon fontSize="small" style={{ marginBottom: 0, marginRight: 6 }} />} iconPosition="start" />
                </Tabs>
            </Paper>

            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <TabPanel value={tabValue} index={0}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>Visão operacional e status atual do talhão.</Typography>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Card elevation={0} sx={{ p: 3, mb: 3, borderRadius: 4, border: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            <CircularProgress variant="determinate" value={100} size={80} sx={{ color: '#e2e8f0', position: 'absolute' }} />
                            <CircularProgress variant="determinate" value={MOCK_ANALISE.iqs} size={80} sx={{ color: '#16a34a', strokeLinecap: 'round' }} />
                            <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="h5" component="div" color="text.primary" fontWeight={800}>{MOCK_ANALISE.iqs}</Typography>
                            </Box>
                        </Box>
                        <Box>
                            <Typography variant="overline" color="success.main" fontWeight={800} letterSpacing={1.2}>ÍNDICE DE QUALIDADE (IQS)</Typography>
                            <Typography variant="h6" fontWeight={700} color="#1e293b" lineHeight={1.2}>{MOCK_ANALISE.iqs_label}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Solo com boa fertilidade geral.</Typography>
                        </Box>
                    </Card>

                    <Typography variant="subtitle2" fontWeight={700} color="#334155" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}><BiotechIcon fontSize="small" /> ANÁLISE QUÍMICA</Typography>

                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        {(MOCK_ANALISE.quimica.nutrientes || []).map((nutriente, index) => (
                            <Grid item xs={12} sm={6} key={index}>
                                <Card elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #f1f5f9', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                    <NutrientGauge label={nutriente.label} value={nutriente.valor} unit={nutriente.unit} ideal={nutriente.ideal} max={nutriente.label.includes('Potássio') ? 300 : 100} />
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="subtitle2" fontWeight={700} color="#334155" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}><LayersIcon fontSize="small" /> COMPOSIÇÃO FÍSICA</Typography>

                    <Card elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" fontWeight={600}>Classe Textural</Typography>
                            <Chip label={MOCK_ANALISE.fisica.classificacao} size="small" sx={{ bgcolor: '#451a03', color: '#fff', fontWeight: 700, fontSize: '0.7rem' }} />
                        </Box>
                        <Box sx={{ display: 'flex', height: 28, borderRadius: 3, overflow: 'hidden', width: '100%', mb: 2, border: '2px solid white', boxShadow: '0 0 0 1px #e2e8f0' }}>
                            <Tooltip title={`Argila: ${MOCK_ANALISE.fisica.argila}%`}><Box sx={{ width: `${MOCK_ANALISE.fisica.argila}%`, bgcolor: '#5D4037' }} /></Tooltip>
                            <Tooltip title={`Silte: ${MOCK_ANALISE.fisica.silte}%`}><Box sx={{ width: `${MOCK_ANALISE.fisica.silte}%`, bgcolor: '#9E9E9E' }} /></Tooltip>
                            <Tooltip title={`Areia: ${MOCK_ANALISE.fisica.areia}%`}><Box sx={{ width: `${MOCK_ANALISE.fisica.areia}%`, bgcolor: '#FBC02D' }} /></Tooltip>
                        </Box>
                        <Stack direction="row" justifyContent="space-around" alignItems="center">
                            <Box sx={{ textAlign: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#5D4037', mx: 'auto', mb: 0.5 }} /><Typography variant="caption" fontWeight={600}>Argila {MOCK_ANALISE.fisica.argila}%</Typography></Box>
                            <Divider orientation="vertical" flexItem sx={{ height: 20, alignSelf: 'center' }} />
                            <Box sx={{ textAlign: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#9E9E9E', mx: 'auto', mb: 0.5 }} /><Typography variant="caption" fontWeight={600}>Silte {MOCK_ANALISE.fisica.silte}%</Typography></Box>
                            <Divider orientation="vertical" flexItem sx={{ height: 20, alignSelf: 'center' }} />
                            <Box sx={{ textAlign: 'center' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#FBC02D', mx: 'auto', mb: 0.5 }} /><Typography variant="caption" fontWeight={600}>Areia {MOCK_ANALISE.fisica.areia}%</Typography></Box>
                        </Stack>
                    </Card>

                    <Box sx={{ mt: 3, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled">Análise de {new Date(MOCK_ANALISE.data_analise).toLocaleDateString()}</Typography>
                    </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>Rastreabilidade completa do talhão.</Typography>
                </TabPanel>
            </Box>
        </Box>
    );
};

export default TalhaoDetails;
