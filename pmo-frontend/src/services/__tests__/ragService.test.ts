import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { uploadKnowledgePDF } from '../ragService';

vi.mock('axios');

describe('ragService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should upload a knowledge PDF with pmoId', async () => {
        const mockResponse = { data: { success: true, job_id: '123' } };
        vi.mocked(axios.post).mockResolvedValue(mockResponse);

        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
        const pmoId = 1;

        const result = await uploadKnowledgePDF(file, pmoId);

        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('/knowledge/upload'),
            expect.any(FormData),
            expect.objectContaining({
                params: { token: expect.any(String) }
            })
        );

        // Check if FormData has correct fields
        const callArgs = vi.mocked(axios.post).mock.calls[0];
        const sentFormData = callArgs[1] as FormData;
        expect(sentFormData.get('file')).toBeDefined();
        expect(sentFormData.get('pmo_id')).toBe('1');

        expect(result).toEqual(mockResponse.data);
    });

    it('should upload without pmoId', async () => {
        const mockResponse = { data: { success: true } };
        vi.mocked(axios.post).mockResolvedValue(mockResponse);

        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });

        await uploadKnowledgePDF(file);

        const callArgs = vi.mocked(axios.post).mock.calls[0];
        const sentFormData = callArgs[1] as FormData;
        expect(sentFormData.get('pmo_id')).toBeNull();
    });

    it('should propagate axios errors', async () => {
        vi.mocked(axios.post).mockRejectedValue(new Error('Network Error'));

        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });

        await expect(uploadKnowledgePDF(file)).rejects.toThrow('Network Error');
    });
});
