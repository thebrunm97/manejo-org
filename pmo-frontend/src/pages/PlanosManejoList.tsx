/**
 * @file PlanosManejoList.tsx
 * @description View para listagem de PMOs (Planos de Manejo Orgânico).
 * 
 * ✅ REFACTORED: Toda lógica extraída para usePlanosListLogic hook.
 * Este arquivo contém APENAS apresentação visual (MUI).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Hook com toda a lógica
import { usePlanosListLogic } from '../hooks/pmo/usePlanosListLogic';

// Domain Types
import type { PmoListItem } from '../domain/pmo/pmoTypes';

import {
    Box,
    Card,
    CardContent,
    CardActions,
    Typography,
    Chip,
    IconButton,
    Button,
    CircularProgress,
    Tooltip,
    Paper,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';

// Ícones
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EditIcon from '@mui/icons-material/Edit';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

// ==================================================================
// ||                    CARD COMPONENT                            ||
// ==================================================================

interface PmoCardProps {
    pmo: PmoListItem;
    isActive: boolean;
    isActivating: boolean;
    isDeleting: boolean;
    onActivate: (pmoId: string) => void;
    onDelete: (pmo: PmoListItem) => void;
}

const PmoCard: React.FC<PmoCardProps> = ({
    pmo,
    isActive,
    isActivating,
    isDeleting,
    onActivate,
    onDelete
}) => {
    const navigate = useNavigate();

    const statusConfig: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'error'; icon: React.ReactElement }> = {
        'RASCUNHO': { label: 'Rascunho', color: 'default', icon: <EditIcon fontSize="inherit" /> },
        'CONCLUÍDO': { label: 'Concluído', color: 'info', icon: <HourglassEmptyIcon fontSize="inherit" /> },
        'APROVADO': { label: 'Aprovado', color: 'success', icon: <CheckCircleIcon fontSize="inherit" /> },
        'REPROVADO': { label: 'Reprovado', color: 'error', icon: <ErrorIcon fontSize="inherit" /> },
    };
    const currentStatus = statusConfig[pmo.status] || statusConfig['RASCUNHO'];

    // Disable all actions when this card is busy
    const isBusy = isActivating || isDeleting;

    return (
        <Card sx={{
            height: 250,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            border: isActive ? '2px solid #16a34a' : '1px solid #e2e8f0',
            boxShadow: isActive ? '0 4px 20px rgba(22, 163, 74, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
            opacity: isBusy ? 0.7 : 1,
            '&:hover': { transform: isBusy ? 'none' : 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }
        }}>
            {/* Ícone e Título */}
            <CardContent sx={{ flex: 1, pt: 2, pb: 1, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: isActive ? '#dcfce7' : '#f1f5f9',
                        mr: 2,
                        minWidth: 54,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <DescriptionIcon sx={{ color: isActive ? '#16a34a' : '#64748b', fontSize: 30 }} />
                    </Box>
                    <Box sx={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <Tooltip title={pmo.nome_identificador} arrow placement="top">
                            <Typography
                                variant="h6"
                                component="h2"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    lineHeight: 1.3,
                                    mb: 0.5,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textAlign: 'left'
                                }}
                            >
                                {pmo.nome_identificador}
                            </Typography>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                            Versão: {pmo.version || '1'}
                        </Typography>
                    </Box>
                </Box>

                {/* Área de Badges */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 56, justifyContent: 'center', alignItems: 'flex-start', mb: 1 }}>
                    {isActive && (
                        <Chip
                            label="✓ ATIVO NO ZAP"
                            color="success"
                            size="small"
                            sx={{
                                fontWeight: 'bold',
                                fontSize: '0.65rem',
                                height: 24
                            }}
                        />
                    )}
                    <Chip
                        icon={currentStatus.icon}
                        label={currentStatus.label}
                        color={currentStatus.color}
                        size="small"
                        variant="outlined"
                        sx={{ height: 24 }}
                    />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left', display: 'block' }}>
                    Criado em: {new Date(pmo.created_at).toLocaleDateString('pt-BR')}
                </Typography>
            </CardContent>

            <Divider />

            <CardActions sx={{ justifyContent: 'space-between', p: 1.5, bgcolor: '#f8fafc' }}>
                <Box>
                    <Tooltip title={isActive ? "Já está ativo" : "Ativar este plano no WhatsApp"}>
                        <span>
                            <IconButton
                                size="small"
                                color={isActive ? "success" : "default"}
                                disabled={isActive || isBusy}
                                onClick={() => onActivate(pmo.id)}
                            >
                                {isActivating ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    <PowerSettingsNewIcon fontSize="small" />
                                )}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
                <Box>
                    <Tooltip title="Abrir Caderno">
                        <IconButton
                            size="small"
                            sx={{ color: '#0f172a' }}
                            disabled={isBusy}
                            onClick={() => navigate(`/pmo/${pmo.id}/editar?aba=caderno`)}
                        >
                            <MenuBookIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar PMO">
                        <IconButton
                            size="small"
                            color="primary"
                            disabled={isBusy}
                            onClick={() => navigate(`/pmo/${pmo.id}/editar`)}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                        <IconButton
                            size="small"
                            color="error"
                            disabled={isBusy}
                            onClick={() => onDelete(pmo)}
                        >
                            {isDeleting ? (
                                <CircularProgress size={18} color="error" />
                            ) : (
                                <DeleteIcon fontSize="small" />
                            )}
                        </IconButton>
                    </Tooltip>
                </Box>
            </CardActions>
        </Card>
    );
};

// ==================================================================
// ||                    PAGE COMPONENT                            ||
// ==================================================================

const PlanosManejoList: React.FC = () => {
    const navigate = useNavigate();

    // ─────────────────────────────────────────────────────────────
    // HOOK: Toda a lógica vem daqui
    // ─────────────────────────────────────────────────────────────
    const {
        pmos,
        activePmoId,
        listLoading,
        activatingId,
        deletingId,
        handleActivatePmo,
        handleDeletePmo
    } = usePlanosListLogic();

    // ─────────────────────────────────────────────────────────────
    // LOCAL STATE: Confirm Delete Dialog
    // ─────────────────────────────────────────────────────────────
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pmoToDelete, setPmoToDelete] = useState<PmoListItem | null>(null);

    const handleOpenDeleteDialog = (pmo: PmoListItem) => {
        setPmoToDelete(pmo);
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setPmoToDelete(null);
    };

    const handleConfirmDelete = async () => {
        if (pmoToDelete) {
            await handleDeletePmo(pmoToDelete.id);
        }
        handleCloseDeleteDialog();
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <Box sx={{
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
            pb: 10
        }}>
            {/* Cabeçalho da Página */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
                mb: 4
            }}>
                <Box>
                    <Typography
                        variant="h4"
                        sx={{ fontWeight: 700, color: '#0f172a', fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                    >
                        Gerenciar Planos
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                        Visualize, edite ou crie novos planos.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/pmo/novo')}
                    sx={{
                        px: 3,
                        py: 1,
                        fontWeight: 'bold',
                        textTransform: 'none',
                        borderRadius: 2,
                        width: { xs: '100%', sm: 'auto' }
                    }}
                >
                    Novo Plano
                </Button>
            </Box>

            {/* Conteúdo - Lista de Cards */}
            {listLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                    <CircularProgress color="success" />
                </Box>
            ) : pmos.length > 0 ? (
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(3, 1fr)',
                        lg: 'repeat(4, 1fr)'
                    },
                    gap: 2
                }}>
                    {pmos.map(pmo => (
                        <PmoCard
                            key={pmo.id}
                            pmo={pmo}
                            isActive={activePmoId === pmo.id}
                            isActivating={activatingId === pmo.id}
                            isDeleting={deletingId === pmo.id}
                            onActivate={handleActivatePmo}
                            onDelete={handleOpenDeleteDialog}
                        />
                    ))}
                </Box>
            ) : (
                <Paper
                    elevation={0}
                    sx={{
                        p: 8,
                        textAlign: 'center',
                        bgcolor: 'white',
                        border: '2px dashed #cbd5e1',
                        borderRadius: 4
                    }}
                >
                    <DescriptionIcon sx={{ fontSize: 60, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        Nenhum Plano de Manejo Encontrado
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Comece criando o plano digital da sua propriedade para organizar a produção.
                    </Typography>
                    <Button variant="outlined" color="success" onClick={() => navigate('/pmo/novo')}>
                        Criar Meu Primeiro Plano
                    </Button>
                </Paper>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-description"
            >
                <DialogTitle id="delete-dialog-title">
                    Confirmar Exclusão
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-dialog-description">
                        Tem certeza que deseja excluir <strong>"{pmoToDelete?.nome_identificador}"</strong>?
                        Esta ação não pode ser desfeita.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleCloseDeleteDialog} color="inherit">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        color="error"
                        variant="contained"
                        autoFocus
                    >
                        Excluir
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PlanosManejoList;
