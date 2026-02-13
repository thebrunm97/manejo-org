// src/pages/MinhasCulturas.tsx

import React from 'react';
import { Box, Typography, Button, Paper, Container, Chip } from '@mui/material';
import { Sprout, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MinhasCulturas: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Container maxWidth="md" sx={{ mt: 8, mb: 4 }}>
            <Paper
                elevation={0}
                sx={{
                    p: 6,
                    textAlign: 'center',
                    borderRadius: 4,
                    bgcolor: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3
                }}
            >
                <Box
                    sx={{
                        width: 120,
                        height: 120,
                        bgcolor: '#ecfdf5',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        boxShadow: '0 0 0 10px rgba(16, 185, 129, 0.1)'
                    }}
                >
                    <Sprout size={64} color="#059669" strokeWidth={1.5} />
                </Box>

                <Typography variant="h4" fontWeight="800" color="#1e293b">
                    Gestão de Culturas
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, lineHeight: 1.6 }}>
                    Estamos preparando uma área exclusiva para você gerenciar o ciclo de vida das suas culturas, desde o plantio até a colheita, com estatísticas detalhadas.
                </Typography>

                <Box sx={{ mt: 2 }}>
                    <Chip label="Em Breve" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
                </Box>

                <Button
                    variant="contained"
                    startIcon={<ArrowLeft size={20} />}
                    onClick={() => navigate('/')}
                    sx={{
                        mt: 4,
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 'bold',
                        px: 4,
                        py: 1.5
                    }}
                >
                    Voltar para Visão Geral
                </Button>
            </Paper>
        </Container>
    );
};

export default MinhasCulturas;
