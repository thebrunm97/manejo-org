import axios from 'axios';

export interface IngestionJobResult {
    status: string;
    message: string;
    file: string;
    job_id: string;
}

const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://localhost:8080';
const BOT_API_TOKEN = import.meta.env.VITE_BOT_API_TOKEN || '';

/**
 * Uploads knowledge media (PDF, Image, Audio) to the Go bot RAG ingestion endpoint.
 * @param file The media file to upload.
 * @param pmoId Optional PMO ID for multi-tenant isolation.
 * @returns The job ID and status from the bot.
 */
export async function uploadKnowledgeMedia(file: File, pmoId?: string | number): Promise<IngestionJobResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (pmoId !== undefined && pmoId !== null) {
        formData.append('pmo_id', pmoId.toString());
    }

    const response = await axios.post(`${BOT_API_URL}/knowledge/upload`, formData, {
        params: { token: BOT_API_TOKEN },
    });

    return response.data;
}

/**
 * Cancels an active ingestion job.
 */
export async function cancelIngestionJob(jobId: string) {
    const response = await axios.post(`${BOT_API_URL}/knowledge/cancel`, { job_id: jobId }, {
        params: { token: BOT_API_TOKEN },
    });
    return response.data;
}

/**
 * Retries a failed or cancelled ingestion job.
 */
export async function retryIngestionJob(jobId: string) {
    const response = await axios.post(`${BOT_API_URL}/knowledge/retry`, { job_id: jobId }, {
        params: { token: BOT_API_TOKEN },
    });
    return response.data;
}
