import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Stack,
  Collapse,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  TextField
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  BugReport as BugIcon,
  WaterDrop as DosagemIcon,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import SectionContainer from '../Common/SectionContainer';

// ===========================================
// 1. Interfaces (TypeScript)
// ===========================================
export interface FitossanidadeItem {
  id?: string;
  _id?: string;
  produto_ou_manejo: string;
  alvo_principal: string;
  qual_praga_doenca?: string;
  dosagem: string; // Legacy
  dose_valor?: string; // DIVIDIDO - User requested string, kept compatible
  dose_unidade?: string; // DIVIDIDO
  quando: string;
  procedencia: string;
  composicao: string;
  marca: string;
  onde?: string;
}

interface FitossanidadeCardProps {
  item: FitossanidadeItem;
  onEdit: () => void;
  onDelete: () => void;
}

// ===========================================
// 2. Componente Card (Blindado)
// ===========================================
const FitossanidadeCard: React.FC<FitossanidadeCardProps> = ({ item, onEdit, onDelete }) => {
  if (!item) return null;

  const [expanded, setExpanded] = useState(false);
  const themeColor = '#f59e0b'; // Laranja/Âmbar

  // Helper para exibir dosagem
  const displayDosagem = item.dose_valor && item.dose_unidade
    ? `${item.dose_valor} ${item.dose_unidade}`
    : item.dosagem;

  return (
    <Card elevation={1} sx={{ borderRadius: 2, borderLeft: `6px solid ${themeColor}`, mb: 2, bgcolor: '#fff' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">

          {/* Lado Esquerdo: Ícone e Título */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{
              bgcolor: `${themeColor}20`,
              p: 1,
              borderRadius: '50%',
              color: themeColor
            }}>
              <BugIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                {item?.produto_ou_manejo || 'Não informado'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Alvo: <strong>{item?.alvo_principal || item?.['qual_praga_doenca'] || 'Não informado'}</strong>
              </Typography>
            </Box>
          </Box>

          {/* Lado Direito: Ações */}
          <Stack direction="row">
            <IconButton size="small" onClick={onEdit} color="primary">
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onDelete} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* Chips de Contexto */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          {item?.onde && (
            <Chip label={`Cultura: ${item.onde}`} size="small" variant="outlined" />
          )}
          {displayDosagem && (
            <Chip
              icon={<DosagemIcon fontSize="small" />}
              label={displayDosagem}
              size="small"
              sx={{ bgcolor: '#e0f2fe', color: '#0284c7', borderColor: 'transparent' }}
            />
          )}
        </Stack>

        {/* Detalhes Expansíveis */}
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
            sx={{ color: 'text.secondary', textTransform: 'none', p: 0, minWidth: 0 }}
          >
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes técnicos'}
          </Button>

          <Collapse in={expanded}>
            <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f9fafb', borderRadius: 1, fontSize: '0.875rem' }}>
              <Stack spacing={1}>
                {item?.quando && <Box><strong>Quando aplicar:</strong> {item.quando}</Box>}
                {item?.procedencia && <Box><strong>Procedência:</strong> {item.procedencia}</Box>}
                {item?.composicao && <Box><strong>Composição:</strong> {item.composicao}</Box>}
                {item?.marca && <Box><strong>Marca:</strong> {item.marca}</Box>}
              </Stack>
            </Box>
          </Collapse>
        </Box>

      </CardContent>
    </Card>
  );
};

// ===========================================
// 3. Componente Principal (Section Wrapper)
// ===========================================
interface Secao10MUIProps {
  data: any;
  onSectionChange: (newData: any) => void;
}

const Secao10MUI: React.FC<Secao10MUIProps> = ({ data, onSectionChange }) => {
  const items: FitossanidadeItem[] = Array.isArray(data?.lista_fitossanidade) ? data.lista_fitossanidade : [];

  // Estados do Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FitossanidadeItem | null>(null);

  // Estados do Dialog de Confirmação de Exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemIdToDelete, setItemIdToDelete] = useState<string | null>(null);

  // Handlers CRUD
  const handleDataChange = (newItems: any[]) => {
    onSectionChange({ ...data, lista_fitossanidade: newItems });
  };

  const handleAddNew = () => {
    setEditingItem({
      _id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      produto_ou_manejo: '',
      alvo_principal: '',
      dosagem: '',
      dose_valor: '',
      dose_unidade: 'ml/litro',
      quando: '',
      procedencia: '',
      composicao: '',
      marca: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (item: FitossanidadeItem) => {
    setEditingItem({ ...item });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setItemIdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemIdToDelete) {
      handleDataChange(items.filter(i => (i._id || i.id) !== itemIdToDelete));
    }
    setDeleteDialogOpen(false);
    setItemIdToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setItemIdToDelete(null);
  };

  const handleSaveModal = () => {
    if (!editingItem) return;

    if (!editingItem.produto_ou_manejo) {
      alert('Por favor, informe o produto ou manejo.');
      return;
    }

    const index = items.findIndex(i => (i._id === editingItem._id) || (i.id && i.id === editingItem.id));

    let newItems = [...items];
    // Sync legacy dosagem field
    if (editingItem.dose_valor && editingItem.dose_unidade) {
      editingItem.dosagem = `${editingItem.dose_valor} ${editingItem.dose_unidade}`;
    }

    if (index >= 0) {
      newItems[index] = editingItem;
    } else {
      newItems.push(editingItem);
    }

    handleDataChange(newItems);
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleFieldChange = (field: keyof FitossanidadeItem, value: any) => {
    if (editingItem) {
      setEditingItem({ ...editingItem, [field]: value });
    }
  };

  const handleApplySuggestion = (data: any) => {
    console.log('[BOT-DEBUG] Applying Suggestion Payload:', data);

    // Extract product name from multiple possible fields (AI may use different names)
    const produtoNome =
      data.produto ||          // Standard field
      data.insumo ||           // Legacy field
      data.descricao ||        // Planning descriptions
      data.nome ||             // Possible alternative
      '';

    console.log('[BOT-DEBUG] Extracted produto_ou_manejo:', produtoNome);

    // Map AI fields to Component fields
    const newItem: FitossanidadeItem = {
      _id: `row_${Date.now()}_suggestion`,
      produto_ou_manejo: produtoNome || 'Sugerido pelo Robô',
      alvo_principal: data.alvo_praga_doenca || data.alvo_principal || data.praga_doenca || '',
      dose_valor: String(data.dose_valor || ''),
      dose_unidade: data.dose_unidade || 'ml/litro',
      dosagem: data.dose_valor && data.dose_unidade ? `${data.dose_valor} ${data.dose_unidade}` : '',
      quando: '',
      procedencia: data.procedencia || data.origem || '',
      composicao: '',
      marca: '',
      onde: data.cultura || data.onde || ''
    };

    console.log('[BOT-DEBUG] Mapped Item:', newItem);

    const newItems = [...items, newItem];
    handleDataChange(newItems);
  };

  return (
    <>
      <SectionContainer
        title="Manejo Fitossanitário (Pragas e Doenças)"
        onAdd={handleAddNew}
        addButtonLabel="Adicionar Manejo"
        isEmpty={items.length === 0}
        emptyMessage="Nenhum manejo de fitossanidade registrado."
        icon={<BugIcon sx={{ fontSize: 48 }} />}
        sectionId={10}
        onApplySuggestion={handleApplySuggestion}
      >
        <Stack spacing={0}>
          {items.map((item, index) => (
            <FitossanidadeCard
              key={item._id || item.id || index}
              item={item}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item._id || item.id || '')}
            />
          ))}
          {/* Botão extra no final da lista opcional */}
          <Button
            variant="outlined"
            color="primary"
            startIcon={<EditIcon />}
            onClick={handleAddNew}
            sx={{ mt: 1, textTransform: 'none', fontWeight: 600, borderStyle: 'dashed' }}
          >
            Adicionar Outro Item
          </Button>
        </Stack>
      </SectionContainer>

      {/* Modal de Edição */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: '#1e293b', fontWeight: 700 }}>
          {editingItem?.produto_ou_manejo ? 'Editar Manejo' : 'Novo Manejo Fitossanitário'}
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="body2" sx={{ mb: 3, display: 'block', color: 'text.secondary' }}>
            Preencha as informações sobre o produto ou técnica utilizada.
          </Typography>
          <Grid container spacing={3}>
            {/* 1. Produto / Manejo (100%) */}
            <Grid item xs={12}>
              <TextField
                label="Produto ou Manejo *"
                placeholder="Ex: Calda Bordalesa, Óleo de Neem"
                fullWidth
                required
                value={editingItem?.produto_ou_manejo || ''}
                onChange={(e) => handleFieldChange('produto_ou_manejo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* 2. Alvo Principal (100%) */}
            <Grid item xs={12}>
              <TextField
                label="Alvo Principal (Praga/Doença)"
                placeholder="Ex: Lagarta, Ferrugem"
                fullWidth
                value={editingItem?.alvo_principal || ''}
                onChange={(e) => handleFieldChange('alvo_principal', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* 3. Dosagem (Value + Unit) */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Dose (Valor)"
                type="number"
                placeholder="Ex: 5"
                fullWidth
                value={editingItem?.dose_valor || ''}
                onChange={(e) => handleFieldChange('dose_valor', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                select
                label="Unidade"
                fullWidth
                value={editingItem?.dose_unidade || 'ml/litro'}
                onChange={(e) => handleFieldChange('dose_unidade', e.target.value)}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
              >
                <option value="ml/litro">ml / Litro</option>
                <option value="%">% (Proporção)</option>
                <option value="l/ha">Litros / Hectare</option>
                <option value="kg/ha">Kg / Hectare</option>
                <option value="g/m²">g/m²</option>
                <option value="ml/m²">ml/m²</option>
                <option value="kg/cova">kg/cova</option>
                <option value="g/planta">g/planta</option>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Quando aplicar?"
                placeholder="Ex: Preventivo ou Curativo"
                fullWidth
                value={editingItem?.quando || ''}
                onChange={(e) => handleFieldChange('quando', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* 4. Procedência & Marca (50% / 50%) */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Procedência"
                placeholder="Onde comprou / produziu?"
                fullWidth
                value={editingItem?.procedencia || ''}
                onChange={(e) => handleFieldChange('procedencia', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Marca Comercial"
                placeholder="Ex: Caseira, Marca X"
                fullWidth
                value={editingItem?.marca || ''}
                onChange={(e) => handleFieldChange('marca', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* 5. Composição (100% - Multiline) */}
            <Grid item xs={12}>
              <TextField
                label="Composição / Ingrediente Ativo"
                placeholder="Ex: Sulfato de cobre e cal"
                fullWidth
                multiline
                rows={3}
                value={editingItem?.composicao || ''}
                onChange={(e) => handleFieldChange('composicao', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleSaveModal} variant="contained" sx={{ bgcolor: '#f59e0b', color: 'white' }}>
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
          <DialogContentText>
            Tem certeza que deseja remover este manejo? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="inherit">Cancelar</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Secao10MUI;