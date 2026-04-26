// src/services/guardrailService.ts
// Data access layer for the AI Guardrails security telemetry dashboard.
// Reads from views created in migrations 005 and 006.

import { supabase } from '../supabaseClient';
import {
  GuardrailKpiHourly,
  GuardrailRecentBlock,
  HITLPendingItem,
  GuardrailSummaryKpi,
} from '../types/GuardrailTypes';

const LAST_24H = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

/**
 * Fetches aggregated hourly KPI data from the guardrail_kpi_hourly view.
 * Used to power the input/output block rate sparklines.
 */
export const getGuardrailKpis = async (): Promise<GuardrailKpiHourly[]> => {
  const { data, error } = await supabase
    .from('guardrail_kpi_hourly')
    .select('*')
    .order('hour_bucket', { ascending: false })
    .limit(48); // last 48 hours of hourly buckets

  if (error) {
    console.error('[GuardrailService] Error fetching KPIs:', error.message);
    return [];
  }
  return (data as GuardrailKpiHourly[]) ?? [];
};

/**
 * Fetches the most recent blocked events for the security feed.
 * Reads from the guardrail_recent_blocks view (last 100 blocked events).
 */
export const getRecentBlocks = async (limit = 20): Promise<GuardrailRecentBlock[]> => {
  const { data, error } = await supabase
    .from('guardrail_recent_blocks')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('[GuardrailService] Error fetching recent blocks:', error.message);
    return [];
  }
  return (data as GuardrailRecentBlock[]) ?? [];
};

/**
 * Fetches live HITL approvals waiting for producer response.
 * Reads from hitl_pending_view (only 'waiting' + not expired).
 */
export const getPendingHITL = async (): Promise<HITLPendingItem[]> => {
  const { data, error } = await supabase
    .from('hitl_pending_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GuardrailService] Error fetching HITL pending:', error.message);
    return [];
  }
  return (data as HITLPendingItem[]) ?? [];
};

/**
 * Computes the three summary KPIs for the dashboard cards.
 * Fetches in parallel for minimum latency.
 */
export const getGuardrailSummary = async (): Promise<GuardrailSummaryKpi> => {
  const [kpis, pending] = await Promise.all([
    getGuardrailKpis(),
    getPendingHITL(),
  ]);

  // Sum blocked events in the last 24h by layer
  const recentKpis = kpis.filter(k => k.hour_bucket >= LAST_24H);

  const inputBlocksLast24h = recentKpis
    .filter(k => k.layer === 'input')
    .reduce((sum, k) => sum + (k.blocked_count ?? 0), 0);

  const outputBlocksLast24h = recentKpis
    .filter(k => k.layer === 'output')
    .reduce((sum, k) => sum + (k.blocked_count ?? 0), 0);

  // HITL approval rate from the audit_summary view (last 30 days)
  const { data: auditData } = await supabase
    .from('hitl_audit_summary')
    .select('approved, rejected, total')
    .order('day', { ascending: false })
    .limit(30);

  const totals = (auditData ?? []).reduce(
    (acc, row) => ({
      approved: acc.approved + (row.approved ?? 0),
      total: acc.total + (row.total ?? 0),
    }),
    { approved: 0, total: 0 },
  );

  const hitlApprovalRate = totals.total > 0
    ? Math.round((totals.approved / totals.total) * 100)
    : 0;

  return {
    inputBlocksLast24h,
    outputBlocksLast24h,
    hitlPendingCount: pending.length,
    hitlApprovalRate,
  };
};

export const guardrailService = {
  getGuardrailKpis,
  getRecentBlocks,
  getPendingHITL,
  getGuardrailSummary,
};
