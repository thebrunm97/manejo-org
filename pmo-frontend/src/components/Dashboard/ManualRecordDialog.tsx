/**
 * @file ManualRecordDialog.tsx
 * @description Dialog component for creating and editing field diary records.
 * 
 * REFACTORED: Logic extracted to custom hooks for improved testability:
 * - useRecordValidation: All validation logic
 * - useRecordFormState: Draft state management
 * - useUnitSelection: Unit selection with legacy support (constants exported)
 */
import React, { useState, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogTitle, Tabs, Tab, Box, TextField, Button,
    DialogActions, FormControl, InputLabel, Select, MenuItem, Stack, Chip,
    Typography, InputAdornment, Alert, FormControlLabel, Checkbox
} from '@mui/material';
import { cadernoService } from '../../services/cadernoService';
import LocationSelectorDialog from '../Common/LocationSelectorDialog';
import {
    ActivityType,
    UnitType,
    CadernoEntry,
    DetalhesPlantio,
    DetalhesManejo,
    DetalhesColheita,
    CadernoCampoRecord,
    ManejoSubtype
} from '../../types/CadernoTypes';

// --- Custom Hooks ---
import {
    useRecordValidation,
    useRecordFormState,
    UNIDADES_PLANTIO,
    UNIDADES_MANEJO,
    UNIDADES_COLHEITA,
    TipoRegistro,
    CommonDraft,
    PlantioDraft,
    ManejoDraft,
    ColheitaDraft,
    OutroDraft
} from '../../hooks/manual-record';
import { useCadernoOfflineLogic } from '../../hooks/offline/useCadernoOfflineLogic';

// --- Icons ---
import AgricultureIcon from '@mui/icons-material/Agriculture';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ScienceIcon from '@mui/icons-material/Science';
import InventoryIcon from '@mui/icons-material/Inventory';
import PlaceIcon from '@mui/icons-material/Place';

// --- Component Props ---
interface ManualRecordDialogProps {
    open: boolean;
    onClose: () => void;
    pmoId: number;
    recordToEdit?: CadernoCampoRecord | null;
    onRecordSaved: () => void;
}

const ManualRecordDialog: React.FC<ManualRecordDialogProps> = ({
    open,
    onClose,
    pmoId,
    recordToEdit,
    onRecordSaved
}) => {
    // --- Custom Hooks ---
    const {
        activeTab,
        isEditMode,
        plantioDraft,
        manejoDraft,
        colheitaDraft,
        outroDraft,
        setActiveTab,
        getCurrentDraft,
        updateDraft: updateDraftBase,
        clearDraft
    } = useRecordFormState({ open, recordToEdit });

    const {
        validate,
        errors,
        clearError,
        clearAllErrors,
        organicWarning,
        checkInsumoOrganico,
        setErrors
    } = useRecordValidation();

    const { saveRecord } = useCadernoOfflineLogic();

    // --- Local UI State ---
    const [loading, setLoading] = useState(false);
    const [openJustification, setOpenJustification] = useState(false);
    const [justificativa, setJustificativa] = useState('');
    const [openLocation, setOpenLocation] = useState(false);

    // --- Wrapper for updateDraft that clears errors ---
    const updateDraft = useCallback((field: string, value: any) => {
        if (errors[field]) {
            clearError(field);
        }
        updateDraftBase(field, value);
    }, [errors, clearError, updateDraftBase]);

    // --- Validation & Save Logic ---
    const handleInitialSaveClick = useCallback(() => {
        const draft = getCurrentDraft();
        const result = validate(draft, activeTab);

        if (!result.isValid) return;

        if (isEditMode) {
            setOpenJustification(true);
        } else {
            executeSave();
        }
    }, [getCurrentDraft, validate, activeTab, isEditMode]);

    const executeSave = useCallback(async () => {
        setLoading(true);
        try {
            const draft = getCurrentDraft();

            // Base Payload
            const payloadBase = {
                id: isEditMode && recordToEdit ? recordToEdit.id : undefined,
                pmo_id: pmoId,
                data_registro: new Date((draft as CommonDraft).dataHora).toISOString(),
                talhao_canteiro: (draft as CommonDraft).locais.join('; '),
                produto: (draft as CommonDraft).produto,
                observacao_original: (draft as CommonDraft).observacao || `Registro de ${activeTab.toUpperCase()}`,
            };

            let finalPayload: CadernoEntry | null = null;

            if (activeTab === 'plantio') {
                const d = draft as PlantioDraft;
                const detalhes: DetalhesPlantio = {
                    metodo_propagacao: d.metodoPropagacao as any,
                    qtd_utilizada: parseFloat(d.qtdPlantio) || 0,
                    unidade_medida: d.unidadePlantio
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.PLANTIO,
                    id: payloadBase.id!,
                    quantidade_valor: parseFloat(d.qtdPlantio) || 0,
                    quantidade_unidade: d.unidadePlantio,
                    detalhes_tecnicos: detalhes,
                    // New Dedicated Columns
                    houve_descartes: d.houveDescartes,
                    qtd_descartes: d.houveDescartes ? (parseFloat(d.qtdDescartes) || 0) : undefined,
                    unidade_descartes: d.houveDescartes ? d.unidadeDescartes : undefined
                } as CadernoEntry;
            }
            else if (activeTab === 'manejo') {
                const d = draft as ManejoDraft;
                let detalhes: DetalhesManejo = {
                    subtipo: d.subtipoManejo,
                    responsavel: d.responsavel,
                    tipo_manejo: d.tipoManejo
                };

                if (d.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) {
                    detalhes = { ...detalhes, insumo: d.insumo, dosagem: d.dosagem, unidade_dosagem: d.unidadeDosagem, equipamento: d.equipamento };
                } else if (d.subtipoManejo === ManejoSubtype.HIGIENIZACAO) {
                    detalhes = { ...detalhes, item_higienizado: d.itemHigienizado, produto_utilizado: d.produtoUtilizado };
                } else {
                    detalhes = { ...detalhes, atividade: d.atividadeCultural, qtd_trabalhadores: parseInt(d.qtdTrabalhadores || '0', 10) };
                }

                let produtoRef = '';
                if (d.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) produtoRef = d.insumo;
                else if (d.subtipoManejo === ManejoSubtype.HIGIENIZACAO) produtoRef = `${d.itemHigienizado} (${d.produtoUtilizado})`;
                else produtoRef = d.atividadeCultural;

                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.MANEJO,
                    id: payloadBase.id!,
                    produto: produtoRef || (draft as CommonDraft).produto,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }
            else if (activeTab === 'colheita') {
                const d = draft as ColheitaDraft;
                const detalhes: DetalhesColheita = {
                    lote: d.lote,
                    destino: d.destino,
                    classificacao: d.classificacao,
                    qtd: parseFloat(d.qtdColheita) || 0,
                    unidade: d.unidadeColheita
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.COLHEITA,
                    id: payloadBase.id!,
                    quantidade_valor: parseFloat(d.qtdColheita) || 0,
                    quantidade_unidade: d.unidadeColheita,
                    detalhes_tecnicos: detalhes,
                    // New Dedicated Columns
                    houve_descartes: d.houveDescartes,
                    qtd_descartes: d.houveDescartes ? (parseFloat(d.qtdDescartes) || 0) : undefined,
                    unidade_descartes: d.houveDescartes ? d.unidadeDescartes : undefined
                } as CadernoEntry;
            }
            else {
                // Outro
                const d = draft as OutroDraft;
                const detalhes: any = { ...d };

                if (d.tipoOutro === 'compra') {
                    Object.assign(detalhes, {
                        tipo_registro: 'compra',
                        quantidade: parseFloat(d.quantidade) || 0,
                        unidade: d.unidade,
                        fornecedor: d.fornecedor,
                        tipo_origem: d.tipoOrigem,
                        numero_documento: d.numeroDocumento
                    });
                } else if (d.tipoOutro === 'venda') {
                    Object.assign(detalhes, {
                        tipo_registro: 'venda',
                        quantidade: parseFloat(d.quantidade) || 0,
                        unidade: d.unidade,
                        destino: d.destinoVenda,
                        numero_documento: d.numeroDocumento
                    });
                } else {
                    Object.assign(detalhes, { tipo_registro: 'outro' });
                }

                // Cleanup common keys
                delete detalhes.dataHora;
                delete detalhes.locais;
                delete detalhes.produto;
                delete detalhes.observacao;

                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.OUTRO,
                    id: payloadBase.id!,
                    quantidade_valor: d.quantidade ? parseFloat(d.quantidade) : 0,
                    quantidade_unidade: d.unidade || UnitType.UNID,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }

            if (!finalPayload) return;

            if (isEditMode && recordToEdit) {
                const auditTrail = `[EDITADO em ${new Date().toLocaleString('pt-BR')}] Motivo: ${justificativa}\n\n`;
                finalPayload.observacao_original = auditTrail + (finalPayload.observacao_original || '');
                if (!finalPayload.id) finalPayload.id = recordToEdit.id;
            }

            // --- OFFLINE LOGIC REPLACEMENT ---
            // Old: await cadernoService.addRegistro(finalPayload);
            // New: useCadernoOfflineLogic.saveRecord(finalPayload)

            const result = await saveRecord(finalPayload);

            if (result.success) {
                clearDraft(activeTab);
                clearAllErrors();

                if (result.isOffline) {
                    alert(`Registro salvo OFFLINE! ☁️❌\n\nEle será sincronizado automaticamente quando a internet voltar.`);
                } else {
                    // Optional success feedback if needed, but dialog close usually implies success
                }

                onRecordSaved();
                onClose();
            } else {
                alert(`Erro ao salvar: ${result.error}`);
            }
            // ---------------------------------
        } catch (error: any) {
            console.error(error);
            alert(`Erro crítico ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
            setOpenJustification(false);
        }
    }, [getCurrentDraft, activeTab, isEditMode, recordToEdit, pmoId, justificativa, clearDraft, clearAllErrors, onRecordSaved, onClose, saveRecord]);

    // --- Render Unit Select Helper ---
    const renderUnitSelect = (
        value: UnitType | string,
        fieldName: string,
        options: UnitType[],
        label: string = "Unid"
    ) => {
        const isCustomValue = value && !options.includes(value as UnitType);
        const effectiveOptions = isCustomValue ? [value, ...options] : options;
        const safeValue = value || '';

        return (
            <FormControl sx={{ minWidth: 100 }}>
                <InputLabel>{label}</InputLabel>
                <Select
                    value={safeValue}
                    label={label}
                    onChange={e => updateDraft(fieldName, e.target.value)}
                >
                    {effectiveOptions.map(opt => (
                        <MenuItem
                            key={opt}
                            value={opt}
                            sx={isCustomValue && opt === value ? { fontStyle: 'italic', color: 'warning.main' } : undefined}
                        >
                            {opt === value && isCustomValue ? `${opt} (Legado)` : opt}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        );
    };

    // --- Prepare drafts for render ---
    const currentDraft = getCurrentDraft();
    const common = currentDraft as CommonDraft;
    const pDraft = plantioDraft;
    const mDraft = manejoDraft;
    const cDraft = colheitaDraft;

    // --- Derived UI vars ---
    const labelProduto =
        activeTab !== 'manejo'
            ? 'Cultura/Produto'
            : mDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO ||
                mDraft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL
                ? 'Cultura Alvo'
                : 'Cultura/Produto';

    const labelLocais =
        activeTab !== 'manejo'
            ? 'Talhões / Canteiros'
            : mDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO
                ? 'Locais de aplicação (Talhões/Canteiros)'
                : mDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO
                    ? 'Locais / Áreas Higienizadas'
                    : 'Talhões / Canteiros';

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle sx={{ p: 0, bgcolor: '#f5f5f5' }}>
                    <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                            {isEditMode ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}
                        </Typography>
                    </Box>
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => !isEditMode && setActiveTab(v)}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        sx={{
                            bgcolor: '#fff',
                            borderBottom: 1,
                            borderColor: 'divider',
                            '& .MuiTab-root': {
                                minHeight: 64,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                opacity: 0.7,
                                '&.Mui-selected': {
                                    opacity: 1,
                                    bgcolor: 'rgba(25, 118, 210, 0.08)',
                                }
                            }
                        }}
                    >
                        <Tab
                            value="plantio"
                            icon={<LocalFloristIcon />}
                            label="PLANTIO"
                            disabled={isEditMode && activeTab !== 'plantio'}
                            sx={{ color: 'success.main', '&.Mui-selected': { color: 'success.dark' } }}
                        />
                        <Tab
                            value="manejo"
                            icon={<ScienceIcon />}
                            label="MANEJO"
                            disabled={isEditMode && activeTab !== 'manejo'}
                            sx={{ color: 'primary.main', '&.Mui-selected': { color: 'primary.dark' } }}
                        />
                        <Tab
                            value="colheita"
                            icon={<ContentCutIcon />}
                            label="COLHEITA"
                            disabled={isEditMode && activeTab !== 'colheita'}
                            sx={{ color: 'warning.main', '&.Mui-selected': { color: 'warning.dark' } }}
                        />
                        <Tab
                            value="outro"
                            icon={<InventoryIcon />}
                            label="OUTRO"
                            disabled={isEditMode && activeTab !== 'outro'}
                            sx={{ color: 'text.secondary', '&.Mui-selected': { color: 'text.primary' } }}
                        />
                    </Tabs>
                </DialogTitle>

                <DialogContent sx={{ mt: 2, pt: '24px !important' }}>

                    {isEditMode && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Você está editando um registro existente. O tipo de atividade não pode ser alterado.
                        </Alert>
                    )}

                    <Stack spacing={3} sx={{ mt: 1 }}>

                        {/* Header: Data/Hora & Produto */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Data e Hora"
                                type="datetime-local"
                                value={common.dataHora}
                                onChange={e => updateDraft('dataHora', e.target.value)}
                                sx={{ minWidth: 200 }}
                                InputLabelProps={{ shrink: true }}
                                error={!!errors.data}
                                helperText={errors.data}
                            />
                            {!(activeTab === 'manejo' && mDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO) && (
                                <TextField
                                    label={labelProduto}
                                    value={common.produto}
                                    onChange={e => updateDraft('produto', e.target.value)}
                                    fullWidth
                                    placeholder="Ex: Alface Americana"
                                    error={!!errors.produto}
                                    helperText={errors.produto}
                                />
                            )}
                        </Stack>

                        {/* Location Selector */}
                        <Box>
                            <Typography variant="caption" color={errors.locais ? "error" : "text.secondary"} sx={{ fontWeight: 'bold' }}>
                                {labelLocais.toUpperCase()} {errors.locais && `(${errors.locais})`}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5, p: 1.5,
                                    border: `1px dashed ${errors.locais ? '#d32f2f' : '#ccc'}`,
                                    borderRadius: 2, minHeight: 60,
                                    alignItems: 'center', cursor: 'pointer',
                                    '&:hover': { bgcolor: '#f9f9f9', borderColor: 'primary.main' }
                                }}
                                onClick={() => {
                                    setOpenLocation(true);
                                    if (errors.locais) clearError('locais');
                                }}
                            >
                                {common.locais.length === 0 && (
                                    <Typography color={errors.locais ? "error" : "text.secondary"} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <PlaceIcon color={errors.locais ? "error" : "action"} /> Clique para selecionar Talhões ou Canteiros...
                                    </Typography>
                                )}
                                {common.locais.map(l => (
                                    <Chip key={l} label={l} onDelete={() => updateDraft('locais', common.locais.filter(x => x !== l))} color="primary" variant="outlined" />
                                ))}
                            </Box>
                        </Box>

                        {/* --- TAB: PLANTIO --- */}
                        {activeTab === 'plantio' && (
                            <Stack spacing={2} sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 2 }}>
                                <Typography variant="subtitle2" color="success.main">DETALHES DO PLANTIO</Typography>
                                <Stack direction="row" spacing={2}>
                                    <FormControl fullWidth error={!!errors.metodo}>
                                        <InputLabel>Método</InputLabel>
                                        <Select
                                            value={pDraft.metodoPropagacao}
                                            label="Método"
                                            onChange={e => updateDraft('metodoPropagacao', e.target.value)}
                                        >
                                            <MenuItem value="Muda">Muda (Transplante)</MenuItem>
                                            <MenuItem value="Semente">Semente (Semeadura)</MenuItem>
                                            <MenuItem value="Estaca">Estaca/Bulbo</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        label="Quantidade" type="number"
                                        value={pDraft.qtdPlantio}
                                        onChange={e => updateDraft('qtdPlantio', e.target.value)}
                                        fullWidth
                                        InputProps={{ endAdornment: <InputAdornment position="end">{pDraft.unidadePlantio}</InputAdornment> }}
                                    />
                                    {renderUnitSelect(pDraft.unidadePlantio, 'unidadePlantio', UNIDADES_PLANTIO)}
                                </Stack>

                                {/* Perda / Descarte */}
                                <Stack spacing={1}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={pDraft.houveDescartes}
                                                onChange={e => updateDraft('houveDescartes', e.target.checked)}
                                                color="error"
                                            />
                                        }
                                        label="Houve descartes (perdas) no plantio?"
                                    />

                                    {pDraft.houveDescartes && (
                                        <Stack direction="row" spacing={2} sx={{ pl: 4 }}>
                                            <TextField
                                                label="Qtd. Descartes"
                                                type="number"
                                                value={pDraft.qtdDescartes}
                                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                                fullWidth
                                                color="error"
                                                error={!!errors.qtdDescartes}
                                                helperText={errors.qtdDescartes}
                                            />
                                            {renderUnitSelect(
                                                pDraft.unidadeDescartes,
                                                'unidadeDescartes',
                                                UNIDADES_PLANTIO, // Usa as mesmas unidades do plantio
                                                "Unid."
                                            )}
                                        </Stack>
                                    )}
                                </Stack>
                            </Stack>
                        )}

                        {/* --- TAB: MANEJO --- */}
                        {activeTab === 'manejo' && (
                            <Stack spacing={2} sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2 }}>
                                <Typography variant="subtitle2" color="primary.main">OPERAÇÃO DE MANEJO</Typography>

                                <FormControl fullWidth>
                                    <InputLabel id="subtipo-manejo-label">Tipo de Operação</InputLabel>
                                    <Select
                                        labelId="subtipo-manejo-label"
                                        label="Tipo de Operação"
                                        value={mDraft.subtipoManejo}
                                        onChange={(e) => updateDraft('subtipoManejo', e.target.value)}
                                    >
                                        <MenuItem value={ManejoSubtype.MANEJO_CULTURAL}>Manejo Cultural</MenuItem>
                                        <MenuItem value={ManejoSubtype.APLICACAO_INSUMO}>Aplicação de Insumos</MenuItem>
                                        <MenuItem value={ManejoSubtype.HIGIENIZACAO}>Higienização</MenuItem>
                                    </Select>
                                </FormControl>

                                <Typography variant="caption" sx={{ mt: 1, mb: 1, display: 'block' }}>
                                    Preencha os dados específicos da operação selecionada:
                                </Typography>

                                {mDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO && (
                                    <>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                            <TextField
                                                label="Insumo Utilizado"
                                                value={mDraft.insumo}
                                                onChange={e => {
                                                    updateDraft('insumo', e.target.value);
                                                    checkInsumoOrganico(e.target.value);
                                                }}
                                                fullWidth
                                                error={!!errors.insumo}
                                                helperText={errors.insumo}
                                                placeholder="Ex: Bokashi, Calda Bordalesa"
                                            />
                                            <TextField
                                                label="Equipamento"
                                                value={mDraft.equipamento}
                                                onChange={e => updateDraft('equipamento', e.target.value)}
                                                fullWidth
                                                placeholder="Ex: Pulverizador Costal"
                                            />
                                        </Stack>
                                        {organicWarning && (
                                            <Alert severity="warning" sx={{ mt: 1 }}>
                                                {organicWarning.msg}
                                            </Alert>
                                        )}
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <TextField
                                                label="Dosagem"
                                                value={mDraft.dosagem}
                                                onChange={e => updateDraft('dosagem', e.target.value)}
                                                fullWidth
                                                error={!!errors.dosagem}
                                                helperText={errors.dosagem}
                                            />
                                            {renderUnitSelect(mDraft.unidadeDosagem, 'unidadeDosagem', UNIDADES_MANEJO)}
                                        </Stack>
                                        <FormControl fullWidth>
                                            <InputLabel>Categoria (Opcional)</InputLabel>
                                            <Select
                                                value={mDraft.tipoManejo}
                                                label="Categoria (Opcional)"
                                                onChange={e => updateDraft('tipoManejo', e.target.value)}
                                            >
                                                <MenuItem value="Adubação">Adubação</MenuItem>
                                                <MenuItem value="Fitossanitário">Fitossanitário</MenuItem>
                                                <MenuItem value="Irrigação">Irrigação</MenuItem>
                                                <MenuItem value="Outro">Outro</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </>
                                )}

                                {mDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO && (
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Item Higienizado"
                                            value={mDraft.itemHigienizado}
                                            onChange={e => updateDraft('itemHigienizado', e.target.value)}
                                            fullWidth
                                            placeholder="Ex: Caixas Colheita, Ferramentas"
                                            error={!!errors.itemHigienizado}
                                            helperText={errors.itemHigienizado}
                                        />
                                        <TextField
                                            label="Produto Utilizado"
                                            value={mDraft.produtoUtilizado}
                                            onChange={e => updateDraft('produtoUtilizado', e.target.value)}
                                            fullWidth
                                            placeholder="Ex: Hipoclorito, Detergente neutro"
                                            error={!!errors.produtoUtilizado}
                                            helperText={errors.produtoUtilizado}
                                        />
                                    </Stack>
                                )}

                                {mDraft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL && (
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Atividade Realizada"
                                            value={mDraft.atividadeCultural}
                                            onChange={e => updateDraft('atividadeCultural', e.target.value)}
                                            fullWidth
                                            placeholder="Ex: Capina, Poda, Desbaste"
                                            error={!!errors.atividadeCultural}
                                            helperText={errors.atividadeCultural}
                                        />
                                        <TextField
                                            label="Qtd. Trabalhadores"
                                            type="number"
                                            value={mDraft.qtdTrabalhadores}
                                            onChange={e => updateDraft('qtdTrabalhadores', e.target.value)}
                                            fullWidth
                                        />
                                    </Stack>
                                )}

                                <TextField
                                    label="Responsável Técnico / Operador"
                                    value={mDraft.responsavel}
                                    onChange={e => updateDraft('responsavel', e.target.value)}
                                    fullWidth
                                />
                            </Stack>
                        )}

                        {/* --- TAB: COLHEITA --- */}
                        {activeTab === 'colheita' && (
                            <Stack spacing={2} sx={{ p: 2, bgcolor: '#fff7ed', borderRadius: 2 }}>
                                <Typography variant="subtitle2" color="warning.main">RASTREABILIDADE DA COLHEITA</Typography>
                                <TextField
                                    label="LOTE (Auto-Gerado)"
                                    value={cDraft.lote}
                                    onChange={e => updateDraft('lote', e.target.value)}
                                    fullWidth
                                />

                                <Stack direction="row" spacing={2}>
                                    <TextField
                                        label="Quantidade Colhida"
                                        type="number"
                                        value={cDraft.qtdColheita}
                                        onChange={e => updateDraft('qtdColheita', e.target.value)}
                                        fullWidth
                                        InputProps={{ endAdornment: <InputAdornment position="end">{cDraft.unidadeColheita}</InputAdornment> }}
                                        error={!!errors.qtdColheita}
                                        helperText={errors.qtdColheita}
                                    />
                                    {renderUnitSelect(cDraft.unidadeColheita, 'unidadeColheita', UNIDADES_COLHEITA)}
                                </Stack>

                                <Stack direction="row" spacing={2}>
                                    <FormControl fullWidth>
                                        <InputLabel>Destino</InputLabel>
                                        <Select
                                            value={cDraft.destino}
                                            label="Destino"
                                            onChange={e => updateDraft('destino', e.target.value)}
                                        >
                                            <MenuItem value="Mercado Interno">Mercado Interno</MenuItem>
                                            <MenuItem value="Exportação">Exportação</MenuItem>
                                            <MenuItem value="Processamento">Processamento</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth>
                                        <InputLabel>Classificação</InputLabel>
                                        <Select
                                            value={cDraft.classificacao}
                                            label="Classificação"
                                            onChange={e => updateDraft('classificacao', e.target.value)}
                                        >
                                            <MenuItem value="Extra">Extra</MenuItem>
                                            <MenuItem value="Primeira">Primeira</MenuItem>
                                            <MenuItem value="Segunda">Segunda</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Stack>

                                {/* Perda / Descarte Colheita */}
                                <Stack spacing={1}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={cDraft.houveDescartes}
                                                onChange={e => updateDraft('houveDescartes', e.target.checked)}
                                                color="error"
                                            />
                                        }
                                        label="Houve descartes (perdas) na colheita?"
                                    />

                                    {cDraft.houveDescartes && (
                                        <Stack direction="row" spacing={2} sx={{ pl: 4 }}>
                                            <TextField
                                                label="Qtd. Descartes"
                                                type="number"
                                                value={cDraft.qtdDescartes}
                                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                                fullWidth
                                                color="error"
                                                error={!!errors.qtdDescartes}
                                                helperText={errors.qtdDescartes}
                                            />
                                            {renderUnitSelect(
                                                cDraft.unidadeDescartes,
                                                'unidadeDescartes',
                                                UNIDADES_COLHEITA,
                                                "Unid."
                                            )}
                                        </Stack>
                                    )}
                                </Stack>
                            </Stack>
                        )}

                        {/* --- TAB: OUTRO (COMPRA / VENDA / GENÉRICO) --- */}
                        {activeTab === 'outro' && (
                            <Stack spacing={2} sx={{ p: 2, bgcolor: '#f3f4f6', borderRadius: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary">TIPO DE REGISTRO OUTRO</Typography>

                                <FormControl fullWidth>
                                    <InputLabel id="tipo-outro-label">Subtipo</InputLabel>
                                    <Select
                                        labelId="tipo-outro-label"
                                        label="Subtipo"
                                        value={outroDraft.tipoOutro}
                                        onChange={e => updateDraft('tipoOutro', e.target.value)}
                                    >
                                        <MenuItem value="outro">Genérico / Outro</MenuItem>
                                        <MenuItem value="compra">Compra de Insumo/Produto</MenuItem>
                                        <MenuItem value="venda">Venda / Saída</MenuItem>
                                    </Select>
                                </FormControl>

                                {/* COMPRA FIELDS */}
                                {outroDraft.tipoOutro === 'compra' && (
                                    <>
                                        <Stack direction="row" spacing={2}>
                                            <TextField
                                                label="Quantidade"
                                                type="number"
                                                value={outroDraft.quantidade}
                                                onChange={e => updateDraft('quantidade', e.target.value)}
                                                fullWidth
                                                error={!!errors.quantidade}
                                                helperText={errors.quantidade}
                                            />
                                            {renderUnitSelect(
                                                outroDraft.unidade,
                                                'unidade',
                                                [UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON]
                                            )}
                                        </Stack>
                                        <TextField
                                            label="Fornecedor"
                                            value={outroDraft.fornecedor}
                                            onChange={e => updateDraft('fornecedor', e.target.value)}
                                            fullWidth
                                            error={!!errors.fornecedor}
                                            helperText={errors.fornecedor}
                                        />
                                        <Stack direction="row" spacing={2}>
                                            <FormControl fullWidth>
                                                <InputLabel>Origem</InputLabel>
                                                <Select
                                                    value={outroDraft.tipoOrigem}
                                                    label="Origem"
                                                    onChange={e => updateDraft('tipoOrigem', e.target.value)}
                                                >
                                                    <MenuItem value="compra">Compra</MenuItem>
                                                    <MenuItem value="doação">Doação</MenuItem>
                                                    <MenuItem value="produção própria">Produção Própria</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <TextField
                                                label="Nº. Documento / NF"
                                                value={outroDraft.numeroDocumento}
                                                onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                                fullWidth
                                            />
                                        </Stack>
                                    </>
                                )}

                                {/* VENDA FIELDS */}
                                {outroDraft.tipoOutro === 'venda' && (
                                    <>
                                        <Stack direction="row" spacing={2}>
                                            <TextField
                                                label="Quantidade Vendida"
                                                type="number"
                                                value={outroDraft.quantidade}
                                                onChange={e => updateDraft('quantidade', e.target.value)}
                                                fullWidth
                                                error={!!errors.quantidade}
                                                helperText={errors.quantidade}
                                            />
                                            {renderUnitSelect(
                                                outroDraft.unidade,
                                                'unidade',
                                                [UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON]
                                            )}
                                        </Stack>
                                        <TextField
                                            label="Destino / Cliente"
                                            value={outroDraft.destinoVenda}
                                            onChange={e => updateDraft('destinoVenda', e.target.value)}
                                            fullWidth
                                            error={!!errors.destinoVenda}
                                            helperText={errors.destinoVenda}
                                        />
                                        <TextField
                                            label="Nº. Documento / NF"
                                            value={outroDraft.numeroDocumento}
                                            onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                            fullWidth
                                        />
                                    </>
                                )}
                            </Stack>
                        )}

                        {/* Campo de Observação Geral */}
                        <TextField
                            label="Observações Adicionais"
                            multiline rows={2}
                            value={common.observacao}
                            onChange={e => updateDraft('observacao', e.target.value)}
                            fullWidth
                            error={!!errors.observacao}
                            helperText={errors.observacao}
                        />

                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} color="inherit">Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleInitialSaveClick}
                        disabled={loading}
                        size="large"
                        color={isEditMode ? "warning" : "primary"}
                    >
                        {isEditMode ? 'Salvar Edição' : 'Salvar Registro'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Justification Modal */}
            <Dialog
                open={openJustification}
                onClose={() => setOpenJustification(false)}
                PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: '#f59e0b' }}>
                    Motivo da Edição
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                        Para fins de auditoria, por favor justifique o motivo desta exata alteração.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Justificativa"
                        multiline
                        rows={3}
                        value={justificativa}
                        onChange={e => setJustificativa(e.target.value)}
                        placeholder="Ex: Erro de digitação na quantidade..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenJustification(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={executeSave}
                        disabled={!justificativa.trim() || loading}
                    >
                        Confirmar Edição
                    </Button>
                </DialogActions>
            </Dialog>

            <LocationSelectorDialog
                open={openLocation}
                onClose={() => setOpenLocation(false)}
                onConfirm={(newLocais) => {
                    updateDraft('locais', newLocais);
                    if (errors.locais) clearError('locais');
                }}
                pmoId={pmoId}
                initialSelected={common.locais}
            />
        </>
    );
};

const ManualRecordDialogMemo = React.memo(ManualRecordDialog);
export default ManualRecordDialogMemo;
