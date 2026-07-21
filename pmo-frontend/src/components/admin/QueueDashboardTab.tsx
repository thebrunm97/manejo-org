// src/components/admin/QueueDashboardTab.tsx

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  RefreshCcw, 
  Eye, 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Timer,
  Loader2,
  Search,
  Activity
} from 'lucide-react';
import { queueService } from '../../services/queueService';
import { QueueJob, QueueMonitorSummary, STATUS_CONFIG } from '../../types/QueueTypes';
import { cn } from '../../utils/cn';
import JobDetailsDialog from './JobDetailsDialog';

const QueueDashboardTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<QueueMonitorSummary[]>([]);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, jobsData] = await Promise.all([
        queueService.getQueueMonitorSummary(),
        queueService.getRecentJobs(50)
      ]);
      setSummary(summaryData);
      setJobs(jobsData);
    } catch (err) {
      console.error('Error refreshing queue data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRestart = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRestartingId(id);
    try {
      await queueService.restartJob(id);
      await fetchData(); // Refresh immediately
    } catch (err) {
      alert('Erro ao reiniciar job. Verifique os logs.');
    } finally {
      setRestartingId(null);
    }
  };

  const handleOpenDetails = (job: QueueJob) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  // Helper to find summary by status
  const getCountByStatus = (status: string) => {
    return summary.find(s => s.status === status)?.total || 0;
  };

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobs;
    const lowTerm = searchTerm.toLowerCase();
    return jobs.filter(job => 
        job.msg_id?.toLowerCase().includes(lowTerm) || 
        job.from_phone?.toLowerCase().includes(lowTerm) ||
        job.status?.toLowerCase().includes(lowTerm)
    );
  }, [jobs, searchTerm]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* 1. Summary Grid: Premium Operational KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => {
          const config = STATUS_CONFIG[status];
          const count = getCountByStatus(status);
          
          return (
            <div 
              key={status}
              className={cn(
                "p-5 rounded-[2.25rem] border bg-white shadow-sm transition-all hover:shadow-xl hover:scale-[1.03] duration-500 flex flex-col justify-between group h-32",
                config.borderClass.replace('border-', 'border-') || "border-agro-ouro/10"
              )}
            >
              <div className="flex justify-between items-start">
                  <span className={cn("text-[9px] font-black uppercase tracking-[0.15em] font-sans px-2.5 py-1 rounded-lg", config.bgClass, config.colorClass)}>
                    {config.label}
                  </span>
                  <div className={cn("opacity-20 group-hover:opacity-100 transition-opacity duration-500", config.colorClass)}>
                      <Activity size={12} />
                  </div>
              </div>
              <span className="text-4xl font-black text-agro-floresta font-sans tracking-tighter tabular-nums mb-1">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* 2. Controls: Search & Refresh */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-agro-floresta/30 group-focus-within:text-agro-ouro transition-colors" size={18} />
              <input
                  type="text"
                  placeholder="Localizar registro na fila…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-agro-ouro/10 rounded-2xl text-sm font-bold text-agro-floresta placeholder:text-agro-floresta/20 focus:outline-none focus:ring-2 focus:ring-agro-ouro/30 focus:border-agro-ouro/50 transition-all shadow-sm"
              />
          </div>

          <button 
            onClick={fetchData}
            disabled={loading}
            aria-label="Sincronizar dados da fila"
            className="group relative flex items-center gap-3 px-8 py-3.5 bg-agro-floresta hover:ring-2 hover:ring-agro-ouro hover:ring-offset-2 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95 overflow-hidden focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none w-full md:w-fit"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {loading ? <Loader2 size={18} className="animate-spin text-agro-ouro" /> : <RefreshCcw size={18} className="text-agro-ouro group-hover:rotate-180 transition-transform duration-700" />}
            <span className="relative">{loading ? 'Sincronizando…' : 'Sincronizar Fila'}</span>
          </button>
      </div>

      {/* 3. Main Operational Table */}
      <div className="bg-white rounded-[2.5rem] border border-agro-ouro/10 shadow-sm overflow-hidden min-h-[450px]">
        <div className="flex items-center justify-between p-8 border-b border-agro-ouro/10 bg-agro-creme/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-agro-floresta text-agro-ouro rounded-xl shadow-lg shadow-agro-floresta/10">
              <Timer size={18} />
            </div>
            <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-agro-floresta">
                Orquestração em Tempo Real
                </h3>
                <p className="text-[10px] font-bold text-agro-floresta/40 mt-0.5 uppercase tracking-widest">Capacidade Úlima: 50 Registros</p>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-agro-creme/10">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50">Ref / Msg ID</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50">Data de Entrada</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50">Origem</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50">Status Operacional</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50">Ciclos / Max</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-agro-ouro/5">
              {filteredJobs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center text-agro-floresta/20 font-serif italic text-lg animate-in fade-in duration-1000">
                    {searchTerm ? 'Nenhum registro de fila corresponde à busca.' : 'O sinal de fila está limpo. Nenhum registro nas últimas 24h.'}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-agro-creme/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white text-agro-floresta/20 rounded-xl group-hover:bg-agro-floresta group-hover:text-agro-ouro transition-all shadow-sm border border-agro-ouro/5">
                          <Database size={14} />
                        </div>
                        <span className="text-[11px] font-black text-agro-floresta font-mono tracking-tighter truncate max-w-[140px] opacity-80" title={job.msg_id}>
                          {job.msg_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-agro-floresta">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(job.created_at))}
                      </div>
                      <div className="text-[10px] font-black text-agro-floresta/30 uppercase tracking-[0.2em] mt-0.5">
                        {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(job.created_at))}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-agro-floresta/60">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        </div>
                        <span className="tabular-nums tracking-wider">{job.from_phone}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm backdrop-blur-sm",
                        STATUS_CONFIG[job.status].bgClass,
                        STATUS_CONFIG[job.status].colorClass,
                        STATUS_CONFIG[job.status].borderClass
                      )}>
                        {job.status === 'done' ? <CheckCircle2 size={12} /> : job.status === 'failed' ? <XCircle size={12} /> : <AlertCircle size={12} />}
                        {STATUS_CONFIG[job.status].label}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-agro-floresta tabular-nums">
                            {job.attempt_count}
                          </span>
                          <span className="text-[10px] font-black text-agro-floresta/20">/</span>
                          <span className="text-[11px] font-black text-agro-floresta/30 tabular-nums">
                            {job.max_attempts}
                          </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => handleOpenDetails(job)}
                          aria-label="Ver detalhes operacionais"
                          className="p-3 text-agro-floresta/40 hover:text-agro-floresta bg-white hover:bg-white rounded-2xl border border-agro-ouro/10 shadow-sm transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none"
                          title="Detalhes do Job"
                        >
                          <Eye size={18} />
                        </button>
                        {(job.status === 'failed' || job.status === 'processing' || job.status === 'ai_processing') && (
                          <button 
                            onClick={(e) => handleRestart(job.id, e)}
                            disabled={restartingId === job.id}
                            aria-label="Reiniciar orquestração do job"
                            className={cn(
                              "p-3 text-agro-ouro bg-agro-ouro/10 hover:bg-agro-ouro/20 rounded-2xl border border-agro-ouro/20 shadow-sm transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none",
                              restartingId === job.id && "animate-spin cursor-not-allowed"
                            )}
                            title="Reiniciar Orquestração"
                          >
                            {restartingId === job.id ? <Loader2 size={18} /> : <RefreshCcw size={18} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <JobDetailsDialog 
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        job={selectedJob}
      />
    </div>
  );
};

export default QueueDashboardTab;
