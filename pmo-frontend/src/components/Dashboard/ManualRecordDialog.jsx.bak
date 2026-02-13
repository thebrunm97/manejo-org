import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, MenuItem, CircularProgress, Alert,
    Box, InputAdornment, Grid, Card,
    Typography, Checkbox, FormControlLabel, IconButton,
    Autocomplete, Snackbar
} from '@mui/material';
import {
    ShoppingBag, Tractor, Droplets, Trash2, ShoppingCart,
    MapPin, Paperclip, XCircle, Store, FileText
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import SeletorLocalizacaoSaf from '../PmoForm/SeletorLocalizacaoSaf';

// Metadata
const ACTIVITIES = [
    { id: 'Manejo', label: 'Manejo', icon: <Tractor size={24} />, color: '#ea580c' },
    { id: 'Colheita', label: 'Colheita', icon: <ShoppingBag size={24} />, color: '#16a34a' },
    { id: 'Insumo', label: 'Aplicação', icon: <Droplets size={24} />, color: '#0ea5e9' },
    { id: 'Limpeza', label: 'Limpeza', icon: <Trash2 size={24} />, color: '#64748b' },
    { id: 'Venda', label: 'Venda', icon: <Store size={24} />, color: '#059669' },
    { id: 'Compra', label: 'Compra', icon: <ShoppingCart size={24} />, color: '#8b5cf6' }
];

const PRODUCTS = ['Tomate', 'Tomate Cereja', 'Berinjela', 'Alface', 'Pimentão', 'Couve', 'Café', 'Milho', 'Soja', 'Outro'];
const UNIDADES = ['kg', 'maço', 'unidade', 'caixa', 'ton', 'litro', 'm³', 'saca'];

const ManualRecordDialog = ({ open, onClose, pmoId, onRecordSaved, recordToEdit = null }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [listaTalhoes, setListaTalhoes] = useState([]);
    const [listaSementes, setListaSementes] = useState([]);
    const [listaInsumos, setListaInsumos] = useState([]);
    const [activityType, setActivityType] = useState('Manejo');
    const [showCanteiro, setShowCanteiro] = useState(false);
    const [openLocationSelector, setOpenLocationSelector] = useState(false);
    const [justificativa, setJustificativa] = useState(''); // Audit Trail
    const [selectedFile, setSelectedFile] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });

    const fileInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        id: '', // ID para edição
        data_registro: new Date().toISOString().split('T')[0],
        observacao: '', // Usado para "Atividade" no Manejo

        talhao_id: '',
        canteiro: '',
        talhao_canteiro: '', // Novo campo para seleção múltipla

        // Colheita / Venda
        produto_select: '',
        produto_custom: '',
        quantidade: '',
        unidade: 'kg',

        // Específicos
        qtd_descarte: '', // Colheita
        unidade_descarte: 'kg', // Colheita - Unidade independente para descarte
        destino: '', // Colheita
        cliente: '', // Venda
        valor_total: '', // Venda/Compra
        nf: '', // Venda/Compra
        insumo: '', // Aplicação
        dosagem: '', // Aplicação
        item_limpeza: '', // Limpeza
        tipo_limpeza: '', // Limpeza
        fornecedor: '' // Compra
    });

    // 1. DATA FETCHING
    useEffect(() => {
        const fetchTalhoes = async () => {
            // CORREÇÃO: Nome correto da tabela é 'propriedade_talhoes'
            const { data, error } = await supabase
                .from('propriedade_talhoes')
                .select('id, nome, cultura') // Select otimizado
                .eq('pmo_id', pmoId);

            if (error) {
                console.error('Erro ao buscar talhões:', error);
            } else {
                setListaTalhoes(data || []);
            }
        };

        if (open && pmoId) {
            fetchTalhoes();
        }
    }, [open, pmoId]);

    // 2. Buscar itens do PMO para Autocomplete
    useEffect(() => {
        const fetchItensPmo = async () => {
            if (open && pmoId) {
                try {
                    const { sementes, insumos } = await dashboardService.getItensPmo(pmoId);
                    setListaSementes(sementes || []);
                    setListaInsumos(insumos || []);
                } catch (err) {
                    console.error('Erro ao carregar itens do PMO:', err);
                }
            }
        };
        fetchItensPmo();
    }, [open, pmoId]);


    // 3. Populate Form for Editing
    useEffect(() => {
        if (open && recordToEdit) {
            // EDIT MODE
            setJustificativa(''); // Reset audit reason
            const dt = recordToEdit.detalhes_tecnicos || {};

            setActivityType(recordToEdit.tipo_atividade);
            setFormData({
                id: recordToEdit.id,
                data_registro: recordToEdit.data_registro,
                observacao: recordToEdit.observacao_original || dt.atividade || '',

                talhao_id: dt.talhao_id || '',
                canteiro: dt.local_especifico || '', // Fallback legacy
                talhao_canteiro: recordToEdit.talhao_canteiro || '',

                // Colheita / Venda
                produto_select: recordToEdit.produto || '',
                produto_custom: '',
                quantidade: recordToEdit.quantidade_valor || '',
                unidade: recordToEdit.quantidade_unidade || 'kg',

                // Específicos do JSONB
                qtd_descarte: dt.qtd_descarte || '',
                unidade_descarte: 'kg', // Padrão por enquanto, ou salvar no JSONB futuramente
                destino: dt.destino || '',
                cliente: dt.cliente || '',
                valor_total: dt.valor || '',
                nf: dt.nf || '',
                insumo: dt.insumo || '',
                dosagem: dt.dosagem || '',
                item_limpeza: dt.item || '',
                tipo_limpeza: dt.tipo || '',
                fornecedor: dt.fornecedor || ''
            });

            // Se tiver arquivo
            if (dt.anexo_url) {
                // Lógica de visualização de arquivo existente seria aqui
                // Por enquanto o upload apenas substitui
            }

        } else if (open && !recordToEdit) {
            // CREATE MODE (Reset)
            setFormData({
                id: '',
                data_registro: new Date().toISOString().split('T')[0],
                observacao: '', talhao_id: '', canteiro: '', talhao_canteiro: '',
                produto_select: '', produto_custom: '', quantidade: '', unidade: 'kg',
                qtd_descarte: '', destino: '', cliente: '', valor_total: '', nf: '',
                insumo: '', dosagem: '', item_limpeza: '', tipo_limpeza: '', fornecedor: ''
            });
            setActivityType('Manejo');
            setSelectedFile(null);
            setError('');
        }
    }, [open, recordToEdit]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        // --- VALIDATION SECTIONS ---
        if (!formData.data_registro) return setError("Data é obrigatória.");

        // Manejo, Colheita, Aplicação -> Exigem Talhão (Validar ID OU Texto do Seletor)
        if (['Manejo', 'Colheita', 'Insumo'].includes(activityType) && !formData.talhao_id && !formData.talhao_canteiro) {
            return setError("Selecione um Talhão para esta atividade.");
        }

        // Colheita
        if (activityType === 'Colheita') {
            if ((!formData.produto_select && !formData.produto_custom) || !formData.quantidade)
                return setError("Produto e Quantidade são obrigatórios.");
            if (formData.qtd_descarte === '' || formData.qtd_descarte === null) return setError("Informe o Descarte (0 se nenhum).");
        }

        // Venda
        if (activityType === 'Venda') {
            if (!formData.cliente) return setError("Informe o Cliente.");
            if (!formData.nf) return setError("Nota Fiscal é obrigatória para Venda.");
            if (!formData.valor_total) return setError("Informe o Valor Total.");
        }

        // Compra
        if (activityType === 'Compra') {
            if (!formData.fornecedor) return setError("Informe o Fornecedor.");
            if (!formData.nf) return setError("Nota Fiscal é obrigatória para Compra.");
            if (!formData.valor_total) return setError("Informe o Valor Total.");
        }

        // AUDITORIA DE EDIÇÃO
        if (formData.id && !justificativa) {
            return setError("🔒 AUDITORIA: Informe o motivo da alteração para salvar.");
        }

        setLoading(true);
        setError('');

        try {
            // 0. DUAL-WRITE: Criar itens novos se necessário
            let produtoFinalColheita = formData.produto_select;
            let insumoFinal = formData.insumo;

            // Detectar criação de nova semente (Colheita/Venda)
            if (['Colheita', 'Venda'].includes(activityType) && formData.produto_select) {
                if (formData.produto_select.startsWith('➕ Adicionar "')) {
                    const nomeNovo = formData.produto_select.replace('➕ Adicionar "', '').replace('"', '');
                    await dashboardService.createQuickItem(pmoId, 'semente', nomeNovo);
                    produtoFinalColheita = nomeNovo;
                    setSnackbar({
                        open: true,
                        message: `✅ Cultura "${nomeNovo}" adicionada ao catálogo. Complete os detalhes no PMO depois.`
                    });
                }
            }

            // Detectar criação de novo insumo (Aplicação)
            if (activityType === 'Insumo' && formData.insumo) {
                if (formData.insumo.startsWith('➕ Adicionar "')) {
                    const nomeNovo = formData.insumo.replace('➕ Adicionar "', '').replace('"', '');
                    await dashboardService.createQuickItem(pmoId, 'insumo', nomeNovo);
                    insumoFinal = nomeNovo;
                    setSnackbar({
                        open: true,
                        message: `✅ Insumo "${nomeNovo}" adicionado ao catálogo. Complete os detalhes no PMO depois.`
                    });
                }
            }

            // 1. UPLOAD (Only if selected)
            let anexoUrl = null;
            if (selectedFile) {
                anexoUrl = await dashboardService.uploadComprovante(selectedFile);
            }

            // 2. CONSTRUCT PAYLOAD
            const talhaoObj = listaTalhoes.find(t => t.id === formData.talhao_id);
            const talhaoNome = talhaoObj?.nome || '';

            const localFull = formData.talhao_canteiro || (
                (showCanteiro && formData.canteiro)
                    ? `${talhaoNome} - ${formData.canteiro}`
                    : talhaoNome || 'Geral'
            );

            // Usar produto processado (pode ser novo ou existente)
            const produtoFinal = produtoFinalColheita || formData.produto_select || '';

            // JSONB Packing
            const detalhes = {
                ...(recordToEdit?.detalhes_tecnicos || {}), // PRESERVE EXISTING DATA

                local_especifico: formData.canteiro,
                anexo_url: anexoUrl,
                talhao_id: formData.talhao_id || null, // Guardando ID no JSONB

                // Por Tipo
                ...(activityType === 'Manejo' && { atividade: formData.observacao }),
                ...(activityType === 'Colheita' && { produto: produtoFinal, qtd_descarte: formData.qtd_descarte, destino: formData.destino }),
                ...(activityType === 'Venda' && { cliente: formData.cliente, produto: produtoFinal, nf: formData.nf, valor: formData.valor_total, qtd: formData.quantidade }),
                ...(activityType === 'Compra' && { fornecedor: formData.fornecedor, nf: formData.nf, valor: formData.valor_total }),
                ...(activityType === 'Insumo' && { insumo: insumoFinal, dosagem: formData.dosagem }),
                ...(activityType === 'Limpeza' && { item: formData.item_limpeza, tipo: formData.tipo_limpeza }),
            };

            // AUDITORIA: Adicionar histórico se for edição
            if (formData.id && recordToEdit) {
                const currentHistory = recordToEdit.detalhes_tecnicos?.historico_alteracoes || [];
                detalhes.historico_alteracoes = [
                    ...currentHistory,
                    {
                        data: new Date().toISOString(),
                        acao: 'EDIT',
                        motivo: justificativa,
                        usuario: user.email
                    }
                ];
            }

            const form = {
                id: formData.id || null, // Se existir ID, passa para update
                user_id: user.id, // RLS requirement
                data_registro: formData.data_registro,
                produto: ['Colheita', 'Venda'].includes(activityType) ? produtoFinal : null,
                quantidade_valor: ['Colheita', 'Venda'].includes(activityType) ? parseFloat(formData.quantidade) : null,
                quantidade_unidade: ['Colheita', 'Venda'].includes(activityType) ? formData.unidade : null,
                talhao_canteiro: localFull,
                observacao_original: formData.observacao,
                detalhes_tecnicos: detalhes
            };

            // 3. SAVE usando nova assinatura: saveRecord(tipo, form, anexo, pmoId)
            await dashboardService.saveRecord(activityType, form, anexoUrl, pmoId);

            if (onRecordSaved) onRecordSaved();
            handleClose();

        } catch (err) {
            setError(err.message || "Erro ao salvar.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Reset Completo
        setFormData({
            data_registro: new Date().toISOString().split('T')[0],
            observacao: '', talhao_id: '', canteiro: '', talhao_canteiro: '',
            produto_select: '', produto_custom: '', quantidade: '', unidade: 'kg',
            qtd_descarte: '', destino: '', cliente: '', valor_total: '', nf: '',
            insumo: '', dosagem: '', item_limpeza: '', tipo_limpeza: '', fornecedor: ''
        });
        setOpenLocationSelector(false);
        setActivityType('Manejo');
        setSelectedFile(null);
        setJustificativa('');
        setShowCanteiro(false);
        setError('');
        onClose();
    };

    const currAct = ACTIVITIES.find(a => a.id === activityType) || ACTIVITIES[0];
    const isAuditType = ['Compra', 'Venda'].includes(activityType); // Controla visualização do Upload

    return (
        <Dialog open={open} onClose={loading ? null : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Box color={currAct.color}>{currAct.icon}</Box>
                {/* Fix: component="span" avoids nesting h6 inside h2 (DialogTitle default) */}
                {/* Fix: component="span" avoids nesting h6 inside h2 (DialogTitle default) */}
                <Typography variant="h6" component="span" fontWeight={800} color="#1e293b">
                    {recordToEdit ? 'Editar Registro:' : 'Novo Registro:'} <span style={{ color: currAct.color }}>{currAct.label}</span>
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

                <Grid container sx={{ minHeight: 450 }}>
                    {/* SIDEBAR TIPO */}
                    <Grid size={{ xs: 12, md: 3 }} sx={{ bgcolor: '#f1f5f9', borderRight: '1px solid #e2e8f0', p: 2 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                            ATIVIDADE
                        </Typography>
                        <Grid container spacing={1}>
                            {ACTIVITIES.map((act) => (
                                <Grid size={{ xs: 4, md: 12 }} key={act.id}>
                                    <Card
                                        elevation={0}
                                        sx={{
                                            bgcolor: activityType === act.id ? '#ffffff' : 'transparent',
                                            border: activityType === act.id ? `2px solid ${act.color}` : '1px dashed transparent',
                                            color: activityType === act.id ? '#0f172a' : '#64748b',
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => !loading && setActivityType(act.id)}
                                    >
                                        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                                            <Box sx={{ color: act.color }}>{act.icon}</Box>
                                            <Typography variant="body2" fontWeight={600} sx={{ display: { xs: 'none', md: 'block' } }}>
                                                {act.label}
                                            </Typography>
                                        </Box>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Grid>

                    {/* FORMULÁRIO DINÂMICO */}
                    <Grid size={{ xs: 12, md: 9 }} sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                            {/* DATA */}
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="Data" type="date" name="data_registro"
                                        value={formData.data_registro ? String(formData.data_registro).split('T')[0] : ''}
                                        onChange={handleChange}
                                        fullWidth size="small" InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                            </Grid>

                            {/* UPLOAD (Apenas para Compra e Venda - CONDICIONAL ESTRICTA) */}
                            {isAuditType && (
                                <Box sx={{ p: 2, bgcolor: '#fffbeb', borderRadius: 2, border: '1px dashed #fcd34d' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#d97706', mb: 1, display: 'block' }}>
                                        AUDITORIA: Anexar Nota Fiscal ou Recibo
                                    </Typography>
                                    <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf" />
                                    <Button
                                        variant="outlined" color="warning" startIcon={<Paperclip size={18} />}
                                        onClick={() => fileInputRef.current.click()}
                                        sx={{ textTransform: 'none', bgcolor: 'white' }}
                                    >
                                        {selectedFile ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                                    </Button>
                                    {selectedFile && (
                                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#16a34a', fontSize: '0.9rem' }}>
                                            <FileText size={16} /> {selectedFile.name}
                                            <IconButton size="small" onClick={() => setSelectedFile(null)}><XCircle size={16} /></IconButton>
                                        </Box>
                                    )}
                                </Box>
                            )}

                            {/* === LÓGICA DE CAMPOS POR TIPO (FINAL) === */}

                            {/* 1. MANEJO */}
                            {activityType === 'Manejo' && (
                                <>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12 }}>
                                            {/* Seletor Integrado com Estilo de Input */}
                                            <TextField
                                                label="Onde? (Clique para selecionar)"
                                                placeholder="Selecione um ou mais locais..."
                                                value={formData.talhao_canteiro}
                                                onClick={() => setOpenLocationSelector(true)}
                                                fullWidth
                                                size="small"
                                                InputProps={{
                                                    readOnly: true,
                                                    endAdornment: <MapPin size={18} color="#64748b" /> // Using Lucide MapPin as imported
                                                }}
                                            />
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mt: 0.5, display: 'block' }}>
                                                Você pode selecionar múltiplos canteiros/talhões.
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 12 }}>
                                            <TextField label="Atividade Realizada (Ex: Poda, Roçada)" name="observacao" value={formData.observacao} onChange={handleChange} fullWidth size="small" />
                                        </Grid>
                                    </Grid>
                                </>
                            )}

                            {/* 2. COLHEITA */}
                            {activityType === 'Colheita' && (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="Onde? (Clique para selecionar)"
                                            placeholder="Selecione um ou mais locais..."
                                            value={formData.talhao_canteiro}
                                            onClick={() => setOpenLocationSelector(true)}
                                            fullWidth
                                            size="small"
                                            InputProps={{
                                                readOnly: true,
                                                endAdornment: <MapPin size={18} color="#64748b" />
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Autocomplete
                                            freeSolo
                                            options={(Array.isArray(listaSementes) ? listaSementes : []).map(s => s.especies).filter(Boolean)}
                                            value={formData.produto_select}
                                            onChange={(e, newValue) => setFormData(prev => ({ ...prev, produto_select: newValue || '' }))}
                                            onInputChange={(e, newValue) => setFormData(prev => ({ ...prev, produto_select: newValue || '' }))}
                                            filterOptions={(options, params) => {
                                                const filtered = options.filter(opt =>
                                                    opt.toLowerCase().includes(params.inputValue.toLowerCase())
                                                );
                                                if (params.inputValue !== '' && !filtered.some(opt => opt.toLowerCase() === params.inputValue.toLowerCase())) {
                                                    filtered.push(`➕ Adicionar "${params.inputValue}"`);
                                                }
                                                return filtered;
                                            }}
                                            renderInput={(params) => <TextField {...params} label="Cultura" size="small" fullWidth />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <TextField label="Qtd Colhida" name="quantidade" type="number" value={formData.quantidade} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 2 }}>
                                        <TextField select label="Unidade" name="unidade" value={formData.unidade} onChange={handleChange} fullWidth size="small">
                                            {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                        </TextField>
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <TextField label="Descarte" name="qtd_descarte" type="number" value={formData.qtd_descarte} onChange={handleChange} fullWidth size="small" color="warning" />
                                    </Grid>
                                    <Grid size={{ xs: 2 }}>
                                        <TextField select label="Un." name="unidade_descarte" value={formData.unidade_descarte} onChange={handleChange} fullWidth size="small" color="warning">
                                            {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                        </TextField>
                                    </Grid>
                                </Grid>
                            )}

                            {/* 3. APLICAÇÃO (INSUMO) */}
                            {activityType === 'Insumo' && (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="Onde? (Clique para selecionar)"
                                            placeholder="Selecione um ou mais locais..."
                                            value={formData.talhao_canteiro}
                                            onClick={() => setOpenLocationSelector(true)}
                                            fullWidth
                                            size="small"
                                            InputProps={{
                                                readOnly: true,
                                                endAdornment: <MapPin size={18} color="#64748b" />
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Autocomplete
                                            freeSolo
                                            options={(Array.isArray(listaInsumos) ? listaInsumos : []).map(i => i.produto_ou_manejo).filter(Boolean)}
                                            value={formData.insumo}
                                            onChange={(e, newValue) => setFormData(prev => ({ ...prev, insumo: newValue || '' }))}
                                            onInputChange={(e, newValue) => setFormData(prev => ({ ...prev, insumo: newValue || '' }))}
                                            filterOptions={(options, params) => {
                                                const filtered = options.filter(opt =>
                                                    opt.toLowerCase().includes(params.inputValue.toLowerCase())
                                                );
                                                if (params.inputValue !== '' && !filtered.some(opt => opt.toLowerCase() === params.inputValue.toLowerCase())) {
                                                    filtered.push(`➕ Adicionar "${params.inputValue}"`);
                                                }
                                                return filtered;
                                            }}
                                            renderInput={(params) => <TextField {...params} label="Insumo (Ex: Biofertilizante)" size="small" fullWidth />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField label="Dosagem (Ex: 5L/ha)" name="dosagem" value={formData.dosagem} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                </Grid>
                            )}

                            {/* 4. LIMPEZA */}
                            {activityType === 'Limpeza' && (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField label="Área / Item Limpo" name="item_limpeza" value={formData.item_limpeza} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField label="Tipo de Limpeza" name="tipo_limpeza" value={formData.tipo_limpeza} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField label="Observações" name="observacao" value={formData.observacao} onChange={handleChange} fullWidth size="small" multiline rows={2} />
                                    </Grid>
                                </Grid>
                            )}

                            {/* 5. VENDA (NOVO) */}
                            {activityType === 'Venda' && (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Autocomplete
                                            freeSolo
                                            options={(Array.isArray(listaSementes) ? listaSementes : []).map(s => s.especies).filter(Boolean)}
                                            value={formData.produto_select}
                                            onChange={(e, newValue) => setFormData(prev => ({ ...prev, produto_select: newValue || '' }))}
                                            onInputChange={(e, newValue) => setFormData(prev => ({ ...prev, produto_select: newValue || '' }))}
                                            filterOptions={(options, params) => {
                                                const filtered = options.filter(opt =>
                                                    opt.toLowerCase().includes(params.inputValue.toLowerCase())
                                                );
                                                if (params.inputValue !== '' && !filtered.some(opt => opt.toLowerCase() === params.inputValue.toLowerCase())) {
                                                    filtered.push(`➕ Adicionar "${params.inputValue}"`);
                                                }
                                                return filtered;
                                            }}
                                            renderInput={(params) => <TextField {...params} label="Produto Vendido" size="small" fullWidth />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField label="Cliente / Destino" name="cliente" value={formData.cliente} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 5 }}>
                                        <TextField label="Qtd Vendida" name="quantidade" type="number" value={formData.quantidade} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 3 }}>
                                        <TextField select label="Unidade" name="unidade" value={formData.unidade} onChange={handleChange} fullWidth size="small">
                                            {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                        </TextField>
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <TextField label="Valor Total (R$)" name="valor_total" type="number" value={formData.valor_total} onChange={handleChange} fullWidth size="small" InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField label="Nº Nota Fiscal (Obrigatório)" name="nf" value={formData.nf} onChange={handleChange} fullWidth size="small" color="warning" focused />
                                    </Grid>
                                </Grid>
                            )}

                            {/* 6. COMPRA */}
                            {activityType === 'Compra' && (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField label="Fornecedor" name="fornecedor" value={formData.fornecedor} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField label="Item/Produto Comprado" name="produto_select" value={formData.produto_select} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <TextField label="Quantidade" name="quantidade" type="number" value={formData.quantidade} onChange={handleChange} fullWidth size="small" />
                                    </Grid>
                                    <Grid size={{ xs: 3 }}>
                                        <TextField select label="Unidade" name="unidade" value={formData.unidade} onChange={handleChange} fullWidth size="small">
                                            {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                        </TextField>
                                    </Grid>
                                    <Grid size={{ xs: 5 }}>
                                        <TextField label="Valor Total (R$)" name="valor_total" type="number" value={formData.valor_total} onChange={handleChange} fullWidth size="small" InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField label="Nº Nota Fiscal" name="nf" value={formData.nf} onChange={handleChange} fullWidth size="small" color="warning" focused />
                                    </Grid>
                                </Grid>
                            )}

                            {/* === CAMPO DE AUDITORIA (VISÍVEL APENAS NA EDIÇÃO) === */}
                            {formData.id && (
                                <Box sx={{ mt: 2, p: 2, bgcolor: '#fff1f2', border: '1px dashed #f43f5e', borderRadius: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#be123c', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        🔒 Auditoria de Alteração
                                    </Typography>
                                    <TextField
                                        label="Motivo da Alteração (Obrigatório)"
                                        placeholder="Ex: Erro de digitação, quantidade ajustada, mudança de local..."
                                        fullWidth
                                        multiline
                                        rows={2}
                                        value={justificativa}
                                        onChange={(e) => setJustificativa(e.target.value)}
                                        size="small"
                                        color="error"
                                        focused
                                    />
                                    <Typography variant="caption" sx={{ color: '#881337', mt: 0.5, display: 'block' }}>
                                        Esta justificativa ficará gravada permanentemente no histórico deste registro.
                                    </Typography>
                                </Box>
                            )}

                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={handleClose} disabled={loading} color="inherit">Cancelar</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    sx={{ bgcolor: currAct.color, px: 4, fontWeight: 700 }}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : currAct.icon}
                >
                    {loading ? 'Salvando...' : 'Salvar Registro'}
                </Button>
            </DialogActions>

            {/* Snackbar para feedback de criação */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ width: '100%' }} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Dialog
                open={openLocationSelector}
                onClose={() => setOpenLocationSelector(false)}
                maxWidth="sm"
                fullWidth
                disableEnforceFocus
            >
                <DialogTitle>Selecione os Locais</DialogTitle>
                <DialogContent>
                    <SeletorLocalizacaoSaf
                        value={formData.talhao_canteiro}
                        onChange={(newVal) => {
                            const talhaoName = newVal.split(' - ')[0];
                            const talhaoFound = listaTalhoes.find(t => t.nome === talhaoName);
                            setFormData(prev => ({
                                ...prev,
                                talhao_canteiro: newVal,
                                talhao_id: talhaoFound ? talhaoFound.id : prev.talhao_id
                            }));
                        }}
                        multiple={true}
                        talhoes={listaTalhoes || []}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenLocationSelector(false)} variant="contained" color="primary">
                        Pronto
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog >
    );
};

export default ManualRecordDialog;
