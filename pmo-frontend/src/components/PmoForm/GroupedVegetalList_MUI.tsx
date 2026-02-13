import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom'; // Keep import if used elsewhere or remove if not. Actually, useParams is no longer used.
// Removing useParams import completely as it is not used in the updated code.

import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Typography,
    Chip,
    Stack,
    TextField,
    Select,
    MenuItem,
    IconButton,
    Button,
    Divider,
    Tooltip,
    useTheme,
    useMediaQuery,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlaceIcon from '@mui/icons-material/Place';
import SpaIcon from '@mui/icons-material/Spa';
import GrassIcon from '@mui/icons-material/Grass';

// @ts-ignore - Legacy JS component
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';
import { useVegetalGrouping } from '../../hooks/pmo/useVegetalGrouping';
import VegetalImportDialog from './VegetalImportDialog';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

// ==================================================================
// ||                         INTERFACES                           ||
// ==================================================================

import { VegetalItem } from '../../domain/pmo/pmoTypes';

interface GroupedVegetalListProps {
    data: VegetalItem[];
    onDataChange: (newData: VegetalItem[]) => void;
    readOnly?: boolean;
    pmoId: string | number | undefined;
    propriedadeId?: number;
}

// ==================================================================
// ||                    HELPER FUNCTIONS                          ||
// ==================================================================

const getDisplayLocation = (loc: VegetalItem['talhoes_canteiros']): string => {
    if (!loc) return 'Não informado';
    if (typeof loc === 'string') return loc || 'Não informado';
    if (loc._display) return loc._display;
    if (loc.talhao_nome || loc.canteiro_nome) {
        return `${loc.talhao_nome || '?'} › ${loc.canteiro_nome || '?'}`;
    }
    return 'Não informado';
};

// ==================================================================
// ||                    COMPONENT DEFINITION                      ||
// ==================================================================

const GroupedVegetalList: React.FC<GroupedVegetalListProps> = ({
    data,
    onDataChange,
    readOnly = false,
    pmoId,
    propriedadeId
}) => {
    // const { id: pmoId } = useParams<{ id: string }>(); // REMOVIDO: Agora vem via props
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const {
        groupedData,
        expandedGroup,
        isAddDialogOpen,
        newCultureName,
        setNewCultureName,
        handleAccordionChange,
        handleItemChange,
        handleRemoveItem,
        handleAddLocalToGroup,
        handleOpenAddDialog,
        handleCloseAddDialog,
        handleConfirmAddCulture
    } = useVegetalGrouping(data, onDataChange);

    // Handler para tecla Enter no input
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmAddCulture();
        }
    }, [handleConfirmAddCulture]);

    const handleImportSuccess = useCallback((importedItems: VegetalItem[]) => {
        if (importedItems.length > 0) {
            onDataChange([...data, ...importedItems]);
        }
    }, [data, onDataChange]);

    // --- RENDER ITEM (Local dentro do grupo) ---
    const renderItemRow = (item: VegetalItem, index: number) => {
        // Fix Definitivo de Key
        const uniqueKey = item.id ? `item-${item.id}` : `fallback-${index}-${Date.now()}`;
        return (
            <Box
                key={uniqueKey}
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: 2,
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    alignItems: isMobile ? 'stretch' : 'center',
                }}
            >
                {/* Localização */}
                <Box sx={{ flex: 2, minWidth: 200 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        <PlaceIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Local (Talhão/Canteiro)
                    </Typography>
                    {readOnly ? (
                        <Typography variant="body2">{getDisplayLocation(item.talhoes_canteiros)}</Typography>
                    ) : (
                        <SeletorLocalizacaoSaf
                            value={item.talhoes_canteiros ?? ''}
                            onChange={(val: any) => handleItemChange(item.id, 'talhoes_canteiros', val)}
                        />
                    )}
                </Box>

                {/* Área Plantada */}
                <Box sx={{ flex: 1, minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Área Plantada
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField
                            type="number"
                            value={item.area_plantada ?? ''}
                            onChange={(e) => handleItemChange(item.id, 'area_plantada', parseFloat(e.target.value) || 0)}
                            size="small"
                            disabled={readOnly}
                            sx={{ flex: 1 }}
                            inputProps={{ min: 0, step: 0.01 }}
                        />
                        <Select
                            value={item.area_plantada_unidade ?? 'ha'}
                            onChange={(e) => handleItemChange(item.id, 'area_plantada_unidade', e.target.value)}
                            size="small"
                            disabled={readOnly}
                            sx={{ minWidth: 60 }}
                        >
                            <MenuItem value="ha">ha</MenuItem>
                            <MenuItem value="m²">m²</MenuItem>
                        </Select>
                    </Box>
                </Box>

                {/* Produção Esperada */}
                <Box sx={{ flex: 1, minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Produção/Ano
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField
                            type="number"
                            value={item.producao_esperada_ano ?? ''}
                            onChange={(e) => handleItemChange(item.id, 'producao_esperada_ano', parseFloat(e.target.value) || 0)}
                            size="small"
                            disabled={readOnly}
                            sx={{ flex: 1 }}
                            inputProps={{ min: 0 }}
                        />
                        <Select
                            value={(item.producao_unidade === 'unid' ? 'unidade' : item.producao_unidade) ?? 'kg'}
                            onChange={(e) => handleItemChange(item.id, 'producao_unidade', e.target.value)}
                            size="small"
                            disabled={readOnly}
                            sx={{ minWidth: 70 }}
                        >
                            <MenuItem value="kg">kg</MenuItem>
                            <MenuItem value="ton">ton</MenuItem>
                            <MenuItem value="cx">cx</MenuItem>
                            <MenuItem value="unidade">unid</MenuItem>
                            <MenuItem value="maço">maço</MenuItem>
                        </Select>
                    </Box>
                </Box>

                {/* Botão Remover */}
                {!readOnly && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="Remover este local">
                            <IconButton
                                color="error"
                                size="small"
                                onClick={() => handleRemoveItem(item.id)}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        );
    };

    // --- RENDER PRINCIPAL ---
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groupedData.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <SpaIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                    <Typography variant="body1">
                        Nenhuma cultura cadastrada ainda.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Clique em "Adicionar Nova Cultura" para começar.
                    </Typography>
                </Box>
            ) : (
                groupedData.map((group) => (
                    <Accordion
                        key={group.nome}
                        expanded={expandedGroup === group.nome}
                        onChange={handleAccordionChange(group.nome)}
                        sx={{
                            borderRadius: '8px !important',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:before': { display: 'none' },
                            '&.Mui-expanded': {
                                margin: 0,
                                borderColor: 'primary.main',
                            },
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                                bgcolor: expandedGroup === group.nome ? 'action.selected' : 'background.paper',
                                borderRadius: expandedGroup === group.nome ? '8px 8px 0 0' : '8px',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%',
                                    pr: 2,
                                }}
                            >
                                {/* Nome da Cultura */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SpaIcon color="success" />
                                    <Typography variant="subtitle1" fontWeight={700}>
                                        {group.nome}
                                    </Typography>
                                    <Chip
                                        label={`${group.items.length} ${group.items.length === 1 ? 'local' : 'locais'}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ ml: 1 }}
                                    />
                                </Box>

                                {/* Totais */}
                                <Stack direction="row" spacing={1}>
                                    <Chip
                                        label={`${group.totalArea.toFixed(2)} ${group.areaUnidade}`}
                                        size="small"
                                        color="primary"
                                        variant="filled"
                                    />
                                    {group.totalProducao > 0 && (
                                        <Chip
                                            label={`${group.totalProducao.toLocaleString('pt-BR')} ${group.producaoUnidade}`}
                                            size="small"
                                            color="success"
                                            variant="filled"
                                        />
                                    )}
                                </Stack>
                            </Box>
                        </AccordionSummary>

                        <AccordionDetails sx={{ bgcolor: '#f8fafc', p: 2 }}>
                            <Stack spacing={2}>
                                {/* Lista de Locais */}
                                {group.items.map(renderItemRow)}

                                {/* Botão Adicionar Local */}
                                {!readOnly && (
                                    <>
                                        <Divider />
                                        <Button
                                            startIcon={<AddCircleOutlineIcon />}
                                            onClick={() => handleAddLocalToGroup(group.nome)}
                                            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                                        >
                                            Adicionar outro local para {group.nome}
                                        </Button>
                                    </>
                                )}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                ))
            )}

            {/* Botão Global: Adicionar Nova Cultura */}
            {/* Botão Global e Importação */}
            {!readOnly && (
                <>
                    <VegetalImportDialog
                        open={isImportDialogOpen}
                        onClose={() => setIsImportDialogOpen(false)}
                        onImport={handleImportSuccess}
                        currentItems={data}
                        pmoId={pmoId}
                        propriedadeId={propriedadeId}
                    />

                    <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                        <Button
                            variant="outlined"
                            color="success"
                            startIcon={<GrassIcon />}
                            onClick={handleOpenAddDialog}
                            sx={{
                                flex: 1,
                                textTransform: 'none',
                                fontWeight: 600,
                                borderStyle: 'dashed',
                                py: 1.5,
                                minWidth: 200
                            }}
                        >
                            Adicionar Nova Cultura
                        </Button>

                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<CloudDownloadIcon />}
                            onClick={() => setIsImportDialogOpen(true)}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 1.5,
                            }}
                        >
                            Importar do Caderno
                        </Button>
                    </Box>
                </>
            )}

            {/* Dialog para adicionar nova cultura */}
            <Dialog
                open={isAddDialogOpen}
                onClose={handleCloseAddDialog}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Nova Cultura</DialogTitle>
                <DialogContent>
                    <DialogContentText gutterBottom>
                        Digite o nome do que você vai plantar (ex: Tomate, Alface).
                    </DialogContentText>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Dica: Se você digitar uma cultura que já existe na lista, nós vamos agrupar o novo local junto com ela automaticamente!
                    </Alert>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Nome da Cultura"
                        placeholder="Ex: Tomate, Alface, Cenoura..."
                        fullWidth
                        value={newCultureName}
                        onChange={(e) => setNewCultureName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        helperText="Digite o nome e pressione Enter ou clique em Adicionar"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseAddDialog}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmAddCulture}
                        variant="contained"
                        color="success"
                        disabled={!newCultureName.trim()}
                    >
                        Adicionar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default GroupedVegetalList;
