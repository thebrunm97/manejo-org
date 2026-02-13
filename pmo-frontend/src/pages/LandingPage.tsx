import React from 'react';
import { Box, Container, Typography, Button, Grid, Card, CardContent, useTheme, useMediaQuery, AppBar, Toolbar, Stack } from '@mui/material';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatIcon from '@mui/icons-material/Chat';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SpeedIcon from '@mui/icons-material/Speed';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LandingPage: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* AppBar */}
            <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AgricultureIcon color="primary" sx={{ fontSize: 32 }} />
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                                Manejo Orgânico App
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {user ? (
                                <Button variant="contained" color="primary" onClick={() => navigate('/dashboard')}>
                                    Ir para o Dashboard
                                </Button>
                            ) : (
                                <>
                                    <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
                                    <Button variant="contained" color="primary" onClick={() => navigate('/cadastro')}>
                                        Criar Conta
                                    </Button>
                                </>
                            )}
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            {/* Hero Section */}
            <Box sx={{
                bgcolor: 'background.paper',
                pt: { xs: 8, md: 12 },
                pb: { xs: 8, md: 12 },
                position: 'relative',
                overflow: 'hidden'
            }}>
                <Container maxWidth="lg">
                    <Grid container spacing={4} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography variant="h2" component="h1" fontWeight="800" gutterBottom sx={{
                                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                backgroundClip: 'text',
                                textFillColor: 'transparent',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                Gestão Agrícola Orgânica Inteligente
                            </Typography>
                            <Typography variant="h5" color="text.secondary" paragraph sx={{ mb: 4, fontWeight: 400 }}>
                                Otimize suas práticas com nosso WhatsApp Bot e Dashboard Web integrado. Conformidade, eficiência e dados em um só lugar.
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                {user ? (
                                    <Button variant="contained" color="primary" size="large" onClick={() => navigate('/dashboard')} sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
                                        Acessar Sistema
                                    </Button>
                                ) : (
                                    <Button variant="contained" color="primary" size="large" onClick={() => navigate('/cadastro')} sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
                                        Começar Agora
                                    </Button>
                                )}
                                <Button variant="outlined" color="primary" size="large" onClick={() => navigate('/login')} sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
                                    {user ? 'Sair' : 'Ver Demonstração'}
                                </Button>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' }, position: 'relative' }}>
                            {/* Abstract Illustration Placeholder */}
                            <Box sx={{
                                width: '100%',
                                height: 400,
                                borderRadius: 4,
                                bgcolor: 'primary.light',
                                opacity: 0.1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <AgricultureIcon sx={{ fontSize: 200, color: 'primary.main', opacity: 0.5 }} />
                            </Box>
                            {/* Floating Cards Effect */}
                            <Card sx={{ position: 'absolute', top: 40, right: -20, width: 200, boxShadow: 3, animation: 'float 3s ease-in-out infinite' }}>
                                <CardContent>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <ChatIcon color="success" />
                                        <Typography variant="subtitle2" fontWeight="bold">+150 Conversas</Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">IA registrando dados...</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Features Section */}
            <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
                <Container maxWidth="lg">
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={4}>
                            <Card elevation={0} sx={{ height: '100%', bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'primary.light', width: 'fit-content', color: 'common.white' }}>
                                        <ChatIcon fontSize="large" sx={{ color: 'primary.dark' }} />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>Bot Inteligente</Typography>
                                    <Typography color="text.secondary">
                                        Simplifique o registro de atividades diárias, colete dados em tempo real e receba alertas diretamente no WhatsApp. Interação fácil e rápida para o produtor.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card elevation={0} sx={{ height: '100%', bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'primary.light', width: 'fit-content', color: 'common.white' }}>
                                        <DashboardIcon fontSize="large" sx={{ color: 'primary.dark' }} />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>Dashboard Completo</Typography>
                                    <Typography color="text.secondary">
                                        Visualize gráficos intuitivos de produção, insumos e custos. Acompanhe o desempenho da sua fazenda e tome decisões baseadas em dados precisos.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card elevation={0} sx={{ height: '100%', bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' }}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'primary.light', width: 'fit-content', color: 'common.white' }}>
                                        <VerifiedUserIcon fontSize="large" sx={{ color: 'primary.dark' }} />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>Onboarding Automático</Typography>
                                    <Typography color="text.secondary">
                                        Facilite a entrada de novos colaboradores e garanta o treinamento adequado nas práticas orgânicas com fluxos de integração guiados e eficientes.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Benefits Section */}
            <Box sx={{ py: { xs: 8, md: 12 } }}>
                <Container maxWidth="lg">
                    {/* Benefit 1 */}
                    <Grid container spacing={6} alignItems="center" sx={{ mb: { xs: 8, md: 12 } }}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="overline" color="primary" fontWeight="bold">CONFORMIDADE LEGAL</Typography>
                            <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
                                Garantia com a Lei 10.831
                            </Typography>
                            <Typography paragraph color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                                Nosso sistema auxilia na documentação e rastreabilidade, assegurando que suas operações estejam em total acordo com a legislação brasileira de produção orgânica. Relatórios prontos para auditoria.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={{ borderRadius: 4, bgcolor: 'secondary.light', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                <VerifiedUserIcon sx={{ fontSize: 100 }} />
                            </Box>
                        </Grid>
                    </Grid>

                    {/* Benefit 2 */}
                    <Grid container spacing={6} alignItems="center" direction={isMobile ? 'column-reverse' : 'row-reverse'}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="overline" color="primary" fontWeight="bold">PRODUTIVIDADE</Typography>
                            <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
                                Economia de tempo e recursos
                            </Typography>
                            <Typography paragraph color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                                Automatize tarefas manuais e reduza o tempo gasto em burocracia. Concentre seus esforços naquilo que realmente importa: o cuidado com a sua produção e a sustentabilidade do negócio.
                            </Typography>
                            <Stack direction="row" spacing={4} sx={{ mt: 4 }}>
                                <Box>
                                    <Typography variant="h4" color="primary" fontWeight="bold">+40%</Typography>
                                    <Typography variant="body2" color="text.secondary">Eficiência Operacional</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="h4" color="primary" fontWeight="bold">-20h</Typography>
                                    <Typography variant="body2" color="text.secondary">Tempo Admin/Mês</Typography>
                                </Box>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={{ borderRadius: 4, bgcolor: 'secondary.light', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                <SpeedIcon sx={{ fontSize: 100 }} />
                            </Box>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Footer */}
            <Box sx={{ bgcolor: 'text.primary', color: 'background.paper', py: 8, mt: 'auto' }}>
                <Container maxWidth="lg">
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <AgricultureIcon color="success" />
                                <Typography variant="h6" fontWeight="bold">
                                    Manejo Orgânico App
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
                                Soluções tecnológicas para fortalecer a agricultura orgânica e sustentável no Brasil.
                            </Typography>
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>Produto</Typography>
                            <Stack spacing={1}>
                                <Typography variant="body2" sx={{ opacity: 0.7, cursor: 'pointer' }}>Recursos</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7, cursor: 'pointer' }}>Planos</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7, cursor: 'pointer' }}>Integrações</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>Suporte</Typography>
                            <Stack spacing={1}>
                                <Typography variant="body2" sx={{ opacity: 0.7, cursor: 'pointer' }}>Ajuda</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7, cursor: 'pointer' }}>Contato</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Typography variant="body2" sx={{ opacity: 0.5, textAlign: { xs: 'left', md: 'right' } }}>
                                © {new Date().getFullYear()} Manejo Orgânico App. <br /> Todos os direitos reservados.
                            </Typography>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    );
};

export default LandingPage;
