import React from 'react';
import {
  Tractor, Scale, Flower2, FlaskConical, Package, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HarvestSummary } from '../../services/dashboardService';
import { formatDateBR } from '../../utils/formatters';

const formatUnit = (unit: string | undefined): string => {
  if (!unit) return '';
  const u = unit.trim().toUpperCase();
  switch (u) {
    case 'UNIDADE':
    case 'UNIDADES':
      return 'UNID';
    case 'QUILOGRAMA':
    case 'QUILOGRAMAS':
    case 'QUILO':
    case 'QUILOS':
      return 'KG';
    case 'LITRO':
    case 'LITROS':
      return 'L';
    case 'TONELADA':
    case 'TONELADAS':
      return 'TON';
    default:
      return u;
  }
};

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
  onEditRecord?: (record: any) => void;
}

const HarvestDashboard: React.FC<HarvestDashboardProps> = ({ harvestStats, recentActivity, onEditRecord }) => {
  const navigate = useNavigate();

  return (
    <div className="flex-grow p-2 bg-white rounded-lg shadow">
      <h6 className="mb-3 font-black text-[#1A3C34] tracking-tight flex items-center gap-2">
        <Tractor className="w-5 h-5 inline-block align-middle" />
        Monitoramento de Colheita
      </h6>

      {/* Carousel de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6 pb-2 mb-6">
        {Object.entries(harvestStats).length === 0 ? (
          <div className="col-span-full px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl">
            Nenhuma atividade de colheita registrada recentemente.
          </div>
        ) : (
          Object.entries(harvestStats).map(([key, dados]) => (
            <div
              key={key}
              className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-start group min-h-48"
            >
              <div
                className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: '#E8F5E9', color: '#1B5E20' }}
              >
                <Scale className="w-6 h-6" />
              </div>
              <div className="w-full min-w-0">
                <div className="flex items-baseline gap-1.5 mb-1 flex-nowrap min-w-0">
                  <span className="text-3xl font-black text-slate-900 tracking-tight leading-none shrink-0">
                    {dados.total.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide leading-none truncate min-w-0">
                    {formatUnit(dados.unidade)}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-700 capitalize line-clamp-2 break-words">
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
            <h6 className="text-slate-950 font-black uppercase tracking-widest text-xs">
              Últimas Atividades
            </h6>
            <button
              type="button"
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => navigate('/caderno')}
            >
              Ver tudo
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {(recentActivity || []).slice(0, 5).map((row) => {
              const cfg = getActivityConfig(row.tipo_atividade || row.tipo);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onEditRecord?.(row)}
                  className="p-3 lg:p-4 rounded-2xl border border-transparent hover:border-slate-100 flex items-center gap-4 transition-all hover:bg-slate-50 hover:shadow-sm cursor-pointer group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: cfg.bgcolor, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-base font-black text-slate-950 leading-tight">{cfg.label}</p>
                    <p className="text-sm text-slate-700 font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.produto}
                      {row.talhao_canteiro && (
                        <span className="text-slate-600">{' • '}{row.talhao_canteiro}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                      style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                    >
                      {formatDateBR(row.data_registro, { day: '2-digit', month: 'short' }).replace('.', '')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default HarvestDashboard;