import React from 'react';
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Typography, Chip,
    Tooltip, CircularProgress, useMediaQuery, useTheme,
    TextField, Checkbox, FormControlLabel, Stack,
    Card, CardContent, InputAdornment,
    Popover, TablePagination, MenuItem
} from '@mui/material';

import {
    CadernoCampoRecord,
    ActivityType,
    ManejoSubtype,
    DetalhesManejo,
    DetalhesColheita,
    DetalhesPlantio
} from '../types/CadernoTypes';

// Icons
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BlockIcon from '@mui/icons-material/Block';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PlaceIcon from '@mui/icons-material/Place';
import MicIcon from '@mui/icons-material/Mic';

// Import shared types
import { FieldDiaryFilters } from '../hooks/useFieldDiary';
import { formatDateBR, formatComplianceMessage } from '../utils/formatters';
import { AlertTriangle } from 'lucide-react'; // Added import

interface FieldDiaryTableV2Props {
    // Data (Prefiltered & Paginated)
    registros: CadernoCampoRecord[];
    totalCount: number;
    loading: boolean;

    // Filters (Passed from Hook)
    filtrosAtivos: FieldDiaryFilters;
    onChangeFiltros: (f: FieldDiaryFilters) => void;

    // Pagination (Passed from Hook)
    page: number;
    rowsPerPage: number;
    onPageChange: (event: unknown, newPage: number) => void;
    onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;

    // Actions
    onVisualizar: (reg: CadernoCampoRecord) => void;
    onEditar: (reg: CadernoCampoRecord) => void;
    onExcluir: (reg: CadernoCampoRecord) => void;
    onAtualizar: () => void;
    onNovoRegistro: () => void;
}

const FieldDiaryTableV2: React.FC<FieldDiaryTableV2Props> = ({
    registros,
    totalCount,
    loading,
    filtrosAtivos,
    onChangeFiltros,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    onVisualizar,
    onEditar,
    onExcluir,
    onAtualizar,
    onNovoRegistro
}) => {
    // --- UI STATE ONLY (Filter Popover) ---
    const [filterAnchorEl, setFilterAnchorEl] = React.useState<null | HTMLElement>(null);
    const [activeFilterColumn, setActiveFilterColumn] = React.useState<string | null>(null);

    const handleOpenFilter = (event: React.MouseEvent<HTMLElement>, column: string) => {
        setFilterAnchorEl(event.currentTarget);
        setActiveFilterColumn(column);
    };

    const handleCloseFilter = () => {
        setFilterAnchorEl(null);
        setActiveFilterColumn(null);
    };

    const handleFilterChange = (field: keyof FieldDiaryFilters, value: any) => {
        onChangeFiltros({
            ...filtrosAtivos,
            [field]: value
        });
        // Note: Page reset is handled in the Hook now
    };

    // --- HELPER RENDERS (Pure Functions) ---
    const getStatusColor = (tipo: string): any => {
        const map: any = {
            'Insumo': 'warning',
            'Manejo': 'info',
            'Plantio': 'success',
            'Colheita': 'primary',
            'CANCELADO': 'error'
        };
        return map[tipo] || 'default';
    };

    const getRegistroLocalResumo = (reg: CadernoCampoRecord): string => {
        // 1. Se tem atividades, extrair locais únicos
        if (reg.atividades && reg.atividades.length > 0) {
            const locaisUnicos = new Set<string>();
            for (const item of reg.atividades) {
                if (item.local?.talhao) {
                    const local = item.local.canteiro
                        ? `${item.local.talhao}, Canteiro ${item.local.canteiro}`
                        : item.local.talhao;
                    locaisUnicos.add(local);
                }
            }
            const locaisArr = Array.from(locaisUnicos);
            if (locaisArr.length === 0) return reg.talhao_canteiro || 'Local não informado';
            if (locaisArr.length === 1) return locaisArr[0];
            return `${locaisArr[0]} +${locaisArr.length - 1}`;
        }
        // 2. Fallback
        return reg.talhao_canteiro || 'Local não informado';
    };

    const renderDetails = (row: CadernoCampoRecord) => {
        const details = row.detalhes_tecnicos || {};
        const tipo = row.tipo_atividade;
        const complianceMsg = formatComplianceMessage(row.observacao_original);

        // 1. Compliance Alert (Prioridade Visual via Tooltip)
        if (complianceMsg) {
            return (
                <div className="relative flex items-center group cursor-pointer ml-1 inline-flex">
                    {/* Ícone Visível */}
                    <AlertTriangle className="w-5 h-5 text-amber-500 hover:text-amber-600 transition-colors" />

                    {/* Balão do Tooltip */}
                    <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-2 hidden group-hover:block group-active:block w-64 p-3 text-xs sm:text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg shadow-xl z-50 pointer-events-none">
                        <div className="absolute top-full right-2 sm:left-1/2 sm:-translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-amber-200"></div>
                        <p className="font-bold mb-1 uppercase tracking-tight text-[10px] opacity-70">Alerta de Compliance</p>
                        {complianceMsg}
                    </div>
                </div>
            );
        }

        if (tipo === ActivityType.MANEJO || tipo === 'Manejo') {
            const d = details as DetalhesManejo;
            if (d.subtipo === ManejoSubtype.HIGIENIZACAO) {
                return (
                    <Box component="span">
                        {d.item_higienizado && (
                            <Chip label={`🧹 ${d.item_higienizado}`} size="small" color="info" variant="outlined" sx={{ mr: 1, my: 0.5 }} />
                        )}
                        {d.produto_utilizado && <Typography variant="caption" color="text.secondary" component="span">com {d.produto_utilizado}</Typography>}
                    </Box>
                );
            }
            if (d.subtipo === ManejoSubtype.APLICACAO_INSUMO) {
                const dose = d.dosagem ? `${d.dosagem}${d.unidade_dosagem || ''}` : '';
                return (
                    <Box component="span">
                        <Chip label={`💊 ${d.insumo || d.nome_insumo || 'Insumo'}`} size="small" color="warning" variant="outlined" sx={{ mr: 1, my: 0.5 }} />
                        {dose && <Typography variant="caption" component="span">{dose}</Typography>}
                    </Box>
                );
            }
            const ativ = d.atividade || d.tipo_manejo || row.observacao_original;
            return <Typography variant="body2" color="text.primary" component="span">{ativ}</Typography>;
        }

        if (tipo === ActivityType.COLHEITA || tipo === 'Colheita') {
            const d = details as DetalhesColheita;
            return (
                <Box component="span">
                    {d.lote && <Chip label={`📦 ${d.lote}`} size="small" sx={{ mr: 1, bgcolor: '#fef3c7', color: '#d97706', my: 0.5 }} />}
                    {d.classificacao && <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 'bold' }} component="span">{d.classificacao}</Typography>}
                </Box>
            );
        }

        if (tipo === ActivityType.PLANTIO || tipo === 'Plantio') {
            const d = details as DetalhesPlantio;
            return (
                <Box component="span">
                    <Chip label={`🌱 ${d.metodo_propagacao || 'Plantio'}`} size="small" color="success" variant="outlined" sx={{ mr: 1, my: 0.5 }} />
                </Box>
            );
        }

        return (
            <Tooltip title={row.observacao_original || ''}>
                <Typography variant="body2" sx={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {row.observacao_original || '-'}
                </Typography>
            </Tooltip>
        );
    };

    const getAlertIcon = (reg: CadernoCampoRecord) => {
        const obs = reg.observacao_original || '';
        const isCompliance = formatComplianceMessage(obs);
        // Se já exibimos a mensagem de compliance no renderDetails, não precisamos do ícone aqui para evitar redundância, 
        // ou mantemos apenas ícones criticos de bloqueio.
        if (isCompliance) return null;

        if (obs.includes('⛔') || obs.includes('RECUSADO')) {
            return <Tooltip title="Registro Recusado / Bloqueado"><BlockIcon color="error" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} /></Tooltip>;
        }
        if (obs.includes('⚠️') || obs.includes('[SISTEMA') || obs.includes('ALERTA')) {
            return <Tooltip title="Alerta do Sistema"><ReportProblemIcon color="warning" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} /></Tooltip>;
        }
        return null;
    };

    const renderFilterPopover = () => {
        if (!activeFilterColumn) return null;

        return (
            <Popover
                open={Boolean(filterAnchorEl)}
                anchorEl={filterAnchorEl}
                onClose={handleCloseFilter}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                {activeFilterColumn === 'data' && (
                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 250 }}>
                        <Typography variant="subtitle2" fontWeight="bold">Filtrar por Período</Typography>
                        <TextField
                            label="Data Início" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
                            value={filtrosAtivos.dataInicio} onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
                        />
                        <TextField
                            label="Data Fim" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
                            value={filtrosAtivos.dataFim} onChange={(e) => handleFilterChange('dataFim', e.target.value)}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => { handleFilterChange('dataInicio', ''); handleFilterChange('dataFim', ''); }}
                            >
                                Limpar
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleCloseFilter}
                            >
                                OK
                            </button>
                        </Box>
                    </Box>
                )}

                {activeFilterColumn === 'atividade' && (
                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
                        <Typography variant="subtitle2" fontWeight="bold">Filtrar por Atividade</Typography>
                        <TextField
                            select label="Selecione" size="small" fullWidth
                            value={filtrosAtivos.tipo_atividade} onChange={(e) => handleFilterChange('tipo_atividade', e.target.value)}
                            SelectProps={{ native: true }}
                        >
                            <option value="Todos">Todas</option>
                            <option value={ActivityType.PLANTIO}>Plantio</option>
                            <option value={ActivityType.MANEJO}>Manejo</option>
                            <option value={ActivityType.COLHEITA}>Colheita</option>
                            <option value={ActivityType.INSUMO}>Insumo</option>
                            <option value={ActivityType.OUTRO}>Outro</option>
                            <option value={ActivityType.CANCELADO}>CANCELADO</option>
                        </TextField>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleFilterChange('tipo_atividade', 'Todos')}
                            >
                                Limpar
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleCloseFilter}
                            >
                                OK
                            </button>
                        </Box>
                    </Box>
                )}

                {activeFilterColumn === 'produto' && (
                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 250 }}>
                        <Typography variant="subtitle2" fontWeight="bold">Filtrar por Produto</Typography>
                        <TextField
                            label="Contém..." size="small" fullWidth autoFocus
                            value={filtrosAtivos.produto} onChange={(e) => handleFilterChange('produto', e.target.value)}
                            InputProps={{
                                endAdornment: filtrosAtivos.produto && (
                                    <InputAdornment position="end">
                                        <button
                                            type="button"
                                            className="p-1 text-gray-400 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => handleFilterChange('produto', '')}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </button>
                                    </InputAdornment>
                                )
                            }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleCloseFilter}
                            >
                                OK
                            </button>
                        </Box>
                    </Box>
                )}

                {activeFilterColumn === 'local' && (
                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 250 }}>
                        <Typography variant="subtitle2" fontWeight="bold">Filtrar por Local</Typography>
                        <TextField
                            label="Contém..." size="small" fullWidth autoFocus
                            value={filtrosAtivos.local} onChange={(e) => handleFilterChange('local', e.target.value)}
                            InputProps={{
                                endAdornment: filtrosAtivos.local && (
                                    <InputAdornment position="end">
                                        <button
                                            type="button"
                                            className="p-1 text-gray-400 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => handleFilterChange('local', '')}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </button>
                                    </InputAdornment>
                                )
                            }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleCloseFilter}
                            >
                                OK
                            </button>
                        </Box>
                    </Box>
                )}
            </Popover>
        );
    };

    return (
        <Stack spacing={3} sx={{ width: '100%', mb: 10 }}>
            {/* 1. HEADER & ACTIONS */}
            <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: { xs: 1.5, sm: 2 } }}>
                        <Typography variant="h6" sx={{ display: 'flex', gap: 1, fontWeight: 'bold', alignItems: 'center' }}>
                            <ListAltIcon color="primary" /> Diário de Campo
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', maxWidth: { xs: '100%', sm: 'auto' } }}>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={onAtualizar}
                            >
                                <RefreshIcon className="w-5 h-5 mr-2" />
                                Atualizar
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={onNovoRegistro}
                            >
                                <AddIcon className="w-5 h-5 mr-2" />
                                Novo Registro
                            </button>
                        </Box>
                    </Box>
                    <FormControlLabel
                        control={<Checkbox checked={filtrosAtivos.incluirCancelados} onChange={(e) => handleFilterChange('incluirCancelados', e.target.checked)} color="default" size="small" />}
                        label="Ver Cancelados"
                        sx={{ ml: 0, '& .MuiTypography-root': { fontSize: '0.85rem', color: 'text.secondary' } }}
                    />
                </Box>
            </Paper>

            {/* 3. CONTENT AREA */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : registros.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">Nenhum registro encontrado para os filtros selecionados.</Typography></Paper>
            ) : (
                <>
                    {/* --- DESKTOP TABLE --- */}
                    <div className="w-full max-w-full overflow-x-auto block">
                        <TableContainer component={Paper} elevation={0} sx={{ display: { xs: 'none', md: 'block' }, width: '100%', mb: 2, boxShadow: 'none' }}>
                            <Table size="medium" sx={{ width: '100%', minWidth: 800 }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ width: '10%' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={(e) => handleOpenFilter(e, 'data')}>
                                                Data <FilterListIcon fontSize="small" sx={{ ml: 0.5, opacity: (filtrosAtivos.dataInicio || filtrosAtivos.dataFim) ? 1 : 0.3 }} color={(filtrosAtivos.dataInicio || filtrosAtivos.dataFim) ? "primary" : "inherit"} />
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ width: '12%' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={(e) => handleOpenFilter(e, 'atividade')}>
                                                Atividade <FilterListIcon fontSize="small" sx={{ ml: 0.5, opacity: filtrosAtivos.tipo_atividade !== 'Todos' ? 1 : 0.3 }} color={filtrosAtivos.tipo_atividade !== 'Todos' ? "primary" : "inherit"} />
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ width: '22%' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={(e) => handleOpenFilter(e, 'produto')}>
                                                Produto / Cultura <FilterListIcon fontSize="small" sx={{ ml: 0.5, opacity: filtrosAtivos.produto ? 1 : 0.3 }} color={filtrosAtivos.produto ? "primary" : "inherit"} />
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ width: '26%', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={(e) => handleOpenFilter(e, 'local')}>
                                                Localização <FilterListIcon fontSize="small" sx={{ ml: 0.5, opacity: filtrosAtivos.local ? 1 : 0.3 }} color={filtrosAtivos.local ? "primary" : "inherit"} />
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ width: '20%', fontWeight: 'bold', whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible' }}>Resumo</TableCell>
                                        <TableCell sx={{ width: '12%', fontWeight: 'bold' }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><MicIcon fontSize="small" /> Áudio</Box></TableCell>
                                        <TableCell align="center" sx={{ width: '8%', fontWeight: 'bold' }}>Ações</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {registros.map((reg) => {
                                        const isCancelled = reg.tipo_atividade === ActivityType.CANCELADO;
                                        return (
                                            <TableRow key={reg.id} hover sx={{ opacity: isCancelled ? 0.6 : 1, bgcolor: isCancelled ? '#fff5f5' : 'inherit' }}>
                                                <TableCell>{formatDateBR(reg.data_registro)}</TableCell>
                                                <TableCell><Chip label={reg.tipo_atividade} color={getStatusColor(reg.tipo_atividade)} size="small" variant={isCancelled ? "outlined" : "filled"} /></TableCell>
                                                <TableCell sx={{ fontWeight: 500 }}>{reg.produto}</TableCell>
                                                <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{getRegistroLocalResumo(reg)}</TableCell>
                                                <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible' }}><Box sx={{ display: 'flex', alignItems: 'center' }}>{getAlertIcon(reg)}{renderDetails(reg)}</Box></TableCell>
                                                <TableCell>{reg.audio_url ? <audio controls src={reg.audio_url} preload="metadata" style={{ height: '32px', maxWidth: '180px', width: '100%' }} /> : <Typography variant="body2" color="text.disabled">—</Typography>}</TableCell>
                                                <TableCell align="center">
                                                    <Stack direction="row" justifyContent="center" spacing={1}>
                                                        <Tooltip title="Ver Detalhes">
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center justify-center p-1.5 text-gray-500 transition-colors bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                onClick={() => onVisualizar(reg)}
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </button>
                                                        </Tooltip>
                                                        {!isCancelled && (
                                                            <>
                                                                <Tooltip title="Editar">
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex items-center justify-center p-1.5 text-indigo-700 transition-colors bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        onClick={() => onEditar(reg)}
                                                                    >
                                                                        <EditIcon fontSize="small" />
                                                                    </button>
                                                                </Tooltip>
                                                                <Tooltip title="Excluir/Cancelar">
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex items-center justify-center p-1.5 text-red-700 transition-colors bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        onClick={() => onExcluir(reg)}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </button>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </div>

                    {/* --- MOBILE CARDS --- */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                        {registros.map((reg) => {
                            const isCancelled = reg.tipo_atividade === ActivityType.CANCELADO;
                            const getColors = () => {
                                switch (reg.tipo_atividade) {
                                    case ActivityType.PLANTIO: case 'Plantio': return { border: '#2e7d32', chip: 'success' };
                                    case ActivityType.MANEJO: case 'Manejo': return { border: '#0288d1', chip: 'info' };
                                    case ActivityType.COLHEITA: case 'Colheita': return { border: '#ed6c02', chip: 'warning' };
                                    case ActivityType.CANCELADO: return { border: '#ef5350', chip: 'error' };
                                    default: return { border: '#bdbdbd', chip: 'default' };
                                }
                            };
                            const colors = getColors();
                            const hasAlert = (reg.observacao_original || '').includes('⛔') || (reg.observacao_original || '').includes('⚠️') || (reg.observacao_original || '').includes('[SISTEMA');
                            const alertIcon = getAlertIcon(reg);

                            return (
                                <Card key={reg.id} sx={{ borderRadius: 3, boxShadow: 3, borderWidth: 2, borderStyle: 'solid', borderColor: colors.border, opacity: isCancelled ? 0.7 : 1, mb: 1, overflow: 'hidden' }}>
                                    <Box sx={{ p: 2.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}>
                                                <CalendarTodayIcon fontSize="inherit" sx={{ fontSize: '1rem', mb: 0.2 }} /> {formatDateBR(reg.data_registro)}
                                            </Typography>
                                            <Chip label={reg.tipo_atividade.toUpperCase()} color={colors.chip as any} size="small" sx={{ fontWeight: 'bold', borderRadius: 1 }} />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>{reg.produto}</Typography>
                                    </Box>
                                    <Box sx={{ p: 2 }}>
                                        <Box sx={{ bgcolor: '#f9fafb', borderRadius: 2, border: '1px solid #e5e7eb', p: 1.5 }}>
                                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
                                                <PlaceIcon fontSize="inherit" /> Localização
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{getRegistroLocalResumo(reg)}</Typography>
                                        </Box>
                                        {(hasAlert || reg.observacao_original || reg.detalhes_tecnicos) && (
                                            <>
                                                <Typography variant="caption" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', mt: 2, mb: 1 }}>Observações</Typography>
                                                {formatComplianceMessage(reg.observacao_original) ? (
                                                    <div className="relative flex items-center group cursor-pointer mt-2 w-fit">
                                                        <div className="flex items-center gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                                                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                                            <span className="font-bold">Ver Alerta de Compliance</span>
                                                        </div>

                                                        {/* Tooltip Mobile Overlay */}
                                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block group-active:block w-72 p-4 text-sm text-amber-900 bg-white border border-amber-200 rounded-lg shadow-2xl z-50 pointer-events-none">
                                                            <div className="absolute top-full left-4 -mt-[1px] border-4 border-transparent border-t-amber-200"></div>
                                                            <p className="font-bold mb-1 uppercase tracking-widest text-[10px] text-amber-600">Alerta de Compliance</p>
                                                            {formatComplianceMessage(reg.observacao_original)}
                                                        </div>
                                                    </div>
                                                ) : hasAlert ? (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2, p: 1.5 }}>
                                                        {alertIcon} <Typography variant="body2" color="warning.dark" fontWeight={500}>Registro Automático</Typography>
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ mt: 0.5, p: 1.5, bgcolor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 2 }}>{renderDetails(reg)}</Box>
                                                )}
                                            </>
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: { xs: 0.5, sm: 1 }, width: '100%', mt: 1, borderTop: '1px solid #e5e7eb', bgcolor: '#f9fafb', p: 1 }}>
                                        <button
                                            type="button"
                                            className="flex items-center justify-center flex-1 px-2 py-2 gap-1 text-xs sm:text-sm font-bold text-gray-600 transition-colors rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => onVisualizar(reg)}
                                        >
                                            <VisibilityIcon className="w-4 h-4" /> VER
                                        </button>
                                        {!isCancelled && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="flex items-center justify-center flex-1 px-2 py-2 gap-1 text-xs sm:text-sm font-bold text-indigo-700 transition-colors rounded-md hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    onClick={() => onEditar(reg)}
                                                >
                                                    <EditIcon className="w-4 h-4" /> EDITAR
                                                </button>
                                                <button
                                                    type="button"
                                                    className="flex items-center justify-center flex-1 px-2 py-2 gap-1 text-xs sm:text-sm font-bold text-red-700 transition-colors rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    onClick={() => onExcluir(reg)}
                                                >
                                                    <DeleteIcon className="w-4 h-4" /> EXCLUIR
                                                </button>
                                            </>
                                        )}
                                    </Box>
                                </Card>
                            );
                        })}
                    </Box>

                    {/* SHARED PAGINATION CONTROLS */}
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={onPageChange}
                        onRowsPerPageChange={onRowsPerPageChange}
                        labelRowsPerPage="Linhas:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`}
                    />
                </>
            )}

            {!loading && totalCount > 0 && (
                <Typography variant="caption" color="text.secondary" align="right" sx={{ mr: 2 }}>
                    Total Geral: {totalCount}
                </Typography>
            )}

            {renderFilterPopover()}
        </Stack>
    );
};

export default FieldDiaryTableV2;
