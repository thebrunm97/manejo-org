import React, { useCallback } from 'react';
import {
    Accordion, AccordionSummary, AccordionDetails, Box, Typography, Chip, Stack,
    TextField, Select, MenuItem, IconButton, Button, Divider, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert,
    useTheme, useMediaQuery
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ScienceIcon from '@mui/icons-material/Science'; // Icon for Insumo
import PlaceIcon from '@mui/icons-material/Place';
import BiotechIcon from '@mui/icons-material/Biotech';

import { useInsumoGrouping } from '../../hooks/pmo/useInsumoGrouping';

// @ts-ignore
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';

interface GroupedInsumosListProps {
    data: any[];
    onDataChange: (newData: any[]) => void;
    readOnly?: boolean;
}

const GroupedInsumosList: React.FC<GroupedInsumosListProps> = ({ data, onDataChange, readOnly = false }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const {
        groupedData,
        expandedGroup,
        isAddDialogOpen,
        newItemName,
        setNewItemName,
        handleAccordionChange,
        handleItemChange,
        handleRemoveItem,
        handleAddLocalToGroup,
        setIsAddDialogOpen,
        handleConfirmAddItem
    } = useInsumoGrouping(data, onDataChange);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmAddItem();
        }
    }, [handleConfirmAddItem]);

    // RENDER ITEM ROW
    const renderItemRow = (item: any, index: number) => {
        return (
            <Box key={item.id || index} sx={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, p: 2,
                bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider'
            }}>
                {/* Onde (Local) */}
                <Box sx={{ flex: 2, minWidth: 200 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        <PlaceIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Onde (Cultura/Local)
                    </Typography>
                    {readOnly ? (
                        <Typography variant="body2">{item.onde || 'Não informado'}</Typography>
                    ) : (
                        <TextField
                            value={item.onde || ''}
                            onChange={(e) => handleItemChange(item.id, 'onde', e.target.value)}
                            size="small" fullWidth placeholder="Ex: Canteiros de Alface"
                        />
                    )}
                </Box>

                {/* Quando */}
                <Box sx={{ flex: 1, minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Data</Typography>
                    <TextField
                        type="date"
                        value={item.quando || ''}
                        onChange={(e) => handleItemChange(item.id, 'quando', e.target.value)}
                        size="small" fullWidth disabled={readOnly}
                    />
                </Box>

                {/* Dose */}
                <Box sx={{ flex: 1.5, minWidth: 150 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Dose
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField
                            type="number"
                            value={item.dose_valor ?? ''}
                            onChange={(e) => handleItemChange(item.id, 'dose_valor', e.target.value)}
                            size="small" disabled={readOnly} sx={{ flex: 1 }}
                            placeholder="0"
                        />
                        <Select
                            value={item.dose_unidade ?? 'kg'}
                            onChange={(e) => handleItemChange(item.id, 'dose_unidade', e.target.value)}
                            size="small" disabled={readOnly} sx={{ minWidth: 80 }}
                        >
                            {['kg', 'g', 'L', 'ml', 'ton', 'unid', 'sc', 'kg/ha', 'L/ha', 'm³/ha', 'g/m²', 'L/m²', 'ml/m²', 'm³/m²', 'kg/cova'].map(u => (
                                <MenuItem key={u} value={u}>{u}</MenuItem>
                            ))}
                        </Select>
                    </Box>
                </Box>

                {/* Remove Btn */}
                {!readOnly && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="Remover">
                            <IconButton color="error" size="small" onClick={() => handleRemoveItem(item.id)}>
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groupedData.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary', bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                    <ScienceIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5, color: 'primary.main' }} />
                    <Typography variant="body1" fontWeight={500}>Nenhum insumo registrado</Typography>
                    <Typography variant="body2" color="text.secondary">Adicione adubos, defensivos ou manejos.</Typography>
                </Box>
            ) : (
                groupedData.map(group => (
                    <Accordion key={group.nome} expanded={expandedGroup === group.nome} onChange={handleAccordionChange(group.nome)}
                        sx={{ borderRadius: '8px !important', border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0, borderColor: 'primary.main' } }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: expandedGroup === group.nome ? 'action.selected' : 'background.paper', borderRadius: expandedGroup === group.nome ? '8px 8px 0 0' : '8px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <BiotechIcon color="primary" />
                                <Typography variant="subtitle1" fontWeight={700}>{group.nome}</Typography>
                                <Chip label={group.items.length} size="small" variant="outlined" sx={{ ml: 1 }} />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ bgcolor: '#f8fafc', p: 2 }}>
                            <Stack spacing={2}>
                                {group.items.map(renderItemRow)}
                                {!readOnly && (
                                    <>
                                        <Divider />
                                        <Button startIcon={<AddCircleOutlineIcon />} onClick={() => handleAddLocalToGroup(group.nome)} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                                            Adicionar aplicação de {group.nome}
                                        </Button>
                                    </>
                                )}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                ))
            )}

            {!readOnly && (
                <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => setIsAddDialogOpen(true)}
                    sx={{ alignSelf: 'flex-start', py: 1.5, px: 3, borderStyle: 'dashed', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                >
                    Adicionar Novo Tipo de Insumo/Manejo
                </Button>
            )}

            <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Novo Insumo ou Manejo</DialogTitle>
                <DialogContent>
                    <DialogContentText gutterBottom>O que você vai aplicar? (Ex: Esterco, Calda Bordalesa, Capina)</DialogContentText>
                    <TextField autoFocus margin="dense" label="Nome do Insumo/Manejo" fullWidth value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={handleKeyDown} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmAddItem} variant="contained">Adicionar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default GroupedInsumosList;
