// src/types/QueueTypes.ts

export type QueueStatus = 
  | 'pending' 
  | 'processing' 
  | 'ai_pending' 
  | 'ai_processing' 
  | 'done' 
  | 'failed';

export interface QueueJob {
  id: string;
  msg_id: string;
  from_phone: string;
  raw_payload: any;
  body_text: string | null;
  respond_audio: boolean;
  status: QueueStatus;
  attempt_count: number;
  max_attempts: number;
  error_msg: string | null;
  created_at: string;
  claimed_at: string | null;
  processed_at: string | null;
  next_retry_at: string;
}

export interface QueueMonitorSummary {
  status: QueueStatus;
  total: number;
  avg_attempts: number;
  oldest_job: string;
  newest_job: string;
}

export const STATUS_CONFIG: Record<QueueStatus, { label: string; colorClass: string; bgClass: string; borderClass: string }> = {
  pending: {
    label: 'Pendente',
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-100'
  },
  ai_pending: {
    label: 'IA Pendente',
    colorClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-100'
  },
  processing: {
    label: 'Processando',
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-100'
  },
  ai_processing: {
    label: 'IA Processando',
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-100'
  },
  done: {
    label: 'Concluído',
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-100'
  },
  failed: {
    label: 'Falhou',
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-100'
  }
};
