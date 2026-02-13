// src/components/PmoForm/Secao9_MUI.tsx

import React, { useState, ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button,
    TextField, Typography, IconButton, FormControl, Select, MenuItem,
    InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
    Grid, FormControlLabel, Radio, RadioGroup, Stack, Divider, Alert,
    SelectChangeEvent
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SproutIcon from '@mui/icons-material/Spa';

import SectionShell from '../Plan/SectionShell';
import PropagacaoCard from './cards/PropagacaoCard';

// Types
interface PropagacaoItem {
    _id: string;
    tipo?: string;
    especies?: string;
    origem?: string;
    quantidade?: string;
    sistema_organico?: boolean;
    data_compra?: string;
}

interface Secao9Data {
    sementes_mudas_organicas?: PropagacaoItem[];
    sementes_mudas_nao_organicas?: PropagacaoItem[];
    tratamento_sementes_mudas?: { tratamento_sementes_mudas?: string };
    manejo_producao_propria?: { manejo_producao_propria?: string };
    postura_uso_materiais_transgenicos_organica?: { postura_uso_materiais_transgenicos_organica?: string };
    cuidados_uso_materiais_transgenicos_nao_organica?: { cuidados_uso_materiais_transgenicos_nao_organica?: string };
    [key: string]: any;
}

interface Secao9MUIProps {
    data: Secao9Data | null | undefined;
    onSectionChange: (data: Secao9Data) => void;
}

// Função auxiliar para gerar ID único
const generateUniqueId = (): string => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const Secao9MUI: React.FC<Secao9MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    // Estados do Modal de Edição
    const [modalOpen, setModalOpen] = useState(false);
    const [currentListKey, setCurrentListKey] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<PropagacaoItem | null>(null);

    // Estados do Dialog de Confirmação de Exclusão
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ listKey: string; itemId: string } | null>(null);

    // Handler Genérico para campos de texto
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({ ...safeData, [name]: { [name]: value } });
    };

    // --- LÓGICA DO CRUD (CARDS & MODAL) ---

    const handleAddNew = (listKey: string) => {
        setCurrentListKey(listKey);
        setEditingItem({
            _id: generateUniqueId(),
            tipo: 'semente',
            especies: '',
            origem: '',
            quantidade: '',
            sistema_organico: true,
            data_compra: ''
        });
        setModalOpen(true);
    };

    const handleEdit = (listKey: string, item: PropagacaoItem) => {
        setCurrentListKey(listKey);
        setEditingItem({ ...item });
        setModalOpen(true);
    };

    const handleDelete = (listKey: string, itemId: string) => {
        setItemToDelete({ listKey, itemId });
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemToDelete) {
            const list = (safeData[itemToDelete.listKey] as PropagacaoItem[]) || [];
            const newList = list.filter(i => i._id !== itemToDelete.itemId);
            onSectionChange({ ...safeData, [itemToDelete.listKey]: newList });
        }
        setDeleteDialogOpen(false);
        setItemToDelete(null);
    };

    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setItemToDelete(null);
    };

    const handleSaveModal = () => {
        if (!editingItem?.especies) {
            alert('Por favor, informe a espécie/cultivar.');
            return;
        }

        if (!currentListKey) return;

        const list = Array.isArray(safeData[currentListKey]) ? [...(safeData[currentListKey] as PropagacaoItem[])] : [];
        const index = list.findIndex(i => i._id === editingItem._id);

        if (index >= 0) {
            list[index] = editingItem;
        } else {
            list.push(editingItem);
        }

        onSectionChange({ ...safeData, [currentListKey]: list });
        setModalOpen(false);
        setEditingItem(null);
    };

    // Renderiza a lista de Cards
    const renderCardList = (listKey: string) => {
        const list = (safeData[listKey] as PropagacaoItem[]) || [];

        if (list.length === 0) {
            return (
                <Box sx={{
                    textAlign: 'center', py: 4, px: 2,
                    bgcolor: '#f5f5f5', borderRadius: 2,
                    border: '1px dashed #bdbdbd'
                }}>
                    <SproutIcon sx={{ fontSize: 48, color: '#9e9e9e', mb: 1 }} />
                    <Typography variant="body1" color="textSecondary">
                        Nenhum item cadastrado nesta seção.
                    </Typography>
                    <Button
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => handleAddNew(listKey)}
                        sx={{ mt: 2 }}
                    >
                        Adicionar Agora
                    </Button>
                </Box>
            );
        }

        return (
            <Stack spacing={2}>
                {list.map((item) => (
                    <PropagacaoCard
                        key={item._id || Math.random()}
                        item={item}
                        onEdit={() => handleEdit(listKey, item)}
                        onDelete={() => handleDelete(listKey, item._id)}
                    />
                ))}
                <Button
                    startIcon={<AddCircleOutlineIcon />}
                    variant="outlined"
                    onClick={() => handleAddNew(listKey)}
                >
                    Adicionar Outro
                </Button>
            </Stack>
        );
    };

    return (
        <SectionShell
            sectionLabel="Seção 9"
            title="Propagação Vegetal"
        >

            {/* 9.1 - Sementes/Mudas Orgânicas */}
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>9.1. Origem das sementes/mudas (Produção Orgânica)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Atenção: O uso de sementes não orgânicas requer justificativa e autorização prévia.
                    </Alert>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Descreva a procedência de todas as espécies cultivadas no sistema orgânico.
                    </Typography>
                    {renderCardList('sementes_mudas_organicas')}
                </AccordionDetails>
            </Accordion>

            {/* 9.2 - Tratamento */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>9.2. Tratamento das sementes/mudas</Typography></AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="tratamento_sementes_mudas"
                        label="Especifique se houver tratamento"
                        value={safeData.tratamento_sementes_mudas?.tratamento_sementes_mudas || ''}
                        onChange={handleChange}
                        fullWidth multiline rows={3} variant="outlined"
                    />
                </AccordionDetails>
            </Accordion>

            {/* 9.3 - Produção Própria */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>9.3. Manejo de produção própria</Typography></AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="manejo_producao_propria"
                        label="Composição do substrato e tratamentos"
                        value={safeData.manejo_producao_propria?.manejo_producao_propria || ''}
                        onChange={handleChange}
                        fullWidth multiline rows={3} variant="outlined"
                    />
                </AccordionDetails>
            </Accordion>

            {/* 9.4 - Sementes/Mudas NÃO Orgânicas */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>9.4. Aquisição para Cultivo Paralelo (Não Orgânico)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Registro exclusivo para insumos destinados a áreas de cultivo convencional/paralelo.
                    </Typography>
                    {renderCardList('sementes_mudas_nao_organicas')}
                </AccordionDetails>
            </Accordion>

            {/* 9.5 & 9.6 - Transgênicos */}
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>9.5. Postura sobre transgênicos (Orgânico)</Typography></AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="postura_uso_materiais_transgenicos_organica"
                        value={safeData.postura_uso_materiais_transgenicos_organica?.postura_uso_materiais_transgenicos_organica || ''}
                        onChange={handleChange}
                        fullWidth multiline rows={3}
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>9.6. Cuidados com transgênicos (Não Orgânico)</Typography></AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="cuidados_uso_materiais_transgenicos_nao_organica"
                        value={safeData.cuidados_uso_materiais_transgenicos_nao_organica?.cuidados_uso_materiais_transgenicos_nao_organica || ''}
                        onChange={handleChange}
                        fullWidth multiline rows={3}
                    />
                </AccordionDetails>
            </Accordion>

            {/* --- MODAL DE EDIÇÃO/CRIAÇÃO --- */}
            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#16a34a', color: 'white' }}>
                    {editingItem?._id ? 'Editar Item' : 'Novo Item'}
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Tipo</InputLabel>
                                <Select
                                    value={editingItem?.tipo || 'semente'}
                                    label="Tipo"
                                    onChange={(e: SelectChangeEvent) => setEditingItem(prev => prev ? { ...prev, tipo: e.target.value } : null)}
                                >
                                    <MenuItem value="semente">Semente</MenuItem>
                                    <MenuItem value="muda">Muda</MenuItem>
                                    <MenuItem value="estaca">Estaca</MenuItem>
                                    <MenuItem value="bulbo">Bulbo</MenuItem>
                                    <MenuItem value="rizoma">Rizoma</MenuItem>
                                    <MenuItem value="maniva">Maniva</MenuItem>
                                    <MenuItem value="tuberculo">Tubérculo</MenuItem>
                                    <MenuItem value="rebento">Rebento</MenuItem>
                                    <MenuItem value="meristema">Meristema</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Data da Compra"
                                type="date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={editingItem?.data_compra ? editingItem.data_compra.split('T')[0] : ''}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, data_compra: e.target.value } : null)}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Espécie / Cultivar"
                                placeholder="Ex: Alface Crespa, Tomate Italiano"
                                fullWidth
                                required
                                value={editingItem?.especies || ''}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, especies: e.target.value } : null)}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Origem (Fornecedor)"
                                placeholder="Ex: Agropecuária Silva, Sementes Isla"
                                fullWidth
                                value={editingItem?.origem || ''}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, origem: e.target.value } : null)}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Quantidade"
                                placeholder="Ex: 50g, 100 mudas"
                                fullWidth
                                value={editingItem?.quantidade || ''}
                                onChange={(e) => setEditingItem(prev => prev ? { ...prev, quantidade: e.target.value } : null)}
                            />
                        </Grid>

                        {/* Campo "Sistema Orgânico" aparece apenas na lista 9.1 */}
                        {currentListKey === 'sementes_mudas_organicas' && (
                            <Grid item xs={12} sm={6}>
                                <Typography variant="caption" display="block" gutterBottom>
                                    Certificação Orgânica?
                                </Typography>
                                <RadioGroup
                                    row
                                    value={editingItem?.sistema_organico ? 'sim' : 'nao'}
                                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, sistema_organico: e.target.value === 'sim' } : null)}
                                >
                                    <FormControlLabel value="sim" control={<Radio color="success" />} label="Sim" />
                                    <FormControlLabel value="nao" control={<Radio color="default" />} label="Não" />
                                </RadioGroup>
                            </Grid>
                        )}

                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModalOpen(false)} color="inherit">Cancelar</Button>
                    <Button onClick={handleSaveModal} variant="contained" sx={{ bgcolor: '#16a34a' }}>
                        Salvar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog de Confirmação de Exclusão */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCancelDelete}
                aria-labelledby="delete-confirm-title"
            >
                <DialogTitle id="delete-confirm-title">Confirmar Exclusão</DialogTitle>
                <DialogContent>
                    <Typography>
                        Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} color="inherit">Cancelar</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">
                        Excluir
                    </Button>
                </DialogActions>
            </Dialog>
        </SectionShell>
    );
};

export default Secao9MUI;
