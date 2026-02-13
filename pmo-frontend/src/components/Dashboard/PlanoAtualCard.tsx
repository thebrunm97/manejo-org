import React from 'react';
import { Paper, Box, Typography, Button, IconButton } from '@mui/material';
import { Leaf, Edit } from 'lucide-react';

interface PlanoAtualCardProps {
    nomePlano: string | null;
    versao?: number;
    status?: string;
    onVer: () => void;
    onEditar: () => void;
}

const PlanoAtualCard: React.FC<PlanoAtualCardProps> = ({
    nomePlano,
    versao = 1,
    status = 'Em andamento',
    onVer,
    onEditar,
}) => {
    return (
        <Paper
            sx={{
                bgcolor: 'custom.cardDark',
                borderRadius: 2,
                p: 3,
                position: 'relative',
                overflow: 'hidden',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 180,
            }}
        >
            {/* Glow decorativo */}
            <Box
                sx={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    opacity: 0.15,
                    filter: 'blur(48px)',
                    pointerEvents: 'none',
                }}
            />

            {/* Header: Icon + Label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Leaf size={20} color="#4ade80" />
                <Typography
                    variant="caption"
                    sx={{
                        color: 'grey.400',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                    }}
                >
                    PLANO ATUAL
                </Typography>
            </Box>

            {/* Content */}
            {nomePlano ? (
                <>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            wordBreak: 'break-word',
                            lineHeight: 1.2,
                            mb: 0.5,
                        }}
                    >
                        {nomePlano}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'grey.500',
                            mb: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                        }}
                    >
                        v{versao} •{' '}
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-block',
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: 'primary.light',
                                mr: 0.5,
                            }}
                        />
                        {status}
                    </Typography>

                    {/* Footer: Buttons */}
                    <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            onClick={onVer}
                            sx={{
                                bgcolor: 'primary.light',
                                color: '#064e3b',
                                borderRadius: 2,
                                fontWeight: 700,
                                textTransform: 'none',
                                '&:hover': {
                                    bgcolor: '#86efac',
                                },
                            }}
                        >
                            Ver
                        </Button>
                        <IconButton
                            size="small"
                            onClick={onEditar}
                            sx={{
                                borderColor: 'rgba(255,255,255,0.3)',
                                border: '1px solid',
                                color: 'white',
                                borderRadius: 2,
                                minWidth: 40,
                                '&:hover': {
                                    borderColor: 'rgba(255,255,255,0.5)',
                                    bgcolor: 'rgba(255,255,255,0.1)',
                                },
                            }}
                        >
                            <Edit size={16} />
                        </IconButton>
                    </Box>
                </>
            ) : (
                <Typography variant="body2" sx={{ color: 'grey.500' }}>
                    Nenhum plano selecionado
                </Typography>
            )}
        </Paper>
    );
};

export default PlanoAtualCard;
