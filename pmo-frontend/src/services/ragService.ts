import axios from 'axios';

const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://localhost:8080';
const BOT_API_TOKEN = import.meta.env.VITE_BOT_API_TOKEN || '';

/**
 * Uploads a knowledge PDF to the Go bot RAG ingestion endpoint.
 * @param file The PDF file to upload.
 * @param pmoId Optional PMO ID for multi-tenant isolation.
 * @returns The job ID and status from the bot.
 */
export async function uploadKnowledgePDF(file: File, pmoId?: string | number) {
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
