import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    TextField,
    MenuItem,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Chip,
    InputAdornment
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SpaIcon from '@mui/icons-material/Spa';
import { useVegetalImportLogic } from '../../hooks/pmo/useVegetalImportLogic';
import { VegetalItem } from '../../domain/pmo/pmoTypes';

interface VegetalImportDialogProps {
    open: boolean;
    onClose: () => void;
    onImport: (items: VegetalItem[]) => void;
    currentItems: VegetalItem[];
    pmoId: string | number | undefined; // Atualizado para ser flexível
    propriedadeId?: number;
}

// Extender a interface localmente para incluir o campo temporário
type VegetalItemWithDate = VegetalItem & { data_plantio_temp?: string };

const VegetalImportDialog: React.FC<VegetalImportDialogProps> = ({
    open,
    onClose,
    onImport,
    currentItems,
    pmoId,
    propriedadeId
}) => {
    const { suggestions, loading, fetchSuggestions, importItems } = useVegetalImportLogic(pmoId, currentItems, propriedadeId);

    // Estado para itens selecionados (IDs)
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    // Estado para estimativas e unidades editadas
    const [estimates, setEstimates] = useState<Record<string | number, number>>({});
    const [units, setUnits] = useState<Record<string | number, string>>({});

    // Carregar sugestões ao abrir
    useEffect(() => {
        if (open) {
            fetchSuggestions();
            setSelectedIds(new Set());
            setEstimates({});
            setUnits({});
        }
    }, [open, fetchSuggestions]);

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            const newSelected = new Set(suggestions.map(n => n.id));
            setSelectedIds(newSelected);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelect = (id: string | number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleEstimateChange = (id: string | number, value: string) => {
        const numValue = parseFloat(value);
        setEstimates(prev => ({
            ...prev,
            [id]: isNaN(numValue) ? 0 : numValue
        }));

        // Auto-selecionar se digitar algo > 0
        if (!selectedIds.has(id) && numValue > 0) {
            handleSelect(id);
        }
    };

    const handleUnitChange = (id: string | number, value: string) => {
        setUnits(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleConfirmImport = () => {
        // Filtrar apenas os selecionados
        const itemsToProcess = suggestions.filter(item => selectedIds.has(item.id));

        // Aplicar as estimativas e unidades
        const finalItems = itemsToProcess.map(item => {
            const estimate = estimates[item.id] !== undefined ? estimates[item.id] : (item.producao_esperada_ano || 0);
            const unit = units[item.id] || item.producao_unidade || 'kg';

            // Remove data_plantio_temp before returning
            const { data_plantio_temp, ...cleanItem } = item as VegetalItemWithDate;

            return {
                ...cleanItem,
                producao_esperada_ano: estimate,
                producao_unidade: unit
            };
        });

        // Chamar o hook para preparar os IDs finais e retornar
        const imported = importItems(finalItems);
        onImport(imported);
        onClose();
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, minHeight: '60vh' }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e0e0e0' }}>
                <CloudDownloadIcon color="primary" />
                Importar do Caderno de Campo
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 2 }}>
                        <CircularProgress />
                        <Typography color="text.secondary">Buscando novidades no campo...</Typography>
                    </Box>
                ) : suggestions.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Alert severity="success" sx={{ justifyContent: 'center' }}>
                            Tudo sincronizado! Nenhum novo plantio encontrado no caderno.
                        </Alert>
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            indeterminate={selectedIds.size > 0 && selectedIds.size < suggestions.length}
                                            checked={suggestions.length > 0 && selectedIds.size === suggestions.length}
                                            onChange={handleSelectAll}
                                        />
                                    </TableCell>
                                    <TableCell>Cultura</TableCell>
                                    <TableCell>Local</TableCell>
                                    <TableCell>Data Reg.</TableCell>
                                    <TableCell width={220}>Estimativa de Colheita</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {suggestions.map((item) => {
                                    const itemWithDate = item as VegetalItemWithDate;
                                    const isSelected = selectedIds.has(item.id);

                                    return (
                                        <TableRow
                                            key={item.id}
                                            hover
                                            selected={isSelected}
                                            onClick={(e) => {
                                                // Prevent toggling when clicking inputs
                                                if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).getAttribute('role') !== 'button') {
                                                    handleSelect(item.id);
                                                }
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={() => handleSelect(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <SpaIcon color="success" fontSize="small" />
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {item.produto}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {item.talhoes_canteiros || 'N/I'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={formatDate(itemWithDate.data_plantio_temp)}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.75rem' }}
                                                />
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        type="number"
                                                        placeholder="0"
                                                        value={estimates[item.id] !== undefined ? estimates[item.id] : ''}
                                                        onChange={(e) => handleEstimateChange(item.id, e.target.value)}
                                                        sx={{ width: 80 }}
                                                        InputProps={{ sx: { fontSize: 13 } }}
                                                    />
                                                    <TextField
                                                        select
                                                        size="small"
                                                        value={units[item.id] || item.producao_unidade || 'kg'}
                                                        onChange={(e) => handleUnitChange(item.id, e.target.value)}
                                                        sx={{ width: 70 }}
                                                        InputProps={{ sx: { fontSize: 13 } }}
                                                    >
                                                        <MenuItem value="kg">kg</MenuItem>
                                                        <MenuItem value="ton">ton</MenuItem>
                                                        <MenuItem value="sacos">sc</MenuItem>
                                                        <MenuItem value="cx">cx</MenuItem>
                                                        <MenuItem value="unid">unid</MenuItem>
                                                        <MenuItem value="maços">maço</MenuItem>
                                                    </TextField>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0', justifyContent: 'space-between' }}>
                <Button onClick={onClose} color="inherit">
                    Cancelar
                </Button>
                <Button
                    onClick={handleConfirmImport}
                    variant="contained"
                    color="primary"
                    disabled={selectedIds.size === 0}
                    startIcon={<CloudDownloadIcon />}
                >
                    Importar ({selectedIds.size})
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default VegetalImportDialog;
