// src/components/admin/JobDetailsDialog.tsx

import React, { useState } from 'react';
import { X, Database, AlertCircle, Clock, Copy, Check, Info } from 'lucide-react';
import { QueueJob } from '../../types/QueueTypes';
import { cn } from '../../utils/cn';

interface JobDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  job: QueueJob | null;
}

const JobDetailsDialog: React.FC<JobDetailsDialogProps> = ({ open, onClose, job }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!job) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300",
      open ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
    )}>
      <div className="absolute inset-0 bg-agro-floresta/40 backdrop-blur-md" onClick={onClose} />

      <div className={cn(
        "relative bg-agro-creme w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col transition-all duration-500 transform border border-white/20",
        open ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-agro-ouro/10 bg-white/40 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-agro-floresta text-agro-ouro rounded-2xl shadow-inner">
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-agro-floresta uppercase tracking-tight">Detalhamento Operacional</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-black first-letter:uppercase text-agro-floresta/60 bg-white/60 border border-agro-ouro/10 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <Clock size={12} className="text-agro-ouro" />
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(job.created_at))}
                </span>
                <span className="text-[10px] font-black text-agro-floresta/20 uppercase tracking-[0.2em] font-mono">ID: {job.msg_id}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar diálogo"
            className="p-3 text-agro-floresta/40 hover:text-agro-floresta hover:bg-white/80 rounded-2xl transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none border border-transparent hover:border-agro-ouro/10"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-premium">
          {/* Error Message Section */}
          {job.error_msg && (
            <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-8 shadow-sm animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <AlertCircle size={20} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Registro de Incidente</span>
              </div>
              <p className="text-sm font-bold text-rose-900 leading-relaxed italic border-l-4 border-rose-200 pl-4 py-1">
                “{job.error_msg}”
              </p>
            </div>
          )}

          {/* Raw Payload Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-agro-floresta">
                <div className="p-1.5 bg-agro-floresta/5 rounded-lg">
                    <Info size={16} className="text-agro-ouro" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Payload de Comunicação (WhatsApp Meta)</span>
            </div>
            
            <div className="relative group/json rounded-[2rem] overflow-hidden border border-agro-floresta shadow-2xl">
                <div className="bg-[#0A100F] text-emerald-100/80 p-8 font-mono text-[11px] leading-relaxed">
                    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-agro-ouro/30">Raw Ingestion Object</span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(job.raw_payload, null, 2))}
                          aria-label="Copiar payload para área de transferência"
                          className="p-3 bg-white/5 hover:bg-white/10 text-agro-ouro rounded-xl transition-all flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-agro-ouro outline-none group"
                        >
                          {copied ? <Check size={14} className="text-emerald-400 animate-in zoom-in" /> : <Copy size={14} className="group-hover:scale-110 transition-transform" />}
                          <span className="text-[10px] font-black uppercase tracking-widest">{copied ? 'Copiado!' : 'Copiar JSON'}</span>
                        </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-all max-h-[450px] overflow-y-auto scrollbar-premium pr-6 custom-json-scrollbar">
                        {JSON.stringify(job.raw_payload || {}, null, 2)}
                    </pre>
                </div>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="bg-white/60 p-6 rounded-3xl border border-agro-ouro/10 shadow-sm flex flex-col justify-between">
              <span className="block text-[9px] text-agro-floresta/40 font-black uppercase tracking-[0.2em] mb-4">Canal de Origem</span>
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  </div>
                  <span className="text-sm font-black text-agro-floresta tracking-widest tabular-nums">{job.from_phone}</span>
              </div>
            </div>
            
            <div className="bg-white/60 p-6 rounded-3xl border border-agro-ouro/10 shadow-sm flex flex-col justify-between">
              <span className="block text-[9px] text-agro-floresta/40 font-black uppercase tracking-[0.2em] mb-4">Esforço de Orquestração</span>
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-agro-ouro/10 rounded-full flex items-center justify-center">
                      <Clock size={14} className="text-agro-ouro" />
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-agro-floresta tabular-nums">{job.attempt_count}</span>
                      <span className="text-[10px] font-black text-agro-floresta/20">/</span>
                      <span className="text-xs font-black text-agro-floresta/40 tabular-nums">{job.max_attempts} Ciclos</span>
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-agro-ouro/10 bg-white/40 flex justify-end">
          <button
            onClick={onClose}
            className="group relative px-10 py-4 bg-agro-floresta text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-agro-ouro opacity-0 group-hover:opacity-10 transition-opacity" />
            <span className="relative">Encerrar Visão</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsDialog;
