import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Button, Card, CardContent, CardActions,
    Chip, IconButton, ToggleButton, ToggleButtonGroup, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, DialogContentText,
    Snackbar, Alert // Adicionado Snackbar e Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../context/AuthContext';

// Ícones
import GridViewIcon from '@mui/icons-material/GridView'; // Croqui
import MapIcon from '@mui/icons-material/Map'; // Satélite
import EditIcon from '@mui/icons-material/Edit';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddIcon from '@mui/icons-material/Add';
import GrassIcon from '@mui/icons-material/Grass';

// Componentes Internos
import FarmMap from '../Map/FarmMap';
import TalhaoDetailsDrawer from './TalhaoDetailsDrawer';
import { locationService } from '../../services/locationService';

// Tipagem simplificada para evitar erros
interface Talhao {
    id: number;
    nome: string;
    tipo: string;
    area_total_m2: number;
    area_ha?: number;
    cultura?: string;
    canteiros?: any[];
    [key: string]: any;
}

const formatArea = (m2: number) => {
    if (!m2) return '0 m²';
    if (m2 >= 10000) {
        return `${(m2 / 10000).toFixed(2)} ha`;
    }
    return `${Math.round(m2)} m²`;
};

interface PropertyMapProps {
    propriedadeId?: number | null;
}

const PropertyMap: React.FC<PropertyMapProps> = ({ propriedadeId }) => {
    const theme = useTheme();
    const { user } = useAuth();

    // Estados
    const [viewMode, setViewMode] = useState<'croqui' | 'mapa'>('croqui');
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Estado para Novo Talhão
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [pendingTalhao, setPendingTalhao] = useState<{ layer: any, geometry: string, areaM2: number } | null>(null);

    const [newTalhaoData, setNewTalhaoData] = useState({ nome: '', cultura: '' });

    // Estado para Deleção
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [canteiroToDelete, setCanteiroToDelete] = useState<string | null>(null);

    // Snackbar State
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

    // Carregar dados
    const loadTalhoes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await locationService.getTalhoes();
            setTalhoes(data || []);
        } catch (error) {
            console.error("Erro ao buscar talhões", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTalhoes();
    }, [loadTalhoes]);

    // Handlers
    const handleOpenDrawer = (talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedTalhao(null);
    };

    const handleUpdateTalhao = async (id: string | number, data: any) => {
        try {
            await locationService.updateTalhao(String(id), data);
            await loadTalhoes(); // Recarrega para atualizar a UI
            // Atualiza o talhão selecionado também para refletir no drawer aberto
            setSelectedTalhao(prev => prev ? { ...prev, ...data } : null);
        } catch (error) {
            console.error("Erro ao atualizar", error);
        }
    };

    const handleDeleteCanteiro = async (canteiroId: string | number) => {
        setCanteiroToDelete(String(canteiroId));
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteCanteiro = async () => {
        if (!canteiroToDelete) return;

        try {
            await locationService.deleteCanteiro(canteiroToDelete);
            await loadTalhoes();

            // Atualiza visualmente o drawer se necessário
            if (selectedTalhao && selectedTalhao.canteiros) {
                const updatedCanteiros = selectedTalhao.canteiros.filter(c => String(c.id) !== canteiroToDelete);
                setSelectedTalhao({ ...selectedTalhao, canteiros: updatedCanteiros });
            }
        } catch (error) {
            console.error("Erro ao deletar canteiro", error);
        } finally {
            setDeleteConfirmOpen(false);
            setCanteiroToDelete(null);
        }
    };

    const handleViewOnMap = (talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setViewMode('mapa');
        // A lógica de zoom seria implementada dentro do FarmMap recebendo o selectedTalhao
    };

    // --- CRIAÇÃO DE TALHÃO ---
    const handleMapCreated = (data: { layer: any, geometry: string, areaM2: number }) => {
        setPendingTalhao(data);
        setNewTalhaoData({ nome: `Talhão ${talhoes.length + 1}`, cultura: '' });
        setCreateModalOpen(true);
    };

    const handleCancelNewTalhao = () => {
        if (pendingTalhao?.layer?.remove) {
            pendingTalhao.layer.remove();
        }
        setCreateModalOpen(false);
        setPendingTalhao(null);
    };

    const handleSaveNewTalhao = async () => {
        if (!pendingTalhao) return;

        // Validação defensiva
        if (!propriedadeId) {
            console.error('[PropertyMap] ERRO CRÍTICO: Tentativa de salvar sem propriedade_id');
            setSnackbar({ open: true, message: 'Erro: Propriedade não identificada. Recarregue a página.', severity: 'error' });
            return;
        }

        if (!user?.id) {
            setSnackbar({ open: true, message: 'Erro: Usuário não identificado.', severity: 'error' });
            return;
        }

        try {
            const areaHa = pendingTalhao.areaM2 / 10000;
            const payload = {
                nome: newTalhaoData.nome,
                cultura: newTalhaoData.cultura,
                tipo: 'produtivo',
                geometry: pendingTalhao.geometry,
                area_total_m2: parseFloat(pendingTalhao.areaM2.toFixed(2)),
                area_ha: parseFloat(areaHa.toFixed(2)),
                cor: '#4caf50',
                propriedade_id: propriedadeId,
                user_id: user.id // <-- FIXED: Added user_id
            };

            if (locationService.createTalhao) {
                await locationService.createTalhao(payload);
                await loadTalhoes();
            }

            // Remove a layer temporária do desenho pois ela virá do banco
            if (pendingTalhao.layer?.remove) {
                pendingTalhao.layer.remove();
            }

            setCreateModalOpen(false);
            setPendingTalhao(null);
            setSnackbar({ open: true, message: 'Talhão salvo com sucesso!', severity: 'success' });

        } catch (error: any) {
            console.error("Erro ao salvar novo talhão", error);
            // Better error message
            const msg = error.message?.includes('violates row-level security')
                ? 'Erro de permissão (RLS). Contate o suporte.'
                : 'Erro ao salvar talhão. Tente novamente.';
            setSnackbar({ open: true, message: msg, severity: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3, pb: 10, height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* ... Header ... */}
            <Box display="flex" justifyContent="flex-end" alignItems="center" mb={3}>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, newMode) => newMode && setViewMode(newMode)}
                    aria-label="modo de visualização"
                    color="primary"
                >
                    <ToggleButton value="croqui" aria-label="croqui digital">
                        <GridViewIcon sx={{ mr: 1 }} /> Croqui Digital
                    </ToggleButton>
                    <ToggleButton value="mapa" aria-label="satélite">
                        <MapIcon sx={{ mr: 1 }} /> Satélite
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>


            {/* CONTEÚDO PRINCIPAL */}
            <Box sx={{ flexGrow: 1, position: 'relative' }}>

                {/* MODO CROQUI (CARDS) - CSS Grid Nativo */}
                {viewMode === 'croqui' && (
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, 1fr)',
                                md: 'repeat(auto-fit, minmax(320px, 1fr))',
                            },
                            gap: 3,
                            alignItems: 'stretch',
                        }}
                    >
                        {/* Botão de Adicionar (Card Placeholder) */}
                        <Card
                            sx={{
                                minHeight: 220,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px dashed',
                                borderColor: 'grey.400',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    bgcolor: 'grey.50',
                                },
                            }}
                            onClick={() => setViewMode('mapa')}
                        >
                            <Box textAlign="center">
                                <AddIcon sx={{ fontSize: 50, color: 'text.secondary' }} />
                                <Typography color="textSecondary">Novo Talhão (Desenhar)</Typography>
                            </Box>
                        </Card>

                        {/* Cards dos Talhões Existentes */}
                        {talhoes.map((talhao) => (
                            <Card
                                key={talhao.id}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: '12px',
                                    borderTop: `6px solid ${talhao.tipo === 'agua' ? '#2196F3' : '#4CAF50'}`,
                                    boxShadow: 3,
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        boxShadow: 6,
                                        transform: 'translateY(-2px)',
                                    },
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="start">
                                        <Box>
                                            <Typography variant="h6" fontWeight="bold">
                                                {talhao.nome}
                                            </Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                {formatArea(talhao.area_total_m2)}
                                            </Typography>
                                        </Box>
                                        {talhao.tipo === 'agua' ? (
                                            <Chip label="Recurso Hídrico" color="info" size="small" variant="outlined" />
                                        ) : (
                                            <Chip label="Produtivo" color="success" size="small" variant="outlined" />
                                        )}
                                    </Box>

                                    <Box mt={2} mb={2}>
                                        <Chip
                                            icon={<GrassIcon />}
                                            label={talhao.cultura || "Sem cultura definida"}
                                            sx={{ width: '100%', justifyContent: 'flex-start' }}
                                        />
                                    </Box>

                                    <Typography variant="caption" color="textSecondary">
                                        {talhao.canteiros?.length || 0} canteiros registrados
                                    </Typography>
                                </CardContent>

                                <CardActions sx={{ p: 2, pt: 0, mt: 'auto' }}>
                                    <Button
                                        size="small"
                                        color="inherit"
                                        startIcon={<LocationOnIcon />}
                                        onClick={() => handleViewOnMap(talhao)}
                                    >
                                        Ver no Mapa
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="primary"
                                        disableElevation
                                        startIcon={<EditIcon />}
                                        onClick={() => handleOpenDrawer(talhao)}
                                        sx={{ ml: 'auto' }}
                                    >
                                        Gerenciar
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* MODO MAPA (SATÉLITE) */}
                {viewMode === 'mapa' && (
                    <Box sx={{ height: '70vh', width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: 3 }}>
                        <FarmMap
                            talhoes={talhoes}
                            focusTarget={selectedTalhao} // Added this to support zoom on click
                            // @ts-ignore
                            onMapCreated={handleMapCreated}
                            onCreated={() => { }}
                            onEdited={() => { }}
                            onDeleted={() => { }}
                            // onSaveTalhao removido pois agora é via Modal
                            onSaveTalhao={undefined}
                            onTalhaoClick={handleOpenDrawer} // Abre o drawer ao clicar no polígono
                        />
                    </Box>
                )}
            </Box>

            {/* DRAWER LATERAL (GERENCIADOR) */}
            <TalhaoDetailsDrawer
                open={isDrawerOpen}
                onClose={handleCloseDrawer}
                talhao={selectedTalhao}
                // @ts-ignore
                onUpdate={handleUpdateTalhao}
                onDeleteCanteiro={handleDeleteCanteiro}
                onUpdateStart={loadTalhoes} // Added legacy prop support to be safe
            />

            {/* DIALOG DE NOVO TALHÃO */}
            <Dialog open={createModalOpen} onClose={handleCancelNewTalhao} fullWidth maxWidth="sm">
                <DialogTitle>Novo Talhão Detectado</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Área desenhada: <strong>{pendingTalhao ? formatArea(pendingTalhao.areaM2) : '0 m²'}</strong>
                    </DialogContentText>

                    <Stack spacing={2}>
                        <TextField
                            autoFocus
                            label="Nome do Talhão"
                            fullWidth
                            variant="outlined"
                            value={newTalhaoData.nome}
                            onChange={(e) => setNewTalhaoData({ ...newTalhaoData, nome: e.target.value })}
                        />
                        <TextField
                            label="Cultura Atual (Opcional)"
                            fullWidth
                            variant="outlined"
                            value={newTalhaoData.cultura}
                            onChange={(e) => setNewTalhaoData({ ...newTalhaoData, cultura: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelNewTalhao} color="inherit">Cancelar</Button>
                    <Button onClick={handleSaveNewTalhao} variant="contained" color="primary">
                        Salvar Talhão
                    </Button>
                </DialogActions>
            </Dialog>

            {/* DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
            >
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Tem certeza que deseja excluir este canteiro? Esta ação não pode ser desfeita.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">
                        Cancelar
                    </Button>
                    <Button onClick={confirmDeleteCanteiro} color="error" variant="contained" autoFocus>
                        Excluir
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default PropertyMap;
