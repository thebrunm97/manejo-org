import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  Alert, Box, Button, Dialog, DialogTitle, DialogContent,
  DialogContentText, TextField, DialogActions, useTheme
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';

// --- IMPORTS CRÍTICOS ---
import { CadernoCampoRecord, ActivityType } from '../types/CadernoTypes';
import { cadernoService } from '../services/cadernoService';

// --- CUSTOM HOOK ---
import { useFieldDiary } from '../hooks/useFieldDiary';

// --- COMPONENTES FILHOS ---
import ManualRecordDialog from './Dashboard/ManualRecordDialog';
import RecordDetailsDialog from './Dashboard/RecordDetailsDialog';
import FieldDiaryTableV2 from './FieldDiaryTableV2';

interface DiarioDeCampoProps {
  pmoId?: number;
}

const DiarioDeCampo: React.FC<DiarioDeCampoProps> = ({ pmoId: propPmoId }) => {
  const auth = useAuth() as any;
  const user = auth?.user;

  const [searchParams] = useSearchParams();
  const queryPmoId = searchParams.get('pmoId');

  const [internalPmoId, setInternalPmoId] = useState<number | undefined>(propPmoId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<CadernoCampoRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Estados de Dialog
  const [openManualDialog, setOpenManualDialog] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<CadernoCampoRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CadernoCampoRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 1. Resolver PMO ID (Priority: Prop > Query > User Profile)
  useEffect(() => {
    const resolvePmo = async () => {
      if (propPmoId) {
        setInternalPmoId(propPmoId);
      } else if (queryPmoId) {
        setInternalPmoId(Number(queryPmoId));
      } else if (user) {
        try {
          const { data } = await supabase.from('profiles').select('pmo_ativo_id').eq('id', user.id).single();
          if (data?.pmo_ativo_id) setInternalPmoId(data.pmo_ativo_id);
        } catch (e) { console.error(e); }
      }
    };
    resolvePmo();
  }, [propPmoId, user, queryPmoId]);

  // 2. Use Custom Hook for Logic
  const {
    logs,
    totalLogs,
    loading,
    error,
    filters,
    setFilters,
    page,
    rowsPerPage,
    setPage,
    setRowsPerPage,
    refresh
  } = useFieldDiary(internalPmoId);

  // --- ACTIONS HANDLERS ---
  const handleOpenDetails = (reg: CadernoCampoRecord) => {
    setSelectedRecord(reg);
    setDetailsOpen(true);
  };

  const handleEditRecord = (reg: CadernoCampoRecord) => {
    setRecordToEdit(reg);
    setOpenManualDialog(true);
  };

  const handleCloseManualDialog = () => {
    setOpenManualDialog(false);
    setTimeout(() => setRecordToEdit(null), 200);
  };

  const handleDeleteClick = (reg: CadernoCampoRecord) => {
    setRecordToDelete(reg);
    setDeleteReason('');
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !deleteReason.trim()) return;

    try {
      const originalObs = recordToDelete.observacao_original || '';
      const cancelObs = `[CANCELADO em ${new Date().toLocaleDateString()}] Motivo: ${deleteReason} | Obs Original: ${originalObs}`;

      await cadernoService.updateRegistro(recordToDelete.id, {
        tipo_atividade: ActivityType.CANCELADO,
        observacao_original: cancelObs
      });

      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      await refresh(); // Put refresh on hook

    } catch (error: any) {
      console.error('Erro ao cancelar registro:', error);
      alert(`Erro ao cancelar: ${error.message}`);
    }
  };

  return (
    <Box sx={{ mt: 3, mb: 10, width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <FieldDiaryTableV2
        registros={logs}
        totalCount={totalLogs}
        loading={loading}
        filtrosAtivos={filters}
        onChangeFiltros={setFilters}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(e, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        onVisualizar={handleOpenDetails}
        onEditar={handleEditRecord}
        onExcluir={handleDeleteClick}
        onAtualizar={refresh}
        onNovoRegistro={() => {
          setRecordToEdit(null);
          setOpenManualDialog(true);
        }}
      />

      {/* DIALOGS */}
      <ManualRecordDialog
        open={openManualDialog}
        onClose={handleCloseManualDialog}
        pmoId={internalPmoId || 0}
        recordToEdit={recordToEdit}
        onRecordSaved={() => {
          refresh();
        }}
      />

      <RecordDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        record={selectedRecord}
      />

      {/* DIALOG DE CONFIRMAÇÃO DE CANCELAMENTO */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Cancelar Registro?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Esta ação marcará o registro como CANCELADO. Ele continuará visível no histórico para fins de auditoria, mas não será mais contabilizado.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Motivo do Cancelamento"
            placeholder="Ex: Erro de digitação, registro duplicado..."
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            error={!deleteReason.trim()}
            helperText={!deleteReason.trim() ? "O motivo é obrigatório" : ""}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Voltar</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={!deleteReason.trim()}
          >
            Confirmar Cancelamento
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiarioDeCampo;
