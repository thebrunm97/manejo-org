// src/components/admin/GuardrailsDashboardTab.tsx
// AI Guardrails Security Telemetry Dashboard — Forest & Gold Design System
// Displays real-time KPIs from guardrail_events (input/output blocks) and hitl_pending.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Fingerprint,
  Clock,
  RefreshCcw,
  Loader2,
  AlertTriangle,
  UserCheck,
  Zap,
  Activity,
} from 'lucide-react';
import { guardrailService } from '../../services/guardrailService';
import type {
  GuardrailSummaryKpi,
  GuardrailRecentBlock,
  HITLPendingItem,
} from '../../types/GuardrailTypes';
import { cn } from '../../utils/cn';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const layerLabel: Record<string, string> = {
  input: 'Entrada',
  tool: 'Ferramenta',
  output: 'Saída',
};

const layerColor: Record<string, string> = {
  input: 'text-amber-600',
  tool: 'text-indigo-600',
  output: 'text-rose-600',
};

const layerBg: Record<string, string> = {
  input: 'bg-amber-50 border-amber-100',
  tool: 'bg-indigo-50 border-indigo-100',
  output: 'bg-rose-50 border-rose-100',
};

function riskColor(score: number): string {
  if (score >= 0.8) return 'text-rose-500';
  if (score >= 0.5) return 'text-amber-500';
  return 'text-emerald-500';
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'gold' | 'emerald' | 'rose' | 'amber';
  pulse?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, sublabel, accent = 'gold', pulse }) => {
  const accentMap = {
    gold: {
      icon: 'bg-agro-floresta text-agro-ouro shadow-agro-floresta/10',
      border: 'border-agro-ouro/15',
      glow: 'hover:shadow-agro-ouro/10',
      value: 'text-agro-floresta',
    },
    emerald: {
      icon: 'bg-emerald-600 text-white shadow-emerald-600/10',
      border: 'border-emerald-100',
      glow: 'hover:shadow-emerald-400/10',
      value: 'text-emerald-700',
    },
    rose: {
      icon: 'bg-rose-600 text-white shadow-rose-600/10',
      border: 'border-rose-100',
      glow: 'hover:shadow-rose-400/10',
      value: 'text-rose-700',
    },
    amber: {
      icon: 'bg-amber-500 text-white shadow-amber-500/10',
      border: 'border-amber-100',
      glow: 'hover:shadow-amber-400/10',
      value: 'text-amber-700',
    },
  };

  const style = accentMap[accent];

  return (
    <div className={cn(
      'relative p-6 rounded-[2.25rem] border bg-white/80 backdrop-blur-sm shadow-sm',
      'transition-all duration-500 hover:shadow-xl hover:scale-[1.02] group overflow-hidden',
      style.border, style.glow,
    )}>
      {/* Background texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-agro-creme/30 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className={cn('p-3 rounded-2xl shadow-lg', style.icon)}>
          {icon}
        </div>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
      </div>

      <div className="relative mt-5">
        <div className={cn('text-4xl font-black tracking-tighter tabular-nums font-sans', style.value)}>
          {value}
        </div>
        <div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-agro-floresta/50">
          {label}
        </div>
        {sublabel && (
          <div className="mt-1 text-[10px] font-bold text-agro-floresta/30 uppercase tracking-widest">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Recent Blocks Feed ───────────────────────────────────────────────────────

const BlockFeed: React.FC<{ blocks: GuardrailRecentBlock[]; loading: boolean }> = ({ blocks, loading }) => (
  <div className="bg-white rounded-[2.5rem] border border-agro-ouro/10 shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 p-8 border-b border-agro-ouro/10 bg-agro-creme/30">
      <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-600/10">
        <ShieldAlert size={18} />
      </div>
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-agro-floresta">
          Bloqueios Recentes
        </h3>
        <p className="text-[10px] font-bold text-agro-floresta/40 mt-0.5 uppercase tracking-widest">
          Últimas ameaças interceptadas em tempo real
        </p>
      </div>
    </div>

    <div className="divide-y divide-agro-ouro/5">
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-agro-ouro" />
        </div>
      )}
      {!loading && blocks.length === 0 && (
        <div className="py-20 text-center text-agro-floresta/20 font-serif italic text-lg">
          Nenhum bloqueio registrado. O sistema está seguro. 🛡️
        </div>
      )}
      {!loading && blocks.map((b) => (
        <div key={b.id} className="px-8 py-5 hover:bg-agro-creme/30 transition-colors group">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 p-2 rounded-xl bg-rose-50 border border-rose-100 shrink-0">
                <ShieldAlert size={14} className="text-rose-500" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={cn(
                    'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border',
                    layerBg[b.layer] || 'bg-gray-50 border-gray-100',
                    layerColor[b.layer] || 'text-gray-600',
                  )}>
                    {layerLabel[b.layer] || b.layer}
                  </span>
                  <span className="text-[10px] font-black text-agro-floresta/40 uppercase tracking-wider font-mono">
                    {b.filter_name}
                  </span>
                </div>
                {b.reason && (
                  <p className="text-xs font-bold text-agro-floresta/70 truncate">{b.reason}</p>
                )}
                {b.violations?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {b.violations.slice(0, 3).map((v, i) => (
                      <span key={i} className="text-[9px] font-bold px-2 py-0.5 bg-agro-floresta/5 text-agro-floresta/50 rounded-lg border border-agro-ouro/10">
                        {v.rule}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className={cn('text-sm font-black tabular-nums', riskColor(b.risk_score))}>
                {fmtPct(b.risk_score * 100)}
              </div>
              <div className="text-[9px] font-bold text-agro-floresta/30 uppercase tracking-widest mt-0.5">
                risco
              </div>
              <div className="text-[10px] font-bold text-agro-floresta/30 mt-2">
                {fmtDate(b.created_at)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── HITL Pending Panel ───────────────────────────────────────────────────────

const HITLPanel: React.FC<{ items: HITLPendingItem[]; loading: boolean }> = ({ items, loading }) => (
  <div className="bg-white rounded-[2.5rem] border border-agro-ouro/10 shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 p-8 border-b border-agro-ouro/10 bg-agro-creme/30">
      <div className="p-2.5 bg-agro-floresta text-agro-ouro rounded-xl shadow-lg shadow-agro-floresta/10">
        <UserCheck size={18} />
      </div>
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-agro-floresta">
          Aprovações Pendentes (HITL)
        </h3>
        <p className="text-[10px] font-bold text-agro-floresta/40 mt-0.5 uppercase tracking-widest">
          Operações aguardando confirmação do produtor
        </p>
      </div>
      {items.length > 0 && (
        <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-xl border border-amber-200 uppercase tracking-widest">
          {items.length} pendente{items.length > 1 ? 's' : ''}
        </span>
      )}
    </div>

    <div className="divide-y divide-agro-ouro/5">
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-agro-ouro" />
        </div>
      )}
      {!loading && items.length === 0 && (
        <div className="py-20 text-center text-agro-floresta/20 font-serif italic text-lg">
          Nenhuma aprovação pendente no momento. ✅
        </div>
      )}
      {!loading && items.map((item) => {
        const isExpiringSoon = item.seconds_until_expiry < 120;
        return (
          <div key={item.id} className={cn(
            'px-8 py-5 hover:bg-agro-creme/30 transition-colors',
            isExpiringSoon && 'bg-amber-50/50',
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn(
                  'mt-0.5 p-2 rounded-xl shrink-0 border',
                  isExpiringSoon
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-agro-creme/50 border-agro-ouro/15',
                )}>
                  <Clock size={14} className={isExpiringSoon ? 'text-amber-500' : 'text-agro-floresta/40'} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-agro-floresta truncate">{item.action_label}</p>
                  <p className="text-[10px] font-bold text-agro-floresta/40 font-mono mt-0.5">{item.tool_name}</p>
                  <p className="text-[10px] font-bold text-agro-floresta/30 mt-1">{item.from_phone}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                {isExpiringSoon ? (
                  <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                    <AlertTriangle size={11} />
                    Expira em {item.seconds_until_expiry}s
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-agro-floresta/30">
                    {Math.floor(item.seconds_until_expiry / 60)}min restantes
                  </div>
                )}
                <div className="text-[9px] font-bold text-agro-floresta/20 mt-1">
                  {fmtDate(item.created_at)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const GuardrailsDashboardTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<GuardrailSummaryKpi>({
    inputBlocksLast24h: 0,
    outputBlocksLast24h: 0,
    hitlPendingCount: 0,
    hitlApprovalRate: 0,
  });
  const [blocks, setBlocks] = useState<GuardrailRecentBlock[]>([]);
  const [hitlItems, setHitlItems] = useState<HITLPendingItem[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, recentBlocks, pending] = await Promise.all([
        guardrailService.getGuardrailSummary(),
        guardrailService.getRecentBlocks(20),
        guardrailService.getPendingHITL(),
      ]);
      setKpi(summary);
      setBlocks(recentBlocks);
      setHitlItems(pending);
    } catch (err) {
      console.error('[GuardrailsDashboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 30s — HITL items may expire
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-agro-floresta text-agro-ouro rounded-2xl shadow-xl shadow-agro-floresta/10">
            <Shield size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-agro-floresta tracking-tight">
              Zero Trust AI — Guardrails
            </h2>
            <p className="text-[10px] font-bold text-agro-floresta/40 uppercase tracking-[0.18em] mt-0.5">
              Blindagem Corporativa · Telemetria em Tempo Real
            </p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          aria-label="Atualizar telemetria de segurança"
          className="group flex items-center gap-2.5 px-6 py-3 bg-agro-floresta hover:ring-2 hover:ring-agro-ouro hover:ring-offset-2 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none text-sm"
        >
          {loading
            ? <Loader2 size={16} className="animate-spin text-agro-ouro" />
            : <RefreshCcw size={16} className="text-agro-ouro group-hover:rotate-180 transition-transform duration-700" />}
          <span>{loading ? 'Atualizando…' : 'Atualizar'}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          icon={<Fingerprint size={20} />}
          label="Ataques de Entrada Bloqueados"
          sublabel="Últimas 24 horas"
          value={kpi.inputBlocksLast24h}
          accent="rose"
        />
        <KpiCard
          icon={<ShieldAlert size={20} />}
          label="Saídas Filtradas pelo Judge"
          sublabel="Últimas 24 horas"
          value={kpi.outputBlocksLast24h}
          accent="amber"
        />
        <KpiCard
          icon={<UserCheck size={20} />}
          label="Aprovações HITL Pendentes"
          sublabel="Aguardando confirmação"
          value={kpi.hitlPendingCount}
          accent={kpi.hitlPendingCount > 0 ? 'amber' : 'gold'}
          pulse={kpi.hitlPendingCount > 0}
        />
        <KpiCard
          icon={<Zap size={20} />}
          label="Taxa de Aprovação HITL"
          sublabel="Últimos 30 dias"
          value={`${kpi.hitlApprovalRate}%`}
          accent="emerald"
        />
      </div>

      {/* Status bar: live indicators */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-agro-floresta/[0.03] border border-agro-ouro/10 rounded-2xl">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-agro-floresta/50">
          <Activity size={12} className="text-emerald-500" />
          Sistema Ativo
        </div>
        <div className="w-px h-4 bg-agro-ouro/10" />
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-agro-floresta/40">
          <ShieldCheck size={12} className="text-agro-ouro" />
          PII Scrubber — Layer 1
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-agro-floresta/40">
          <ShieldCheck size={12} className="text-agro-ouro" />
          Injection Detector — Layer 2
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-agro-floresta/40">
          <ShieldCheck size={12} className="text-agro-ouro" />
          Output Judge (Gemini) — Layer 3
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-agro-floresta/40">
          <ShieldCheck size={12} className="text-agro-ouro" />
          HITL Controller — Layer 4
        </div>
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <BlockFeed blocks={blocks} loading={loading} />
        <HITLPanel items={hitlItems} loading={loading} />
      </div>

    </div>
  );
};

export default GuardrailsDashboardTab;
