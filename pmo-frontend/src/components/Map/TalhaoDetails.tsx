// src/components/Map/TalhaoDetails.tsx

import React, { useState, useEffect, ReactNode, SyntheticEvent } from 'react';
import { Box, Typography, Tabs, Tab, Paper, CircularProgress, Chip, Stack, IconButton, Card, Tooltip, Grid, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import HistoryIcon from '@mui/icons-material/History';
import LayersIcon from '@mui/icons-material/Layers';
import BiotechIcon from '@mui/icons-material/Biotech';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { analiseService } from '../../services/analiseService';
import { soilLogic } from '../../utils/soilLogic';
import AnaliseFormDialog from './AnaliseFormDialog';

// Types
interface Analise {
    id?: string;
    data_analise?: string;
    ph?: number;
    fosforo?: number;
    potassio?: number;
    calcio?: number;
    magnesio?: number;
    saturacao_bases?: number;
    materia_organica?: number;
    argila?: number;
    areia?: number;
    silte?: number;
}

interface Talhao {
    id: string;
    nome: string;
    cultura?: string;
    area_ha?: number;
}

interface NutrientGaugeProps {
    label: string;
    value?: number;
    unit: string;
    ideal?: number;
    max?: number;
}

interface TabPanelProps {
    children: ReactNode;
    value: number;
    index: number;
}

interface TalhaoDetailsProps {
    talhao: Talhao | null;
    onBack?: () => void;
}

const NutrientGauge: React.FC<NutrientGaugeProps> = ({ label, value, unit, ideal, max = 100 }) => {
    const numValue = value || 0;
    const percentage = Math.min((numValue / (ideal ? ideal * 1.5 : max)) * 100, 100);
    const idealPos = ideal ? (ideal / (ideal * 1.5)) * 100 : null;
    const bgGradient = 'linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #10b981 80%, #059669 100%)';

    return (
        <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'flex-end' }}>
                <Typography variant="body2" fontWeight={600} color="text.secondary">{label}</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1rem', lineHeight: 1 }}>
                    {numValue} <span style={{ fontSize: '0.7em', fontWeight: 500, color: '#9ca3af' }}>{unit}</span>
                </Typography>
            </Box>
            <Box sx={{ position: 'relative', height: 12, bgcolor: '#e2e8f0', borderRadius: 6, mb: 1, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${percentage}%`, background: bgGradient, borderRadius: 6, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                <Box sx={{ position: 'absolute', left: `${percentage}%`, top: -2, height: 16, width: 4, bgcolor: '#1e293b', transform: 'translateX(-50%)', borderRadius: 1, zIndex: 2, border: '1px solid white' }} />
                {idealPos && (
                    <Tooltip title={`Meta Ideal: ${ideal} ${unit}`}>
                        <Box sx={{ position: 'absolute', left: `${idealPos}%`, top: -4, zIndex: 3, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box sx={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #3b82f6' }} />
                            <Box sx={{ width: 1, height: 16, bgcolor: '#3b82f6', opacity: 0.5 }} />
                        </Box>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
};

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
    <div hidden={value !== index} style={{ height: '100%', overflowY: 'auto' }}>
        {value === index && <Box sx={{ p: 3, pb: 10 }}>{children}</Box>}
    </div>
);

const TalhaoDetails: React.FC<TalhaoDetailsProps> = ({ talhao, onBack }) => {
    const [tabValue, setTabValue] = useState(1);
    const [analise, setAnalise] = useState<Analise | null>(null);
    const [loading, setLoading] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [editingData, setEditingData] = useState<Analise | null>(null);

    const fetchAnalise = async () => {
        if (!talhao?.id) return;
        setLoading(true);
        try {
            const data = await analiseService.getLatestAnalise(talhao.id);
            setAnalise(data);
        } catch (error) {
            console.error("Erro ao carregar análise:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnalise(); }, [talhao?.id]);

    const handleOpenNew = () => { setEditingData(null); setOpenForm(true); };
    const handleOpenEdit = () => { setEditingData(analise); setOpenForm(true); };

    if (!talhao) return null;

    const targets = soilLogic.getCropTargets(talhao.cultura);
    const classificacaoSolo = analise ? soilLogic.getClassificacaoTextural(analise.argila) : '';

    const getNutrientesList = (dados: Analise | null): NutrientGaugeProps[] => {
        if (!dados) return [];
        return [
            { label: 'pH (H₂O)', value: dados.ph, ideal: targets.ph_ideal, unit: '', max: 14 },
            { label: 'Saturação (V%)', value: dados.saturacao_bases, ideal: targets.v_ideal, unit: '%', max: 100 },
            { label: 'Fósforo (P)', value: dados.fosforo, ideal: 15, unit: 'mg/dm³', max: 100 },
            { label: 'Potássio (K)', value: dados.potassio, ideal: 120, unit: 'mg/dm³', max: 300 },
            { label: 'Cálcio (Ca)', value: dados.calcio, ideal: 3, unit: 'cmol', max: 10 },
            { label: 'Magnésio (Mg)', value: dados.magnesio, ideal: 1, unit: 'cmol', max: 5 },
            { label: 'Matéria Orgânica', value: dados.materia_organica, ideal: 3, unit: '%', max: 10 },
        ].filter(n => n.value != null);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc' }}>
            <Paper elevation={0} sx={{ p: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 2, borderRadius: 0, bgcolor: 'white', zIndex: 10 }}>
                {onBack && <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>}
                <Box>
                    <Typography variant="h6" fontWeight={800} lineHeight={1}>{talhao.nome}</Typography>
                    <Typography variant="caption" color="text.secondary">{talhao.cultura || 'Cultura não definida'} • {Number(talhao.area_ha).toFixed(2)} ha</Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="Nova Análise"><IconButton size="small" onClick={handleOpenNew} sx={{ bgcolor: '#eff6ff', color: '#3b82f6', '&:hover': { bgcolor: '#dbeafe' } }}><AddIcon /></IconButton></Tooltip>
            </Paper>

            <Paper elevation={0} square sx={{ zIndex: 9 }}>
                <Tabs value={tabValue} onChange={(_: SyntheticEvent, v: number) => setTabValue(v)} variant="fullWidth" sx={{ '& .MuiTab-root': { fontWeight: 600, fontSize: '0.8rem' } }}>
                    <Tab label="Geral" />
                    <Tab label="Saúde do Solo" icon={<ScienceIcon fontSize="small" />} iconPosition="start" />
                    <Tab label="Histórico" icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
                </Tabs>
            </Paper>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', bgcolor: '#f8fafc', height: 'calc(100% - 110px)' }}>
                <TabPanel value={tabValue} index={1}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
                    ) : !analise ? (
                        <Box sx={{ textAlign: 'center', p: 4, mt: 4 }}>
                            <ScienceIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 2, opacity: 0.5 }} />
                            <Typography variant="h6" color="text.secondary" fontWeight={600} gutterBottom>Sem dados recentes</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Cadastre sua primeira análise de solo para gerar insights.</Typography>
                            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew} sx={{ borderRadius: 8, textTransform: 'none', fontWeight: 700, px: 4, boxShadow: '0 4px 14px rgba(37,99,235,0.2)' }}>Registrar Análise</Button>
                        </Box>
                    ) : (
                        <>
                            <Card elevation={0} sx={{ p: 3, mb: 3, borderRadius: 4, border: '1px solid #e2e8f0', background: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline" color="primary" fontWeight={800} letterSpacing={1}>SATURAÇÃO POR BASES (V%)</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                        <Typography variant="h3" fontWeight={800} color="#0f172a">{analise.saturacao_bases ? Math.round(analise.saturacao_bases) : '-'}</Typography>
                                        <Typography variant="h5" color="text.secondary" fontWeight={500}>%</Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                        <Chip label={analise.saturacao_bases && analise.saturacao_bases >= targets.v_ideal ? 'ALTA FERTILIDADE' : 'ABAIXO DA META'} size="small" color={analise.saturacao_bases && analise.saturacao_bases >= targets.v_ideal ? 'success' : 'warning'} sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                                        <Typography variant="caption" color="text.secondary">Meta: {targets.v_ideal}%</Typography>
                                    </Stack>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                    <Tooltip title="Editar Dados"><IconButton onClick={handleOpenEdit} sx={{ bgcolor: 'white', border: '1px solid #e2e8f0' }}><EditIcon fontSize="small" color="action" /></IconButton></Tooltip>
                                    <Typography variant="caption" color="text.secondary">Data: {new Date(analise.data_analise || '').toLocaleDateString()}</Typography>
                                </Box>
                            </Card>

                            <Typography variant="subtitle2" fontWeight={800} color="#334155" sx={{ mb: 2, display: 'flex', letterSpacing: 0.5 }}><BiotechIcon fontSize="small" sx={{ mr: 1, color: '#3b82f6' }} /> QUÍMICA DO SOLO</Typography>

                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                {getNutrientesList(analise).map((n, i) => (
                                    <Grid item xs={12} sm={6} key={i}>
                                        <Card elevation={0} sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: 3, height: '100%' }}><NutrientGauge {...n} /></Card>
                                    </Grid>
                                ))}
                            </Grid>

                            <Typography variant="subtitle2" fontWeight={800} color="#334155" sx={{ mb: 2, display: 'flex', letterSpacing: 0.5 }}><LayersIcon fontSize="small" sx={{ mr: 1, color: '#d97706' }} /> TEXTURA FÍSICA</Typography>

                            <Card elevation={0} sx={{ p: 3, border: '1px solid #f1f5f9', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">Classificação</Typography>
                                    <Chip label={classificacaoSolo} sx={{ bgcolor: '#451a03', color: 'white', fontWeight: 700, fontSize: '0.75rem', height: 24 }} />
                                </Box>
                                <Box sx={{ display: 'flex', height: 40, borderRadius: 2, overflow: 'hidden', mb: 3, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <Tooltip title={`Argila: ${analise.argila}%`}><Box sx={{ width: `${analise.argila || 0}%`, bgcolor: '#5D4037', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 1s' }}>{(analise.argila || 0) > 15 && <Typography variant="caption" color="rgba(255,255,255,0.8)" fontWeight={700}>{analise.argila}%</Typography>}</Box></Tooltip>
                                    <Tooltip title={`Silte: ${analise.silte}%`}><Box sx={{ width: `${analise.silte || 0}%`, bgcolor: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 1s' }}>{(analise.silte || 0) > 15 && <Typography variant="caption" color="white" fontWeight={700}>{analise.silte}%</Typography>}</Box></Tooltip>
                                    <Tooltip title={`Areia: ${analise.areia}%`}><Box sx={{ width: `${analise.areia || 0}%`, bgcolor: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 1s' }}>{(analise.areia || 0) > 15 && <Typography variant="caption" color="#451a03" fontWeight={700}>{analise.areia}%</Typography>}</Box></Tooltip>
                                </Box>
                                <Stack direction="row" spacing={3} justifyContent="center" sx={{ bgcolor: '#f8fafc', p: 1, borderRadius: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#5D4037' }} /><Typography variant="caption" fontWeight={600} color="text.secondary">Argila</Typography></Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#94a3b8' }} /><Typography variant="caption" fontWeight={600} color="text.secondary">Silte</Typography></Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#fbbf24' }} /><Typography variant="caption" fontWeight={600} color="text.secondary">Areia</Typography></Box>
                                </Stack>
                            </Card>
                        </>
                    )}
                </TabPanel>
                <TabPanel value={tabValue} index={0}><Box sx={{ p: 4 }}><Typography color="text.secondary" align="center">Em breve: Histórico de Culturas</Typography></Box></TabPanel>
                <TabPanel value={tabValue} index={2}><Box sx={{ p: 4 }}><Typography color="text.secondary" align="center">Em breve: Gráficos de Evolução</Typography></Box></TabPanel>
            </Box>

            <AnaliseFormDialog open={openForm} onClose={() => setOpenForm(false)} talhaoId={talhao.id} initialData={editingData} onSaveSuccess={() => { fetchAnalise(); setOpenForm(false); }} />
        </Box>
    );
};

export default TalhaoDetails;
