// src/pages/DashboardPage_MUI.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Typography, Paper, Button, Chip, Skeleton, LinearProgress } from '@mui/material';

import HarvestDashboard from '../components/Dashboard/HarvestDashboard';
import PlanoAtualCard from '../components/Dashboard/PlanoAtualCard';
import ManualRecordDialog from '../components/Dashboard/ManualRecordDialog';
import WhatsappConnectDialog from '../components/Dashboard/WhatsappConnectDialog';

import { supabase } from '../supabaseClient';


import { Plus, Settings, Smartphone, CloudSun, MapPin, CloudRain, Link, Unlink } from 'lucide-react';

import { useDashboardLogic } from '../hooks/dashboard/useDashboardLogic';
import { WeatherData } from '../services/weatherService';
import { unlinkWhatsapp } from '../services/whatsappService';
import { formatarTelefone, formatarDataRelativa, obterSaudacao } from '../utils/formatters';

// Card Style Shared
const cardStyle = {
    borderRadius: '24px',
    boxShadow: '0px 10px 30px rgba(0,0,0,0.04)',
    border: '1px solid rgba(255,255,255,0.6)',
    bgcolor: '#ffffff',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0px 20px 40px rgba(0,0,0,0.06)',
    }
};

// Weather Widget (In-memory component)
const WeatherWidget: React.FC<{ weather: WeatherData | null; loading: boolean }> = ({ weather, loading }) => {
    if (loading || !weather) return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: '24px' }} />;

    const { current, daily } = weather;
    const temp = current.temperature;
    const humidity = current.humidity;
    const rainChance = daily.rainChance;

    return (
        <Paper sx={{ ...cardStyle, p: 3, background: 'linear-gradient(135deg, #e0f7fa 0%, #ffffff 100%)', border: '1px solid #b2ebf2' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#006064' }}>{temp}°C</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <MapPin size={14} color="#00838f" />
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#00838f', textTransform: 'uppercase' }}>LOCAL ATUAL</Typography>
                    </Box>
                </Box>
                <CloudSun size={32} color="#00bcd4" />
            </Box>

            <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(0,131,143,0.1)', pt: 2 }}>
                <Box>
                    <Typography variant="caption" color="#0097a7" fontWeight={600} display="block">Umidade</Typography>
                    <Typography variant="body2" fontWeight={700} color="#006064">{humidity}%</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="#0097a7" fontWeight={600} display="block">Chuva (Hoje)</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                        <CloudRain size={16} color={rainChance && rainChance > 50 ? "#0288d1" : "#00bcd4"} />
                        <Typography variant="body2" fontWeight={700} color="#006064">{rainChance}%</Typography>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};

const DashboardPageMUI: React.FC = () => {
    const { user, profile: authProfile } = useAuth();
    const navigate = useNavigate();
    const [openRecordDialog, setOpenRecordDialog] = useState(false);
    const [openWhatsappDialog, setOpenWhatsappDialog] = useState(false);

    // DB Probe for Debugging
    // DB Probe for Debugging
    const [dbProbe, setDbProbe] = useState<any>(null);
    React.useEffect(() => {
        if (user?.id) {
            supabase.from('profiles').select('*').eq('id', user.id).single()
                .then(res => setDbProbe(res));
        }
    }, [user]);


    // Conectando o cérebro
    const {
        weather,
        harvestStats,
        lastActivity,
        recentActivities,
        pmoId,
        pmoName,
        pmoVersion,
        userProfile,
        isLoading,
        dataError,
        refreshDashboard
    } = useDashboardLogic();

    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const saudacao = obterSaudacao();

    const pmoIdNumber = pmoId ? Number(pmoId) : 0; // Adaptação para props legadas


    return (
        <Box sx={{ pb: 8, overflowX: 'hidden' }}>
            {/* ... component content ... */}

            {/* Footer Content */}
            {/* ... */}
            {/* We need to insert the probe logic and footer update, but I can't easily target the middle of the file and the end simultaneously without rewriting too much.
           I'll add the logic at the top and the footer update at the bottom in separate steps or one large replacement if safer. 
           Actually, the file is small enough to be safe-ish, but let's be surgical.
           
           Wait, I can just add the state at top and update the footer.
        */}
            <ManualRecordDialog
                open={openRecordDialog}
                onClose={() => setOpenRecordDialog(false)}
                pmoId={pmoIdNumber}
                onRecordSaved={refreshDashboard}
            />

            <WhatsappConnectDialog
                open={openWhatsappDialog}
                onClose={() => setOpenWhatsappDialog(false)}
                userId={user?.id || ''}
                onSuccess={refreshDashboard}
            />

            {/* Header */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: { xs: 2, md: 0 }, mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', mb: 0.5 }}>
                        {saudacao}, {user?.email?.split('@')[0]}! 🚜
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontSize: '1rem' }}>
                        Resumo da produção em <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{hoje}</span>.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: { xs: '100%', sm: 'auto' } }}>
                    <Button variant="outlined" startIcon={<Settings size={18} />} onClick={() => navigate('/planos')} sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, borderColor: '#cbd5e1', color: '#475569', width: { xs: '100%', sm: 'auto' } }}>Gerenciar Planos</Button>
                    <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => setOpenRecordDialog(true)} sx={{ bgcolor: '#16a34a', color: 'white', borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 600, boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)', width: { xs: '100%', sm: 'auto' } }}>Novo Registro</Button>
                </Box>
            </Box>

            {dataError && (
                <Box sx={{ mb: 4, p: 2, bgcolor: '#fef2f2', border: '1px solid #ef4444', borderRadius: 2, color: '#b91c1c' }}>
                    <Typography variant="body1" fontWeight={700}>Erro no carregamento:</Typography>
                    <Typography variant="body2">{dataError}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={refreshDashboard} sx={{ mt: 1 }}>Tentar Novamente</Button>
                </Box>
            )}

            {isLoading && !weather ? <LinearProgress sx={{ mb: 4, borderRadius: 2 }} /> : null}

            {/* Grid Layout */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: { xs: 3, md: 6 }, alignItems: 'flex-start', mb: 4 }}>
                {/* Left Column */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <PlanoAtualCard
                        nomePlano={pmoName}
                        versao={pmoVersion || 1}
                        status="Em andamento"
                        onVer={() => navigate('/caderno')}
                        onEditar={() => navigate('/planos')}
                    />

                    <WeatherWidget weather={weather} loading={isLoading} />

                    <Paper sx={{ ...cardStyle, p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box sx={{ p: 1, bgcolor: userProfile?.telefone ? '#dcfce7' : '#f1f5f9', borderRadius: '10px', color: userProfile?.telefone ? '#16a34a' : '#64748b' }}><Smartphone size={20} /></Box>
                            <Chip label={userProfile?.telefone ? "ATIVO" : "OFFLINE"} color={userProfile?.telefone ? "success" : "default"} size="small" sx={{ fontWeight: 700, borderRadius: 1.5, height: 24 }} />
                        </Box>
                        <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ lineHeight: 1.2 }}>Assistente Inteligente</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 2, display: 'block' }}>{formatarTelefone(userProfile?.telefone)}</Typography>

                        {/* Connection Button or Last Activity */}
                        {!userProfile?.telefone ? (
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<Link size={16} />}
                                onClick={() => setOpenWhatsappDialog(true)}
                                sx={{
                                    mt: 1,
                                    width: '100%',
                                    bgcolor: '#16a34a',
                                    borderRadius: '10px',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    '&:hover': { bgcolor: '#15803d' }
                                }}
                            >
                                Conectar WhatsApp
                            </Button>
                        ) : (
                            <Box>
                                <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', mb: 1.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Última Atividade</Typography>
                                    <Typography variant="body2" color="#0f172a" fontWeight={600}>{formatarDataRelativa(lastActivity)}</Typography>
                                </Box>
                                <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<Unlink size={14} />}
                                    onClick={async () => {
                                        if (window.confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
                                            try {
                                                await unlinkWhatsapp(user?.id || '');
                                                refreshDashboard();
                                            } catch (err) {
                                                alert('Erro ao desconectar. Tente novamente.');
                                            }
                                        }
                                    }}
                                    sx={{
                                        width: '100%',
                                        color: '#ef4444',
                                        textTransform: 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        '&:hover': { bgcolor: '#fef2f2' }
                                    }}
                                >
                                    Desconectar
                                </Button>
                            </Box>
                        )}
                    </Paper>
                </Box>

                {/* Right Column */}
                <Paper sx={{ ...cardStyle, p: 3, minHeight: '100%' }}>
                    {/* Precisamos garantir que HarvestDashboard aceite os dados puros agora */}
                    {/* Como alteramos o HarvestDashboard para ser Dumb, aqui passamos os dados */}
                    <HarvestDashboard
                        harvestStats={harvestStats || {}}
                        recentActivity={recentActivities || []}
                    />
                </Paper>
            </Box>

        </Box>
    );
};

export default DashboardPageMUI;
