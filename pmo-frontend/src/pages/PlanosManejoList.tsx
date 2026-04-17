/**
 * @file PlanosManejoList.tsx
 * @description View para listagem de PMOs (Planos de ManejoOrg).
 *
 * ✅ REFACTORED: Toda lógica extraída para usePlanosListLogic hook.
 * ✅ Sestilo: Tailwind CSS (SaaS Moderno).
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// Hook com toda a lógica
import { usePlanosListLogic } from "../hooks/pmo/usePlanosListLogic";
import { useAuthProfile } from "../context/AuthProfileContext";

// Domain Types
import type { PmoListItem } from "../domain/pmo/pmoTypes";

// Ícones (Lucide)
import {
  Plus,
  FileText,
  CheckCircle,
  Hourglass,
  Edit,
  AlertCircle,
  Trash2,
  BookOpen,
  Power,
  FileQuestion,
  ShieldAlert,
  Settings,
} from "lucide-react";

// ==================================================================
// ||                    COMPONENTS HELPERS                        ||
// ==================================================================

const Spinner = ({
  size = "small",
  color = "border-green-600",
}: {
  size?: "small" | "medium";
  color?: string;
}) => {
  const dim = size === "small" ? "h-4 w-4" : "h-8 w-8";
  return (
    <div
      className={`animate-spin rounded-full ${dim} border-b-2 ${color}`}
    ></div>
  );
};

// ==================================================================
// ||                    CARD COMPONENT                            ||
// ==================================================================

interface PmoCardProps {
  pmo: PmoListItem;
  isActive: boolean;
  isActivating: boolean;
  isDeleting: boolean;
  onActivate: (pmoId: string) => void;
  onDelete: (pmo: PmoListItem) => void;
}

const PmoCard: React.FC<PmoCardProps> = ({
  pmo,
  isActive,
  isActivating,
  isDeleting,
  onActivate,
  onDelete,
}) => {
  const navigate = useNavigate();

  const statusConfig: Record<
    string,
    { label: string; bg: string; text: string; icon: React.ElementType }
  > = {
    RASCUNHO: {
      label: "Rascunho",
      bg: "bg-gray-100",
      text: "text-gray-700",
      icon: Edit,
    },
    CONCLUÍDO: {
      label: "Concluído",
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: Hourglass,
    },
    APROVADO: {
      label: "Aprovado",
      bg: "bg-green-50",
      text: "text-green-700",
      icon: CheckCircle,
    },
    REPROVADO: {
      label: "Reprovado",
      bg: "bg-red-50",
      text: "text-red-700",
      icon: AlertCircle,
    },
  };
  const currentStatus = statusConfig[pmo.status] || statusConfig["RASCUNHO"];
  const StatusIcon = currentStatus.icon;

  // Actions disabled
  const isBusy = isActivating || isDeleting;

  return (
    <div
      className={`
            bg-white rounded-lg border border-gray-200 p-6 shadow-sm 
            hover:shadow-md hover:-translate-y-1 transition-all duration-200 
            flex flex-col h-full min-w-0
            ${isActive ? "ring-2 ring-green-500 border-transparent shadow-[0_4px_20px_rgba(22,163,74,0.15)]" : ""}
            ${isBusy ? "opacity-70 pointer-events-none" : ""}
        `}
    >
      {/* Header: Icon + Title + Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`
                        p-2.5 rounded-lg flex-shrink-0
                        ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}
                    `}
          >
            <FileText size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-semibold text-gray-900 truncate pr-2"
              title={pmo.nome_identificador}
            >
              {pmo.nome_identificador}
            </h3>
            <p className="text-sm text-gray-500">Versão {pmo.version || "1"}</p>
          </div>
        </div>
      </div>

      {/* Badges / Info */}
      <div className="mb-4 space-y-2">
        {isActive && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            ✓ ATIVO NO ZAP
          </span>
        )}

        <div className="flex">
          <span
            className={`
                        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${currentStatus.bg} ${currentStatus.text} border-transparent
                    `}
          >
            <StatusIcon size={12} />
            {currentStatus.label}
          </span>
        </div>
      </div>

      {/* Date */}
      <div className="mt-auto">
        <p className="text-xs text-gray-400 mb-4 pt-4 border-t border-gray-100">
          Criado em: {new Date(pmo.created_at).toLocaleDateString("pt-BR")}
        </p>

        {/* Actions Footer */}
        <div className="flex items-center gap-2 pt-2">
          {/* Primary Actions */}
          <button
            onClick={() => navigate(`/pmo/${pmo.id}/editar?aba=caderno`)}
            className="p-2 text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
            title="Abrir Caderno de Campo"
            disabled={isBusy}
          >
            <BookOpen size={20} />
          </button>

          <button
            onClick={() => onActivate(pmo.id)}
            className={`p-2 rounded-lg transition-colors ${isActive
                ? "text-green-600 cursor-default"
                : "text-gray-400 hover:text-green-600 hover:bg-green-50"
              }`}
            title={isActive ? "Plano Ativo" : "Ativar no WhatsApp"}
            disabled={isActive || isBusy}
          >
            {isActivating ? <Spinner /> : <Power size={20} />}
          </button>

          <div className="flex-1"></div>

          {/* Secondary Actions */}
          <button
            onClick={() => navigate(`/pmo/${pmo.id}/editar`)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar Plano"
            disabled={isBusy}
          >
            <Edit size={20} />
          </button>

          <button
            onClick={() => onDelete(pmo)}
            className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Excluir Plano"
            disabled={isBusy}
          >
            {isDeleting ? (
              <Spinner color="border-red-600" />
            ) : (
              <Trash2 size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================================================================
// ||                    PAGE COMPONENT                            ||
// ==================================================================

const PlanosManejoList: React.FC = () => {
  const navigate = useNavigate();

  // Hook Data
  const {
    pmos,
    activePmoId,
    listLoading,
    activatingId,
    deletingId,
    handleActivatePmo,
    handleDeletePmo,
  } = usePlanosListLogic();

  const { currentPropriedade } = useAuthProfile();

  // Regra de Negócio: Ocultar para Convencional
  const isConvencional = currentPropriedade?.modalidade_predominante === 'CONVENCIONAL';

  // Local State (Modal)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pmoToDelete, setPmoToDelete] = useState<PmoListItem | null>(null);

  const handleOpenDeleteDialog = (pmo: PmoListItem) => {
    setPmoToDelete(pmo);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setPmoToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (pmoToDelete) {
      await handleDeletePmo(pmoToDelete.id);
    }
    handleCloseDeleteDialog();
  };

  // Removed early return for listLoading to allow the header to render before the skeletons

  return (
    <div className="p-4 md:p-8 min-h-full pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Gerenciar Planos
          </h1>
          <p className="text-slate-500 mt-1">
            Visualize, edite ou crie novos planos digitais.
          </p>
        </div>
        {!isConvencional && (
          <button
            onClick={() => navigate("/pmo/novo")}
            className="
                          inline-flex items-center justify-center gap-2 
                          px-4 py-2.5 rounded-lg 
                          bg-green-600 hover:bg-green-700 
                          text-white font-medium shadow-sm transition-colors
                          w-full md:w-auto
                      "
          >
            <Plus size={20} />
            Novo Plano
          </button>
        )}
      </div>

      {/* List */}
      {isConvencional ? (
        // Blocked State for Conventional
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-amber-50/30 border-2 border-dashed border-amber-200 rounded-3xl text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-amber-200">
            <ShieldAlert className="h-10 w-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Recurso Exclusivo
          </h2>
          <p className="text-slate-600 max-w-lg mx-auto leading-relaxed mb-8">
            O <strong>Plano de ManejoOrg (PMO)</strong> é uma ferramenta essencial para propriedades em transição agroecológica, certificação orgânica ou produção sustentável.
            <br />
            Sua propriedade atual está configurada na modalidade <strong>Convencional</strong>.
          </p>
          <button
            onClick={() => navigate("/propriedade/perfil")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold shadow-sm transition-all hover:shadow-md"
          >
            <Settings size={20} className="text-slate-400" />
            Configurações da Propriedade
          </button>
        </div>
      ) : listLoading ? (
        /* ---------------- SKELETON LOADER ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 w-full min-w-0 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm h-[200px] flex flex-col"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 bg-slate-300 rounded-lg flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-5 bg-slate-300 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-300 rounded w-1/4"></div>
                </div>
              </div>
              <div className="h-4 bg-slate-300 rounded w-1/3 mb-4"></div>
              <div className="mt-auto flex gap-2">
                <div className="h-8 w-8 bg-slate-300 rounded-lg"></div>
                <div className="h-8 w-8 bg-slate-300 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      ) : pmos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 w-full min-w-0">
          {pmos.map((pmo) => (
            <PmoCard
              key={pmo.id}
              pmo={pmo}
              isActive={activePmoId === pmo.id}
              isActivating={activatingId === pmo.id}
              isDeleting={deletingId === pmo.id}
              onActivate={handleActivatePmo}
              onDelete={handleOpenDeleteDialog}
            />
          ))}
        </div>
      ) : (
        // Empty State
        <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 mb-4">
            <FileQuestion className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">
            Nenhum plano encontrado
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Você ainda não tem nenhum Plano de ManejoOrg cadastrado.
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate("/pmo/novo")}
              className="inline-flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 bg-white rounded-lg hover:bg-green-50 font-medium transition-colors"
            >
              <Plus size={18} />
              Criar meu primeiro plano
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal (Native-ish Tailwind) */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir{" "}
              <strong>"{pmoToDelete?.nome_identificador}"</strong>?
              <br />
              <span className="text-sm text-red-600 mt-1 block">
                Esta ação não pode ser desfeita.
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseDeleteDialog}
                className="px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 font-medium shadow-sm transition-colors"
              >
                Excluir Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanosManejoList;
