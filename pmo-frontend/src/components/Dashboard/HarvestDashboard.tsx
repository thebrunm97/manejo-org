import React from 'react';
import {
  Tractor, Scale, Flower2, FlaskConical, Package, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HarvestSummary } from '../../services/dashboardService';
import { formatDateBR } from '../../utils/formatters';

// --- Activity type → visual config ---
const getActivityConfig = (tipo: string | undefined) => {
  switch ((tipo || '').toLowerCase()) {
    case 'plantio':
      return { label: 'Plantio', icon: <Flower2 className="w-5 h-5" />, bgcolor: '#E8F5E9', color: '#1B5E20' };
    case 'manejo':
      return { label: 'Manejo', icon: <FlaskConical className="w-5 h-5" />, bgcolor: '#E3F2FD', color: '#0D47A1' };
    case 'colheita':
      return { label: 'Colheita', icon: <Tractor className="w-5 h-5" />, bgcolor: '#FFF3E0', color: '#E65100' };
    case 'insumo':
      return { label: 'Insumo', icon: <Package className="w-5 h-5" />, bgcolor: '#F3E5F5', color: '#6A1B9A' };
    default:
      return { label: tipo || 'Outro', icon: <FileText className="w-5 h-5" />, bgcolor: '#F1F5F9', color: '#475569' };
  }
};

interface HarvestDashboardProps {
  harvestStats: HarvestSummary;
  recentActivity: any[]; // MVP: mantendo flexibilidade, mas idealmente criar tipo
}

const HarvestDashboard: React.FC<HarvestDashboardProps> = ({ harvestStats, recentActivity }) => {
  const navigate = useNavigate();

  return (
    <div className="flex-grow p-2 bg-white rounded-lg shadow">
      <h6 className="mb-3 font-extrabold text-[#1b5e20] tracking-tight flex items-center gap-1">
        <Tractor className="w-5 h-5 inline-block align-middle" />
        Monitoramento de Colheita
      </h6>

      {/* Carousel de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 pb-2 mb-4">
        {Object.entries(harvestStats).length === 0 ? (
          <div className="w-full px-4 py-3 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-xl">
            Nenhuma colheita registrada neste plano ainda.
          </div>
        ) : (
          Object.entries(harvestStats).map(([key, dados]) => (
            <div
              key={key}
              className="border border-gray-100 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-2.5 flex flex-col justify-between items-start transition-transform hover:-translate-y-1"
              style={{ aspectRatio: '1 / 0.9' }}
            >
              <div
                className="w-12 h-12 rounded-xl mb-1 flex items-center justify-center"
                style={{ backgroundColor: '#E8F5E9', color: '#1B5E20' }}
              >
                <Scale className="w-5 h-5" />
              </div>
              <div className="w-full">
                <p className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none mb-0.5">
                  {dados.total.toLocaleString('pt-BR')}
                  <span className="text-sm font-semibold text-slate-400 ml-0.5">
                    {dados.unidade}
                  </span>
                </p>
                <p className="text-sm font-semibold text-slate-500 capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                  {dados.produto.toLowerCase()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lista de Atividades */}
      {(recentActivity || []).length > 0 && (
        <>
          <div className="flex justify-between items-center mt-4 mb-3">
            <h6 className="text-slate-900 font-extrabold">
              Últimas Atividades
            </h6>
            <button
              type="button"
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded transition-colors"
              onClick={() => navigate('/caderno')}
            >
              Ver tudo
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {(recentActivity || []).slice(0, 5).map((row) => {
              const cfg = getActivityConfig(row.tipo_atividade || row.tipo);
              return (
                <div
                  key={row.id}
                  className="p-2 rounded-2xl border border-gray-100 flex items-center gap-2 transition-colors hover:bg-slate-50"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cfg.bgcolor, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-base font-bold text-slate-900 leading-tight">{cfg.label}</p>
                    <p className="text-sm text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.produto}
                      {row.talhao_canteiro && (
                        <span className="text-slate-400">{' • '}{row.talhao_canteiro}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: '#F1F5F9', color: '#475569', height: 24 }}
                    >
                      {formatDateBR(row.data_registro, { day: '2-digit', month: 'short' }).replace('.', '')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default HarvestDashboard;