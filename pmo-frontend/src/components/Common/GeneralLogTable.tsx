import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    Box, Paper, Typography, Chip, IconButton,
    Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText,
    TextField, DialogActions, Button, FormControlLabel, Switch,
    CircularProgress, useMediaQuery, useTheme, Alert
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import ListAltIcon from '@mui/icons-material/ListAlt';

import MobileLogCard from './MobileLogCard';

import {
    CadernoEntry,
    ActivityType,
    ManejoSubtype,
    DetalhesManejo,
    DetalhesColheita,
    DetalhesPlantio
} from '../../types/CadernoTypes';

import ManualRecordDialog from '../Dashboard/ManualRecordDialog';
import { formatDateBR } from '../../utils/formatters';

interface GeneralLogTableProps {
    pmoId: number | undefined | null;
}

interface EditValues {
    atividade?: string;
    local?: string;
    produto?: string;
    quantidade?: string | number;
    valor?: string | number;
}

const GeneralLogTable: React.FC<GeneralLogTableProps> = ({ pmoId }) => {
    const [registros, setRegistros] = useState<CadernoEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    const theme = useTheme();
    // unused isMobile for now but keeping for consistency with original or future use
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Estados do Modal
    const [openDialog, setOpenDialog] = useState(false);
    const [actionType, setActionType] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<CadernoEntry | null>(null);
    const [justificativa, setJustificativa] = useState('');

    // Edit Dialog State
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        if (pmoId) fetchRegistros();
    }, [pmoId]);

    const fetchRegistros = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('caderno_campo')
                .select('*')
                .eq('pmo_id', pmoId)
                .order('data_registro', { ascending: false });

            if (error) {
                console.error("Erro ao buscar registros:", error);
                throw error;
            }
            console.log('Registros com N:N:', data);
            // Cast to compatible type or let inference work if shape matches
            setRegistros((data as any[]) || []);
        } catch (error: any) {
            console.error("Erro ao buscar registros:", error);
            console.warn("Detalhes:", error.message);
            setRegistros([]);
        } finally {
            setLoading(false);
        }
    };

    const visibleRegistros = (showDeleted
        ? registros
        : registros.filter(r => r && r.tipo_atividade !== 'CANCELADO')) || [];

    // --- SMART RENDER DISCIMINATED COLUMNS ---
    const renderDetails = (row: CadernoEntry) => {
        const details = row.detalhes_tecnicos || {};
        const tipo = row.tipo_atividade;

        // 1. Manejo
        if (tipo === ActivityType.MANEJO || tipo === 'Manejo') {
            const d = details as DetalhesManejo;

            // Higienização
            if (d.subtipo === ManejoSubtype.HIGIENIZACAO) {
                return (
                    <Box>
                        {d.item_higienizado && (
                            <Chip
                                label={`🧹 ${d.item_higienizado}`}
                                size="small"
                                color="info"
                                variant="outlined"
                                sx={{ mr: 1 }}
                            />
                        )}
                        {d.produto_utilizado && d.produto_utilizado !== 'NÃO INFORMADO' && (
                            <Typography variant="caption" color="text.secondary">
                                com {d.produto_utilizado}
                            </Typography>
                        )}
                    </Box>
                );
            }
            // Aplicação de Insumo
            if (d.subtipo === ManejoSubtype.APLICACAO_INSUMO) {
                const dose = d.dosagem ? `${d.dosagem}${d.unidade_dosagem || ''}` : '';
                return (
                    <Box>
                        <Chip
                            label={`💊 ${d.insumo || d.nome_insumo || 'Insumo'}`}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mr: 1 }}
                        />
                        {dose && <Typography variant="caption">{dose}</Typography>}
                    </Box>
                );
            }
            // Manejo Cultural (Default)
            // Tenta usar 'atividade' do novo schema, ou fallback para 'tipo_manejo' ou observacao original
            const ativ = d.atividade || d.tipo_manejo || row.observacao_original;
            return (
                <Typography variant="body2" color="text.primary">
                    {ativ}
                </Typography>
            );
        }

        // 2. Colheita
        if (tipo === ActivityType.COLHEITA || tipo === 'Colheita') {
            const d = details as DetalhesColheita;
            return (
                <Box>
                    {d.lote && (
                        <Chip
                            label={`📦 ${d.lote}`}
                            size="small"
                            sx={{ mr: 1, bgcolor: '#fef3c7', color: '#d97706' }}
                        />
                    )}
                    {d.classificacao && (
                        <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 'bold' }}>
                            {d.classificacao}
                        </Typography>
                    )}
                </Box>
            );
        }

        // 3. Plantio
        if (tipo === ActivityType.PLANTIO || tipo === 'Plantio') {
            const d = details as DetalhesPlantio;
            return (
                <Box>
                    <Chip
                        label={`🌱 ${d.metodo_propagacao || 'Plantio'}`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ mr: 1 }}
                    />
                </Box>
            );
        }

        // Default / Fallback
        return (
            <Tooltip title={row.observacao_original || ''}>
                <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {row.observacao_original || '-'}
                </Typography>
            </Tooltip>
        );
    };


    const handleOpenAction = (item: CadernoEntry, type: string) => {
        setSelectedItem(item);
        setActionType(type);
        setJustificativa('');

        if (type === 'EDIT') {
            setIsEditOpen(true);
            return;
        }
        setOpenDialog(true);
    };

    const handleClose = () => {
        setOpenDialog(false);
        setSelectedItem(null);
    };

    const handleConfirmAction = async () => {
        if (justificativa.length < 5) {
            alert("A justificativa é obrigatória (mínimo 5 letras).");
            return;
        }

        if (!selectedItem) return;

        try {
            const logEntry = {
                data: new Date().toISOString(),
                acao: actionType,
                motivo: justificativa,
                dados_anteriores: {
                    tipo: selectedItem.tipo_atividade,
                    produto: selectedItem.produto,
                    qtd: selectedItem.quantidade_valor
                }
            };

            const currentDetails = selectedItem.detalhes_tecnicos || {};
            // @ts-ignore
            const historico = currentDetails.historico_alteracoes || [];
            const newDetails = {
                ...currentDetails,
                historico_alteracoes: [...historico, logEntry]
            };

            let updatePayload: any = {};

            if (actionType === 'DELETE') {
                updatePayload = {
                    tipo_atividade: 'CANCELADO',
                    observacao_original: `[CANCELADO] ${selectedItem.observacao_original}`,
                    detalhes_tecnicos: newDetails
                };
                // Only process DELETE here. EDIT is handled by ManualRecordDialog.
                if (actionType !== 'DELETE') return;

                const { data, error } = await supabase
                    .from('caderno_campo')
                    .update(updatePayload)
                    .eq('id', selectedItem.id)
                    .select();

                if (error) throw error;

                if (!data || data.length === 0) {
                    alert("⚠️ ATENÇÃO: O banco recusou a alteração. Verifique se o usuário tem permissão (RLS) no Supabase.");
                    return;
                }

                await fetchRegistros();
                handleClose();
            }

        } catch (err: any) {
            alert("Erro ao salvar: " + err.message);
        }
    };

    const getStatusColor = (tipo: string) => {
        const map: Record<string, "warning" | "info" | "success" | "primary" | "error" | "default"> = {
            'Insumo': 'warning', 'Manejo': 'info', 'Plantio': 'success',
            'Colheita': 'primary', 'CANCELADO': 'error'
        };
        return map[tipo] || 'default';
    };


    if (!pmoId) return (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            Carregando caderno...
        </Box>
    );

    return (
        <Box sx={{ mt: 0, p: 2, bgcolor: '#fff', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
                    <ListAltIcon /> Diário de Campo Completo (Auditoria)
                </Typography>

                <FormControlLabel
                    control={<Switch checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} color="error" />}
                    label="Ver Excluídos"
                />
            </Box>

            {/* --- DESKTOP TABLE --- */}
            <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '100%' }}>
                <div className="w-full overflow-x-auto block border border-gray-200 rounded-xl shadow-sm bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Data</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Atividade</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Produto / Local</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Qtd</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center"><CircularProgress size={24} sx={{ my: 2 }} /></td></tr>
                            ) : (visibleRegistros || []).length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                            ) : (
                                (visibleRegistros || []).map((row) => {
                                    if (!row) return null; // Proteção contra linhas nulas
                                    const isCancelado = row.tipo_atividade === 'CANCELADO';
                                    const details = row.detalhes_tecnicos as any || {};
                                    const historico = details.historico_alteracoes || [];
                                    const ultimaJustificativa = historico.length > 0 ? historico[historico.length - 1].motivo : null;

                                    return (
                                        <tr
                                            key={row.id}
                                            className={`hover:bg-gray-50 transition-colors ${isCancelado ? 'bg-red-50/50' : ''}`}
                                            style={{ opacity: isCancelado ? 0.8 : 1 }}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                                                {formatDateBR(row.data_registro)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                                                <Chip
                                                    label={row.tipo_atividade}
                                                    color={getStatusColor(row.tipo_atividade)}
                                                    size="small"
                                                    variant={isCancelado ? "outlined" : "filled"}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 align-top">
                                                <div className={isCancelado ? 'line-through decoration-red-500 text-red-700' : 'font-medium'}>
                                                    {row.produto}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {row.caderno_campo_canteiros && row.caderno_campo_canteiros.length > 0
                                                        ? `Canteiros: ${row.caderno_campo_canteiros.map((c: any) => c.canteiros?.nome).join(', ')}`
                                                        : (row.talhao_canteiro !== 'NÃO INFORMADO' ? row.talhao_canteiro : '')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                                                {Number(row.quantidade_valor) > 0 ? (
                                                    <>
                                                        {row.quantidade_valor}
                                                        {row.quantidade_unidade ? ` ${row.quantidade_unidade}` : ''}
                                                    </>
                                                ) : '-'}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-gray-900 align-top max-w-xs">
                                                {/* SMART RENDER HERE */}
                                                <div className={isCancelado ? 'line-through decoration-gray-400' : ''}>
                                                    {renderDetails(row)}
                                                </div>

                                                {isCancelado && ultimaJustificativa && (
                                                    <div className="mt-2 p-1.5 px-2 bg-red-50 rounded border border-dashed border-red-300 inline-block">
                                                        <span className="text-xs font-bold text-red-600">
                                                            MOTIVO: {ultimaJustificativa}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                                {!isCancelado ? (
                                                    <div className="flex justify-end gap-1">
                                                        <Tooltip title="Corrigir">
                                                            <button
                                                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                                                onClick={() => handleOpenAction(row, 'EDIT')}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </button>
                                                        </Tooltip>
                                                        <Tooltip title="Invalidar">
                                                            <button
                                                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                                onClick={() => handleOpenAction(row, 'DELETE')}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                ) : (
                                                    <Tooltip title="Registro Auditado">
                                                        <span className="text-gray-400 cursor-not-allowed"><HistoryIcon fontSize="small" /></span>
                                                    </Tooltip>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Box>

            {/* --- MOBILE CARDS --- */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
                ) : (visibleRegistros || []).length === 0 ? (
                    <Paper elevation={0} sx={{ p: 4, textAlign: 'center', color: 'text.secondary', bgcolor: '#f5f5f5', borderRadius: 2 }}>
                        <Typography>Nenhum registro encontrado.</Typography>
                    </Paper>
                ) : (
                    (visibleRegistros || []).map((row) => (
                        <MobileLogCard
                            key={row.id}
                            reg={row}
                            onEdit={(item: any) => handleOpenAction(item, 'EDIT')}
                            onDelete={(item: any) => handleOpenAction(item, 'DELETE')}
                        />
                    ))
                )}
            </Box>

            <Dialog open={openDialog} onClose={handleClose}>
                <DialogTitle sx={{ color: actionType === 'DELETE' ? 'error.main' : 'primary.main' }}>
                    {actionType === 'DELETE' ? 'Invalidar Registro' : 'Corrigir Registro'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        {actionType === 'DELETE'
                            ? "O registro será marcado como CANCELADO, mas mantido para auditoria."
                            : "As alterações serão salvas no histórico do registro."}
                    </DialogContentText>



                    <TextField
                        autoFocus label="Justificativa (Obrigatória)" fullWidth multiline rows={2}
                        value={justificativa} onChange={e => setJustificativa(e.target.value)}
                        error={justificativa.length > 0 && justificativa.length < 5}
                        helperText="Ex: Erro de digitação, produto errado, duplicidade..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleConfirmAction} variant="contained" color={actionType === 'DELETE' ? 'error' : 'primary'}>
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>


            <ManualRecordDialog
                open={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                pmoId={pmoId || 0}
                recordToEdit={selectedItem}
                onRecordSaved={() => {
                    fetchRegistros();
                    setIsEditOpen(false);
                }}
            />
        </Box >
    );
};

export default GeneralLogTable;
