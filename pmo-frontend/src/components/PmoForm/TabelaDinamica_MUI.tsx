import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow as MuiTableRow, Paper, TextField, Button,
    Typography, IconButton, Box, FormControl, Select, MenuItem, Tooltip,
    useMediaQuery, useTheme, Card, CardContent, Divider, Chip, Stack, Grid,
    Collapse,
    SelectChangeEvent,
    InputLabel,
    Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import MapIcon from '@mui/icons-material/Map';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// @ts-ignore
import LocalizacaoSafInput from './LocalizacaoSafInput';
// @ts-ignore
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';

// ==================================================================
// ||                         INTERFACES                           ||
// ==================================================================

export type ColumnType = 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'saf_visual' | 'saf_location';

export interface TableOption {
    value: string | number;
    label: string;
}

export interface TableColumn {
    id: string;
    label: string;
    type: ColumnType;
    width?: string | number;
    options?: (string | TableOption)[]; // Suporta array de strings ou objetos
    required?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    suffix?: string; // Ex: 'kg', 'ha'

    // Legacy support for unitSelector logic
    unitSelector?: {
        key: string;
        options: string[];
    };
}

export interface TableRowBase {
    id: string | number; // Identificador único da linha é obrigatório
    [key: string]: any; // Permite campos dinâmicos baseados nas colunas
}

export interface TabelaDinamicaProps<T extends TableRowBase> {
    label?: string; // Title of the table section
    columns: TableColumn[];
    data: T[];
    onDataChange?: (newData: T[]) => void;
    readOnly?: boolean;
    onAddRow?: () => void;
    onRemoveRow?: (id: string | number) => void;

    // Extra props for compatibility/specialized features
    itemName?: string;
    itemNoun?: string;
    renderMobileItem?: (item: T, toggleEdit: () => void, removeItem: () => void) => React.ReactNode;

    // New Props for Click Handling
    onRowClick?: (item: T) => void;
    disableRowClick?: boolean;
}

// Função para gerar um ID simples e único
const generateUniqueId = (): string => `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Função auxiliar simples de debounce
function debounce(func: Function, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Componente otimizado de Input
const FastTextField = React.memo(({ value, onChange, onBlur, ...props }: any) => {
    const [localValue, setLocalValue] = useState(value ?? '');

    // Synced with parent ONLY if value changes deeply (drastically)
    useEffect(() => {
        setLocalValue(value ?? '');
    }, [value]);

    // Debounce reference
    const debouncedChange = useMemo(
        () => debounce((val: string) => onChange(val), 300),
        [onChange]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        setLocalValue(val); // Instant visual update
        debouncedChange(val); // Delayed logical update
    };

    const handleBlur = (e: any) => {
        // Flush immediately on blur
        onChange(localValue);
        if (onBlur) onBlur(e);
    };

    return <TextField {...props} value={localValue} onChange={handleChange} onBlur={handleBlur} />;
});

// ==================================================================
// ||                     COMPONENT DEFINITION                     ||
// ==================================================================

export default function TabelaDinamicaMUI<T extends TableRowBase>({
    label,
    columns = [],
    data = [],
    onDataChange,
    readOnly = false,
    itemName = 'Item',
    itemNoun = 'o',
    renderMobileItem,
    onAddRow,
    onRowClick,
    disableRowClick = false
}: TabelaDinamicaProps<T>) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isSpreadsheet = !isMobile;

    // --- PERFORMANCE STATE ---
    // Mantemos uma cópia local para edição rápida (Rapid Input)
    const [localData, setLocalData] = useState<T[]>([]);

    // REF DE CONTROLE
    const isUserTyping = React.useRef(false);
    const latestLocalData = React.useRef(localData);
    const latestOnChange = React.useRef(onDataChange);
    const debounceTimerRef = React.useRef<any>(null);

    // Mantém refs atualizadas
    useEffect(() => {
        latestLocalData.current = localData;
    }, [localData]);

    useEffect(() => {
        latestOnChange.current = onDataChange;
    }, [onDataChange]);

    // 1. Sincroniza props -> state (Pai -> Filho)
    // SÓ atualiza se o usuário NÃO estiver digitando.
    useEffect(() => {
        if (!isUserTyping.current) {
            const dataWithIds = (Array.isArray(data) ? data : []).map((item, index) => ({
                ...item,
                id: item.id || localData[index]?.id || generateUniqueId(),
            })) as T[];

            setLocalData(dataWithIds);
        }
    }, [data]);
    // Nota: dependência 'localData' removida intencionalmente para evitar loop,
    // usamos o localData[index]?.id apenas se disponível na renderização corrente, o que é seguro.

    // 2. Debounce seguro (Filho -> Pai)
    useEffect(() => {
        // Se a mudança não foi disparo explícito de digitação (ex: carga inicial), não dispara timer
        if (isUserTyping.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

            debounceTimerRef.current = setTimeout(() => {
                if (latestOnChange.current) {
                    latestOnChange.current(latestLocalData.current);

                    // Resetamos flag para permitir que o input formatado volte do pai, se for o caso
                    // isUserTyping.current = false; 
                    // (Opcional: alguns preferem resetar só no onBlur. 
                    // Mas para garantir ciclo completo, resetar aqui permite que o pai assuma se o user parou.)
                    isUserTyping.current = false;
                }
            }, 800);
        }

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [localData]);


    // 3. Flush on Unmount (Salvar na Saída)
    useEffect(() => {
        return () => {
            // Se desmontou e tinha coisa pendente (user digitando ou timer rodando)
            if (isUserTyping.current && latestOnChange.current) {
                // Cancela timer pendente para evitar double save
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                // Força save imediato
                latestOnChange.current(latestLocalData.current);
            }
        };
    }, []);

    // 4. Manual Flush (usado no onBlur)
    const flush = useCallback(() => {
        if (isUserTyping.current && latestOnChange.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            latestOnChange.current(latestLocalData.current);
            isUserTyping.current = false;
        }
    }, []);

    // --- UI STATES ---
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | number | null>(null);
    const [activeCell, setActiveCell] = useState<{ id: string | number, field: string } | null>(null);

    // --- MOBILE ADD MODAL STATE ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItemTemp, setNewItemTemp] = useState<Partial<T>>({});

    // --- BACKWARD COMPATIBILITY ---
    const safeColumns = useMemo(() => {
        return (columns || []).map(col => ({
            ...col,
            id: col.id || (col as any).key,
            label: col.label || (col as any).header || (col as any).key
        }));
    }, [columns]);


    // --- HANDLERS ---

    const handleItemChange = (id: string | number, fieldKey: string, value: any) => {
        // Marca que usuário está mexendo
        isUserTyping.current = true;

        setLocalData(prev => prev.map(item => {
            if (item.id !== id) return item;
            return { ...item, [fieldKey]: value };
        }));
    };

    // Handler para mudança no modal de 'Novo Item'
    const handleNewItemChange = (fieldKey: string, value: any) => {
        setNewItemTemp(prev => ({ ...prev, [fieldKey]: value }));
    };

    const adicionarItem = () => {
        if (isMobile) {
            // No mobile, abre modal
            const initialItem: any = safeColumns.reduce((acc: any, col) => {
                acc[col.id] = '';
                if (col.unitSelector) {
                    acc[col.unitSelector.key] = col.unitSelector.options?.[0] || '';
                }
                return acc;
            }, { id: generateUniqueId() });

            setNewItemTemp(initialItem);
            setIsAddModalOpen(true);
        } else {
            // Desktop: Comportamento padrão (inline)
            const novoItem: any = safeColumns.reduce((acc: any, col) => {
                acc[col.id] = '';
                if (col.unitSelector) {
                    acc[col.unitSelector.key] = col.unitSelector.options?.[0] || '';
                }
                return acc;
            }, { id: generateUniqueId() });

            const newData = [...localData, novoItem];
            setLocalData(newData);
            if (onDataChange) onDataChange(newData);
        }
    };

    const salvarNovoItemMobile = () => {
        const itemToSave = { ...newItemTemp, id: newItemTemp.id || generateUniqueId() } as T;
        const newData = [...localData, itemToSave];
        setLocalData(newData);
        if (onDataChange) onDataChange(newData); // Save immediately
        setIsAddModalOpen(false);
        setNewItemTemp({});
    };

    const removerItem = (id: string | number) => {
        setItemToDelete(id);
    };

    const confirmarRemocao = () => {
        if (itemToDelete) {
            const newData = localData.filter(item => item.id !== itemToDelete);
            setLocalData(newData);
            if (onDataChange) onDataChange(newData); // Immediate sync for delete

            if (editingId === itemToDelete) setEditingId(null);
            setItemToDelete(null);
        }
    };

    const cancelarRemocao = () => {
        setItemToDelete(null);
    };

    const toggleEdit = (id: string | number) => {
        setEditingId(prev => prev === id ? null : id);
    };

    // --- RENDER HELPERS ---

    // --- RENDER HELPERS ---

    const renderValue = (item: Partial<T>, col: TableColumn) => {
        const val = item[col.id];

        // Safely handle objects (e.g., location selectors)
        if (val && typeof val === 'object') {
            if ('_display' in val) return val._display || '';
            if (val.talhao_nome || val.canteiro_nome) {
                return `📍 ${val.talhao_nome || '?'} › ${val.canteiro_nome || '?'}`;
            }
            // Fallback: avoid returning object directly
            return '-';
        }

        if (col.unitSelector) {
            return val !== undefined && val !== null ? `${val} ${item[col.unitSelector.key] ?? ''}` : '-';
        }
        return val ?? '-';
    };

    // Generic Input Render to reuse in Table and Modal
    const renderInputControl = (col: TableColumn, value: any, onChange: (val: any) => void, onBlurCmd?: () => void, unitValue?: any, onUnitChange?: (val: any) => void) => {
        // --- COMPLEX FIELDS (LOCATION) ---
        if (col.type === 'saf_visual' || col.type === 'saf_location') {
            const Component = col.type === 'saf_visual' ? SeletorLocalizacaoSaf : LocalizacaoSafInput;
            return (
                <Component
                    value={value ?? ''}
                    onChange={onChange}
                    size="small"
                />
            );
        }

        // --- SELECT TYPE ---
        if (col.type === 'select') {
            const options = col.options || [];
            const isValidOption = options.some((opt: string | TableOption) => {
                const val = typeof opt === 'object' ? opt.value : opt;
                return String(val) === String(value);
            });
            let safeValue = isValidOption ? value : '';

            return (
                <FormControl fullWidth size="small">
                    <Select
                        value={safeValue ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlurCmd}
                        displayEmpty
                    >
                        <MenuItem value="" disabled><em>Selecione</em></MenuItem>
                        {options.map((opt, index) => {
                            const val = typeof opt === 'object' ? opt.value : opt;
                            const lab = typeof opt === 'object' ? opt.label : opt;
                            return <MenuItem key={index} value={val}>{lab}</MenuItem>;
                        })}
                    </Select>
                </FormControl>
            );
        }

        // --- UNIT SELECTOR ---
        if (col.unitSelector) {
            const options = col.unitSelector.options || [];
            const currentVal = unitValue ?? '';
            const isCustom = currentVal && !options.includes(currentVal);
            const effectiveOptions = isCustom ? [currentVal, ...options] : options;

            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FastTextField
                        value={value ?? ''}
                        onChange={(val: any) => onChange(val)}
                        onBlur={onBlurCmd}
                        size="small"
                        fullWidth
                    />
                    <Select
                        value={currentVal}
                        onChange={(e) => onUnitChange && onUnitChange(e.target.value)}
                        onBlur={onBlurCmd}
                        size="small"
                        sx={{ minWidth: 70 }}
                    >
                        {effectiveOptions.map(opt => (
                            <MenuItem key={opt} value={opt}>
                                {isCustom && opt === currentVal ? `${opt} *` : opt}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            );
        }

        // --- STANDARD ---
        return (
            <FastTextField
                type={col.type === 'number' ? 'number' : 'text'}
                value={value ?? ''}
                onChange={(val: any) => onChange(val)}
                onBlur={onBlurCmd}
                size="small"
                fullWidth
                multiline={col.type === 'textarea'}
                rows={col.type === 'textarea' ? 3 : 1}
                InputProps={{
                    endAdornment: col.suffix ? <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>{col.suffix}</Typography> : null
                }}
            />
        );
    };

    // Wrapper for Main Table/Cards
    const renderField = (item: T, col: TableColumn) => {
        if (readOnly || col.readOnly) {
            return <Typography variant="body2">{String(renderValue(item, col))}</Typography>;
        }

        // Spreadsheet optimizations omitted for brevity in mobile fix, utilizing standard renderInputControl
        // But preventing spreadsheet mode logic in mobile is easy.

        return renderInputControl(
            col,
            item[col.id],
            (val) => handleItemChange(item.id, col.id, val),
            flush, // <--- FLUSH ON BLUR
            col.unitSelector ? item[col.unitSelector.key] : undefined,
            col.unitSelector ? (val) => handleItemChange(item.id, col.unitSelector!.key, val) : undefined
        );
    };

    // --- CARD MAP HELPERS ---
    const getCardMap = (cols: TableColumn[]) => {
        const titleCol = cols.find(c => ['produto', 'cultura', 'especie', 'nome'].includes(c.id)) || cols[0];
        const badgeCol = cols.find(c => ['atividade', 'tipo', 'status', 'categoria'].includes(c.id));
        const subtitleCol = cols.find(c => ['talhoes_canteiros', 'local', 'localizacao'].includes(c.id));
        const dateCol = cols.find(c => ['data', 'periodo', 'epoca'].includes(c.id));
        const footerCol = cols.find(c => c.unitSelector || ['quantidade', 'area_plantada', 'producao_esperada_ano'].includes(c.id));
        return { titleCol, badgeCol, subtitleCol, dateCol, footerCol };
    };
    const { titleCol, badgeCol, subtitleCol, dateCol, footerCol } = getCardMap(safeColumns);

    // --- RENDER ---

    return (
        <Box sx={{ my: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                {label && <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>{label}</Typography>}
                {isMobile && !readOnly && (
                    <Button
                        variant="contained" size="small" startIcon={<AddCircleOutlineIcon />}
                        onClick={adicionarItem} sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                        Adicionar
                    </Button>
                )}
            </Box>

            {isMobile ? (
                // --- MOBILE CARDS ---
                <Stack spacing={2}>
                    {localData.map((item) => {
                        const isEditing = editingId === item.id;
                        if (renderMobileItem && !isEditing) {
                            return (
                                <Box key={item.id}>
                                    {renderMobileItem(item, () => toggleEdit(item.id), () => removerItem(item.id))}
                                    <Collapse in={isEditing}>
                                        <Card variant="outlined" sx={{ mt: 1 }}>
                                            <Box sx={{ p: 2 }}>
                                                <Stack spacing={2}>
                                                    {safeColumns.map(col => <Box key={col.id}>{renderField(item, col)}</Box>)}
                                                </Stack>
                                                <Button onClick={() => setEditingId(null)} sx={{ mt: 2 }} fullWidth variant="contained">Concluir</Button>
                                            </Box>
                                        </Card>
                                    </Collapse>
                                </Box>
                            );
                        }

                        // Standard Card
                        return (
                            <Card
                                key={item.id}
                                elevation={0}
                                variant="outlined"
                                onClick={() => {
                                    if (!isEditing && !disableRowClick && onRowClick) {
                                        onRowClick(item);
                                    }
                                }}
                                sx={{
                                    borderRadius: 2,
                                    borderColor: '#e2e8f0',
                                    border: isEditing ? `1.5px solid ${theme.palette.primary.main}` : undefined,
                                    cursor: !isEditing && !disableRowClick && onRowClick ? 'pointer' : 'default',
                                    transition: 'all 0.2s',
                                    '&:hover': (!isEditing && !disableRowClick && onRowClick) ? {
                                        borderColor: theme.palette.primary.main,
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                    } : {}
                                }}
                            >
                                {!isEditing && (
                                    <CardContent sx={{ pb: '16px !important', pt: 2, px: 2 }}>
                                        {/* HEADER */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                            <Chip
                                                label={badgeCol && item[badgeCol.id] ? item[badgeCol.id] : (itemNoun?.toUpperCase() || 'ITEM')}
                                                size="small" color="success" variant="outlined"
                                                sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px' }}
                                            />
                                            <Box>
                                                <IconButton onClick={(e) => { e.stopPropagation(); toggleEdit(item.id); }} color="primary" size="small"><EditIcon fontSize="small" /></IconButton>
                                                <IconButton onClick={(e) => { e.stopPropagation(); removerItem(item.id); }} color="error" size="small"><DeleteIcon fontSize="small" /></IconButton>
                                            </Box>
                                        </Box>

                                        {/* BODY */}
                                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, color: '#1e293b', mb: 0.5 }}>
                                            {renderValue(item, titleCol)}
                                        </Typography>

                                        {footerCol && (
                                            <Box sx={{ mt: 1 }}>
                                                <Typography variant="caption" color="text.secondary">{footerCol.label}: </Typography>
                                                <Typography variant="body2" component="span" fontWeight={700}>{renderValue(item, footerCol)}</Typography>
                                            </Box>
                                        )}
                                    </CardContent>
                                )}

                                <Collapse in={isEditing}>
                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                        <Stack spacing={2}>
                                            <Typography variant="caption" fontWeight="bold" color="primary">EDITAR</Typography>
                                            {safeColumns.map(col => (
                                                <Box key={col.id}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>{col.label}</Typography>
                                                    {renderField(item, col)}
                                                </Box>
                                            ))}
                                            <Button onClick={() => setEditingId(null)} fullWidth variant="contained" startIcon={<SaveIcon />}>Concluir Edição</Button>
                                        </Stack>
                                    </Box>
                                </Collapse>
                            </Card>
                        );
                    })}
                </Stack>
            ) : (
                // --- DESKTOP TABLE ---
                <TableContainer component={Paper} variant="outlined" elevation={0} sx={{ borderRadius: 1, borderColor: '#e2e8f0' }}>
                    <Table size="small">
                        <TableHead>
                            <MuiTableRow sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {safeColumns.map(col => (
                                    <TableCell key={col.id} sx={{ fontWeight: '600', color: '#64748b', fontSize: '0.75rem', py: 1 }}>
                                        {col.label?.toUpperCase()}
                                    </TableCell>
                                ))}
                                {!readOnly && <TableCell align="center" sx={{ fontWeight: '600', width: '90px', color: '#64748b', fontSize: '0.75rem' }}>AÇÕES</TableCell>}
                            </MuiTableRow>
                        </TableHead>
                        <TableBody>
                            {localData.map((item) => (
                                <MuiTableRow
                                    key={item.id}
                                    hover={!!onRowClick && !disableRowClick}
                                    onClick={() => {
                                        if (!disableRowClick && onRowClick) {
                                            onRowClick(item);
                                        }
                                    }}
                                    sx={{
                                        '& td': { borderBottom: '1px solid #f1f5f9' },
                                        cursor: !disableRowClick && onRowClick ? 'pointer' : 'default'
                                    }}
                                >
                                    {safeColumns.map(col => (
                                        <TableCell key={col.id} sx={{ p: 0.5 }}>{renderField(item, col)}</TableCell>
                                    ))}
                                    {!readOnly && (
                                        <TableCell align="center" sx={{ p: 0.5 }}>
                                            <Tooltip title="Remover">
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removerItem(item.id);
                                                    }}
                                                    color="error"
                                                    size="small"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    )}
                                </MuiTableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!isMobile && !readOnly && (
                <Button
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={adicionarItem}
                    sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}
                >
                    Adicionar nov{itemNoun} {itemName}
                </Button>
            )}

            {/* DIALOG DE EXCLUSAO */}
            <Dialog open={!!itemToDelete} onClose={cancelarRemocao}>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogContent><DialogContentText>Deseja remover este item?</DialogContentText></DialogContent>
                <DialogActions>
                    <Button onClick={cancelarRemocao}>Cancelar</Button>
                    <Button onClick={confirmarRemocao} color="error" variant="contained">Remover</Button>
                </DialogActions>
            </Dialog>

            {/* DIALOG ADD ITEM MOBILE */}
            <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Adicionar {itemName}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {safeColumns.map(col => (
                            <Box key={col.id}>
                                <Typography variant="caption" color="text.secondary">{col.label}</Typography>
                                {renderInputControl(
                                    col,
                                    newItemTemp[col.id],
                                    (val) => handleNewItemChange(col.id, val),
                                    undefined,
                                    col.unitSelector ? newItemTemp[col.unitSelector.key] : undefined,
                                    col.unitSelector ? (val) => handleNewItemChange(col.unitSelector!.key, val) : undefined
                                )}
                            </Box>
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                    <Button onClick={salvarNovoItemMobile} variant="contained" color="primary">Adicionar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
