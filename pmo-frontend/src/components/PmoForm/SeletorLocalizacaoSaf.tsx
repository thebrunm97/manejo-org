// src/components/PmoForm/SeletorLocalizacaoSaf.tsx

import React, { useState, useEffect, useMemo, ChangeEvent, SyntheticEvent } from 'react';
import {
    Box, Chip, List, ListItem, ListItemButton, ListItemAvatar, ListItemText, Avatar,
    Typography, IconButton, Button, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Stack, RadioGroup, FormControlLabel, Radio,
    InputAdornment, Checkbox, useMediaQuery, useTheme, Grid, CircularProgress,
    Alert, Fade
} from '@mui/material';
import {
    Grass as GrassIcon,
    Forest as TreeIcon,
    Add as AddIcon,
    Search as SearchIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    SquareFoot as AreaIcon,
    LinearScale as LinearIcon,
    Map as MapIcon,
    Close as CloseIcon,
    WaterDrop as WaterIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { locationService } from '../../services/locationService';

// Types
interface Talhao {
    id: number | string;
    nome: string;
    [key: string]: any;
}

interface Canteiro {
    id: number | string;
    nome: string;
    tipo?: string;
    area_total_m2?: number;
    largura?: number;
    comprimento?: number;
    _displayName?: string;
    [key: string]: any;
}

interface SelectionValue {
    talhao_id?: number | string | null;
    talhao_nome?: string;
    canteiro_id?: number | string;
    canteiro_nome?: string;
    area_m2?: number;
    _display?: string;
}

interface FormLocalData {
    nome: string;
    tipo: string;
    largura: string;
    comprimento: string;
    linhas: string;
}

interface SeletorLocalizacaoSafProps {
    value?: SelectionValue | string | null;
    onChange: (value: SelectionValue) => void;
    multiple?: boolean;
    error?: boolean;
    helperText?: string;
}

type ViewMode = 'list' | 'create';
type FilterType = 'todos' | 'canteiro' | 'entrelinha' | 'tanque';

const SeletorLocalizacaoSaf: React.FC<SeletorLocalizacaoSafProps> = ({
    value,
    onChange,
    multiple = false,
    error = false,
    helperText = ''
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // States
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
    const [modalSelectorOpen, setModalSelectorOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const displayValue = useMemo(() => {
        if (!value) return '';
        if (typeof value === 'object') {
            return `${value.talhao_nome || ''} > ${value.canteiro_nome || ''}`;
        }
        return value;
    }, [value]);

    const [selectedTalhaoId, setSelectedTalhaoId] = useState<number | string | null>(null);
    const [loadingTalhoes, setLoadingTalhoes] = useState(false);
    const [loadingCanteiros, setLoadingCanteiros] = useState(false);
    const [busca, setBusca] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('todos');

    const [formLocal, setFormLocal] = useState<FormLocalData>({
        nome: '',
        tipo: 'canteiro',
        largura: '',
        comprimento: '',
        linhas: ''
    });
    const [saving, setSaving] = useState(false);

    // Load Talhões
    useEffect(() => {
        const loadTalhoes = async () => {
            setLoadingTalhoes(true);
            try {
                const data = await locationService.getTalhoes();
                setTalhoes(data);
                if (data.length > 0) setSelectedTalhaoId(data[0].id);
            } catch (err) {
                console.error("Failed to load Talhoes", err);
            } finally {
                setLoadingTalhoes(false);
            }
        };
        loadTalhoes();
    }, []);

    // Load Canteiros
    useEffect(() => {
        if (!selectedTalhaoId) {
            setCanteiros([]);
            return;
        }

        const loadCanteiros = async () => {
            setLoadingCanteiros(true);
            try {
                const data = await locationService.getCanteirosByTalhao(selectedTalhaoId);
                setCanteiros(data);
            } catch (err) {
                console.error("Failed to load Canteiros", err);
            } finally {
                setLoadingCanteiros(false);
            }
        };
        loadCanteiros();
    }, [selectedTalhaoId]);

    // Filtered Canteiros
    const canteirosFiltrados = useMemo(() => {
        if (!canteiros) return [];
        let lista = [...canteiros];

        if (busca) {
            lista = lista.filter(l => l.nome && l.nome.toLowerCase().includes(busca.toLowerCase()));
        }

        if (filterType !== 'todos') {
            lista = lista.filter(l => (l.tipo || '').toLowerCase() === filterType.toLowerCase());
        }

        lista.sort((a, b) => {
            const nameA = a.nome || '';
            const nameB = b.nome || '';
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });

        const nameCounts: Record<string, number> = {};
        lista.forEach(item => {
            nameCounts[item.nome] = (nameCounts[item.nome] || 0) + 1;
        });

        return lista.map(item => {
            if (nameCounts[item.nome] > 1) {
                return { ...item, _displayName: `${item.nome} (#${String(item.id).slice(-4)})` };
            }
            return { ...item, _displayName: item.nome };
        });
    }, [canteiros, busca, filterType]);

    // Debug logging
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const typesFound = [...new Set(canteirosFiltrados.map(l => l.tipo))];
            console.log('[SeletorLocalizacaoSaf] Types found in filtered list:', typesFound);
        }
    }, [canteirosFiltrados]);

    // Handlers
    const handleSelect = (canteiro: Canteiro) => {
        const talhao = talhoes.find(t => t.id === selectedTalhaoId);

        const selectionObject: SelectionValue = {
            talhao_id: selectedTalhaoId,
            talhao_nome: talhao ? talhao.nome : 'Unknown',
            canteiro_id: canteiro.id,
            canteiro_nome: canteiro.nome,
            area_m2: canteiro.area_total_m2 || 0,
            _display: `${talhao ? talhao.nome : ''} > ${canteiro.nome}`
        };

        onChange(selectionObject);
        setModalSelectorOpen(false);
    };

    const handleOpenCreateMode = () => {
        if (!selectedTalhaoId) {
            alert("Selecione um Talhão primeiro.");
            return;
        }
        setFormLocal({ nome: '', tipo: 'canteiro', largura: '', comprimento: '', linhas: '' });
        setViewMode('create');
    };

    const handleCloseModal = () => {
        setModalSelectorOpen(false);
        setViewMode('list');
    };

    const handleCreateLocal = async () => {
        if (!formLocal.nome || !selectedTalhaoId) return;
        setSaving(true);

        try {
            const larg = parseFloat(formLocal.largura) || 0;
            const comp = parseFloat(formLocal.comprimento) || 0;
            const areaCalc = larg * comp;

            const metadata = {
                tipo: formLocal.tipo,
                largura: larg,
                comprimento: comp,
                linhas: formLocal.linhas,
                area: areaCalc > 0 ? areaCalc.toFixed(2) : null
            };

            const novoCanteiro = await locationService.createCanteiro(selectedTalhaoId, formLocal.nome, metadata);

            setCanteiros(prev => [novoCanteiro, ...prev]);
            handleSelect(novoCanteiro);
            setViewMode('list');
        } catch (err) {
            console.error(err);
            alert("Erro ao criar local. Verifique o console.");
        } finally {
            setSaving(false);
        }
    };

    // Render helpers
    const getIcon = (tipo?: string) => {
        const t = (tipo || '').toLowerCase();
        switch (t) {
            case 'canteiro': return <GrassIcon />;
            case 'entrelinha': return <TreeIcon />;
            case 'tanque': return <WaterIcon />;
            default: return <MapIcon />;
        }
    };

    const getColors = (tipo?: string) => {
        const t = (tipo || '').toLowerCase();
        switch (t) {
            case 'canteiro': return { bg: '#dcfce7', color: '#16a34a' };
            case 'entrelinha': return { bg: '#fef3c7', color: '#d97706' };
            case 'tanque': return { bg: '#dbeafe', color: '#2563eb' };
            default: return { bg: '#f3f4f6', color: '#6b7280' };
        }
    };

    const previewArea = ((parseFloat(formLocal.largura) || 0) * (parseFloat(formLocal.comprimento) || 0)).toFixed(1);
    const selectedTalhaoName = talhoes.find(t => t.id === selectedTalhaoId)?.nome;
    const valueObj = typeof value === 'object' ? value : null;

    return (
        <>
            <TextField
                fullWidth
                value={displayValue}
                placeholder="Toque para selecionar..."
                onClick={() => setModalSelectorOpen(true)}
                error={error}
                helperText={helperText}
                InputProps={{
                    readOnly: true,
                    startAdornment: (
                        <InputAdornment position="start">
                            <MapIcon color={displayValue ? "primary" : "action"} />
                        </InputAdornment>
                    ),
                    sx: { cursor: 'pointer', caretColor: 'transparent' }
                }}
                size="small"
            />

            <Dialog
                open={modalSelectorOpen}
                onClose={handleCloseModal}
                fullScreen={isMobile}
                fullWidth
                maxWidth="md"
                PaperProps={{
                    sx: { height: isMobile ? '100%' : '80vh', display: 'flex', flexDirection: 'column' }
                }}
            >
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {viewMode === 'create' && (
                            <IconButton onClick={() => setViewMode('list')} size="small" edge="start">
                                <ArrowBackIcon />
                            </IconButton>
                        )}
                        <Typography variant="h6" fontWeight={700}>
                            {viewMode === 'list' ? 'Selecionar Local' : `Novo Local em ${selectedTalhaoName}`}
                        </Typography>
                        {(loadingTalhoes && viewMode === 'list') && <CircularProgress size={20} />}
                    </Box>
                    <IconButton onClick={handleCloseModal}><CloseIcon /></IconButton>
                </Box>

                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {viewMode === 'list' ? (
                        <>
                            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1, display: 'block' }}>
                                    TALHÃO / ÁREA
                                </Typography>
                                <Box sx={{ mb: 2, overflowX: 'auto', whiteSpace: 'nowrap', display: 'flex', gap: 1, pb: 0.5 }}>
                                    {talhoes.map(talhao => (
                                        <Chip
                                            key={talhao.id}
                                            label={talhao.nome}
                                            onClick={() => setSelectedTalhaoId(talhao.id)}
                                            color={selectedTalhaoId === talhao.id ? 'primary' : 'default'}
                                            variant={selectedTalhaoId === talhao.id ? 'filled' : 'outlined'}
                                            clickable
                                            sx={{ fontWeight: 600 }}
                                        />
                                    ))}
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                    {(['todos', 'canteiro', 'entrelinha', 'tanque'] as FilterType[]).map((t) => (
                                        <Chip
                                            key={t}
                                            label={t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
                                            size="small"
                                            color={filterType === t ? 'secondary' : 'default'}
                                            variant={filterType === t ? 'filled' : 'outlined'}
                                            onClick={() => setFilterType(t)}
                                            clickable
                                        />
                                    ))}
                                </Box>

                                <TextField
                                    fullWidth size="small"
                                    placeholder="Buscar canteiro, linha ou espaço..."
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment>
                                    }}
                                />
                            </Box>

                            <List sx={{ flexGrow: 1, overflowY: 'auto', px: 1 }}>
                                {loadingCanteiros ? (
                                    <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
                                ) : canteirosFiltrados.length === 0 ? (
                                    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                                        <Typography variant="h6" color="text.secondary" gutterBottom>Nenhum local encontrado</Typography>
                                        <Button startIcon={<AddIcon />} variant="outlined" onClick={handleOpenCreateMode}>
                                            Criar Local Agora
                                        </Button>
                                    </Box>
                                ) : (
                                    canteirosFiltrados.map((local) => {
                                        const colors = getColors(local.tipo);
                                        const isSelected = valueObj?.canteiro_id === local.id;

                                        return (
                                            <ListItem key={local.id} disablePadding divider>
                                                <ListItemButton
                                                    onClick={() => handleSelect(local)}
                                                    selected={isSelected}
                                                    sx={{
                                                        borderRadius: 2,
                                                        mb: 0.5,
                                                        '&.Mui-selected': { bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.main' }
                                                    }}
                                                >
                                                    <ListItemAvatar>
                                                        <Avatar sx={{ bgcolor: colors.bg, color: colors.color }}>
                                                            {getIcon(local.tipo)}
                                                        </Avatar>
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={
                                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                                    {local._displayName || local.nome}
                                                                </Typography>
                                                                {local.area_total_m2 && (
                                                                    <Chip label={`${local.area_total_m2} m²`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                                )}
                                                            </Box>
                                                        }
                                                        secondary={
                                                            <Typography variant="caption" display="block" color="text.secondary">
                                                                {local.largura && local.comprimento
                                                                    ? `${local.largura}m x ${local.comprimento}m`
                                                                    : local.tipo?.toUpperCase()}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        );
                                    })
                                )}
                            </List>
                        </>
                    ) : (
                        <Fade in={true}>
                            <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="textSecondary" fontWeight={600} gutterBottom>TIPO DE LOCAL</Typography>
                                        <RadioGroup row value={formLocal.tipo} onChange={(e) => setFormLocal({ ...formLocal, tipo: e.target.value })}>
                                            <FormControlLabel value="canteiro" control={<Radio color="success" />} label="Canteiro" />
                                            <FormControlLabel value="entrelinha" control={<Radio color="warning" />} label="Entrelinha SAF" />
                                            <FormControlLabel value="tanque" control={<Radio color="primary" />} label="Tanque" />
                                        </RadioGroup>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            label="Nome (Ex: Canteiro 05, Linha de Limão)"
                                            fullWidth
                                            variant="outlined"
                                            autoFocus
                                            value={formLocal.nome}
                                            onChange={(e) => setFormLocal({ ...formLocal, nome: e.target.value })}
                                            placeholder="Digite o nome..."
                                        />
                                    </Grid>

                                    <Grid item xs={6}>
                                        <TextField
                                            label="Largura (m)" type="number" fullWidth
                                            value={formLocal.largura} onChange={(e) => setFormLocal({ ...formLocal, largura: e.target.value })}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            label="Comprimento (m)" type="number" fullWidth
                                            value={formLocal.comprimento} onChange={(e) => setFormLocal({ ...formLocal, comprimento: e.target.value })}
                                        />
                                    </Grid>

                                    {(formLocal.largura && formLocal.comprimento) && (
                                        <Grid item xs={12}>
                                            <Alert severity="info" icon={<AreaIcon />}>
                                                Área Calculada: <strong>{previewArea} m²</strong>
                                            </Alert>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        </Fade>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 2, borderTop: '1px solid #eee', bgcolor: '#fbfbfb', justifyContent: 'space-between' }}>
                    {viewMode === 'list' ? (
                        <>
                            <Button onClick={handleCloseModal} color="inherit">Fechar</Button>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleOpenCreateMode}
                                color="success"
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                            >
                                Criar Novo Local
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={() => setViewMode('list')} color="inherit" disabled={saving}>Cancelar</Button>
                            <Button
                                onClick={handleCreateLocal}
                                variant="contained"
                                color="primary"
                                disabled={!formLocal.nome || saving}
                                sx={{ borderRadius: 2, fontWeight: 700 }}
                            >
                                {saving ? 'Salvando...' : 'Salvar Local'}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
};

export default SeletorLocalizacaoSaf;
