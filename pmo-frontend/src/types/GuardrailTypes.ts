// src/types/GuardrailTypes.ts
// Type contracts for the AI Guardrails security telemetry dashboard.

export type GuardrailLayer = 'input' | 'tool' | 'output';

export interface GuardrailKpiHourly {
  layer: GuardrailLayer;
  filter_name: string;
  hour_bucket: string;
  total_events: number;
  blocked_count: number;
  block_rate_pct: number;
  avg_risk_score: number;
}

export interface GuardrailRecentBlock {
  id: string;
  created_at: string;
  layer: GuardrailLayer;
  filter_name: string;
  phone: string | null;
  job_id: string | null;
  risk_score: number;
  reason: string | null;
  violations: Array<{
    rule: string;
    severity: string;
    match?: string;
    confidence: number;
  }>;
}

export interface HITLPendingItem {
  id: string;
  created_at: string;
  expires_at: string;
  from_phone: string;
  tool_name: string;
  action_label: string;
  status: 'waiting' | 'approved' | 'rejected' | 'expired';
  seconds_until_expiry: number;
}

// Aggregated KPIs for the three dashboard cards
export interface GuardrailSummaryKpi {
  inputBlocksLast24h: number;
  outputBlocksLast24h: number;
  hitlPendingCount: number;
  hitlApprovalRate: number; // 0–100 %
}
