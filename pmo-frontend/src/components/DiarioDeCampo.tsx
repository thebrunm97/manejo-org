import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';

// --- IMPORTS CRÍTICOS ---
import { CadernoCampoRecord, ActivityType } from '../types/CadernoTypes';
import { cadernoService } from '../services/cadernoService';

// --- CUSTOM HOOK ---
import { useFieldDiary } from '../hooks/useFieldDiary';

// --- COMPONENTES FILHOS ---
import ManualRecordDialog from './Dashboard/ManualRecordDialog';
import RecordDetailsDialog from './Dashboard/RecordDetailsDialog';
import FieldDiaryTableV2 from './FieldDiaryTableV2';
import QRCodeModal from './Traceability/QRCodeModal';

const DiarioDeCampo: React.FC = () => {
    const [searchParams] = useSearchParams();
    const queryPmoId = searchParams.get('pmoId');
    
    // Prioridade: Apenas Query Param. Se não tiver, undefined para buscar via propriedade
    const internalPmoId = queryPmoId ? Number(queryPmoId) : undefined;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<CadernoCampoRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Estados de Dialog
  const [openManualDialog, setOpenManualDialog] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<CadernoCampoRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CadernoCampoRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Estados de Rastreabilidade
  const [showQRModal, setShowQRModal] = useState(false);
  const [loteGerado, setLoteGerado] = useState<{ id: string, cultura: string } | null>(null);


  const { currentPropriedade } = useAuth();
  // 2. Use Custom Hook for Logic
  const {
    logs, totalLogs, loading, error,
    filters, setFilters,
    page, rowsPerPage, setPage, setRowsPerPage,
    refresh
  } = useFieldDiary(internalPmoId, currentPropriedade?.id);

  // --- ACTIONS HANDLERS ---
  const handleOpenDetails = (reg: CadernoCampoRecord) => { setSelectedRecord(reg); setDetailsOpen(true); };
  const handleEditRecord = (reg: CadernoCampoRecord) => { setRecordToEdit(reg); setOpenManualDialog(true); };
  const handleCloseManualDialog = () => { setOpenManualDialog(false); setTimeout(() => setRecordToEdit(null), 200); };
  const handleDeleteClick = (reg: CadernoCampoRecord) => { setRecordToDelete(reg); setDeleteReason(''); setDeleteDialogOpen(true); };

  const handleGerarRastreabilidade = (reg: CadernoCampoRecord) => {
      setLoteGerado({
          id: reg.id,
          cultura: reg.produto || 'Produto'
      });
      setShowQRModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !deleteReason.trim()) return;
    try {
      const originalObs = recordToDelete.observacao_original || '';
      const cancelObs = `[CANCELADO em ${new Date().toLocaleDateString()}] Motivo: ${deleteReason} | Obs Original: ${originalObs}`;
      await cadernoService.updateRegistro(recordToDelete.id, { tipo_atividade: ActivityType.CANCELADO, observacao_original: cancelObs });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      await refresh();
    } catch (error: any) {
      console.error('Erro ao cancelar registro:', error);
      alert(`Erro ao cancelar: ${error.message}`);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden flex flex-col gap-3 mt-3 mb-10">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <FieldDiaryTableV2
        registros={logs}
        totalCount={totalLogs}
        loading={loading}
        filtrosAtivos={filters}
        onChangeFiltros={setFilters}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_e, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        onVisualizar={handleOpenDetails}
        onEditar={handleEditRecord}
        onExcluir={handleDeleteClick}
        onAtualizar={refresh}
        onNovoRegistro={() => { setRecordToEdit(null); setOpenManualDialog(true); }}
        onGerarRastreabilidade={handleGerarRastreabilidade}
      />

      {/* DIALOGS */}
      <ManualRecordDialog
        open={openManualDialog}
        onClose={handleCloseManualDialog}
        recordToEdit={recordToEdit}
        onRecordSaved={() => refresh()}
      />

      <RecordDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        record={selectedRecord}
      />

      {loteGerado && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          publicUrl={`${window.location.origin}/t/${loteGerado.id}`}
          codigoLote={loteGerado.id.split('-').shift() || loteGerado.id}
          cultura={loteGerado.cultura}
        />
      )}

      {/* DIALOG DE CONFIRMAÇÃO DE CANCELAMENTO */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Cancelar Registro?</h3>
              <button type="button" onClick={() => setDeleteDialogOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-3">
                Esta ação marcará o registro como CANCELADO. Ele continuará visível no histórico para fins de auditoria, mas não será mais contabilizado.
              </p>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo do Cancelamento</label>
              <textarea
                autoFocus
                placeholder="Ex: Erro de digitação, registro duplicado..."
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className={`w-full border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-y ${!deleteReason.trim() ? 'border-red-300' : 'border-gray-300'}`}
              />
              {!deleteReason.trim() && <p className="text-xs text-red-500 mt-1">O motivo é obrigatório</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Voltar</button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!deleteReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiarioDeCampo;
