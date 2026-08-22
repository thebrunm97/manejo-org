// src/services/queueService.ts

import { supabase } from '../supabaseClient';
import { QueueJob, QueueMonitorSummary } from '../types/QueueTypes';

/**
 * Fetches the operational snapshot of the queue from the message_queue_monitor view.
 */
export const getQueueMonitorSummary = async (): Promise<QueueMonitorSummary[]> => {
  const { data, error } = await supabase
    .from('message_queue_monitor')
    .select('*');

  if (error) {
    console.error('Error fetching queue summary:', error.message);
    throw error;
  }

  return data as QueueMonitorSummary[];
};

/**
 * Fetches the most recent jobs from the message_queue table.
 */
export const getRecentJobs = async (limit: number = 50): Promise<QueueJob[]> => {
  const { data, error } = await supabase
    .from('message_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent jobs:', error.message);
    throw error;
  }

  return data as QueueJob[];
};

/**
 * Restarts a failed job by resetting its status, attempt count, and retry time.
 */
export const restartJob = async (id: string): Promise<QueueJob> => {
    const { data, error } = await supabase.rpc('restart_queue_job', { p_id: id });

  if (error) {
    console.error(`Error restarting job ${id}:`, error.message);
    throw error;
  }

  return data as QueueJob;
};

export const queueService = {
  getQueueMonitorSummary,
  getRecentJobs,
  restartJob
};
