import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCadernoOfflineLogic } from '../useCadernoOfflineLogic';
import { cadernoService } from '../../../services/cadernoService';
import { localDb } from '../../../utils/db';

// Mock dependencies
vi.mock('../../../services/cadernoService', () => ({
    cadernoService: {
        addRegistro: vi.fn(),
        updateRegistro: vi.fn()
    }
}));

vi.mock('../../../utils/db', () => ({
    localDb: {
        set: vi.fn(),
        getAll: vi.fn(),
        delete: vi.fn()
    },
    SYNC_QUEUE_STORE: 'offline-sync-queue'
}));

describe('useCadernoOfflineLogic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('should save online when browser is online (new record)', async () => {
        vi.mocked(cadernoService.addRegistro).mockResolvedValue({ success: true } as any);

        const { result } = renderHook(() => useCadernoOfflineLogic());

        const payload = { tipo: 'PLANTIO', produto: 'Soja' };

        const saveResult = await act(async () => {
            return await result.current.saveRecord(payload);
        });

        expect(saveResult.success).toBe(true);
        expect(saveResult.isOffline).toBe(false);
        expect(cadernoService.addRegistro).toHaveBeenCalledWith(expect.not.objectContaining({ id: expect.any(String) }));
    });

    it('should update online when browser is online (existing record)', async () => {
        vi.mocked(cadernoService.updateRegistro).mockResolvedValue({ success: true } as any);

        const { result } = renderHook(() => useCadernoOfflineLogic());

        const payload = { id: 'real-123', tipo: 'PLANTIO', produto: 'Milho' };

        const saveResult = await act(async () => {
            return await result.current.saveRecord(payload);
        });

        expect(saveResult.success).toBe(true);
        expect(cadernoService.updateRegistro).toHaveBeenCalledWith('real-123', payload);
    });

    it('should save offline when browser is offline', async () => {
        vi.stubGlobal('navigator', { onLine: false });

        const { result } = renderHook(() => useCadernoOfflineLogic());

        const payload = { tipo: 'COLHEITA', produto: 'Cenoura' };

        const saveResult = await act(async () => {
            return await result.current.saveRecord(payload);
        });

        expect(saveResult.success).toBe(true);
        expect(saveResult.isOffline).toBe(true);
        expect(localDb.set).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'CADERNO_SAVE',
                payload: expect.objectContaining({ produto: 'Cenoura' })
            }),
            'offline-sync-queue'
        );
    });

    it('should fallback to offline save when online save fails with network error', async () => {
        vi.mocked(cadernoService.addRegistro).mockRejectedValue(new Error('Failed to fetch'));

        const { result } = renderHook(() => useCadernoOfflineLogic());

        const payload = { tipo: 'MANEJO', produto: 'Tomate' };

        const saveResult = await act(async () => {
            return await result.current.saveRecord(payload);
        });

        expect(saveResult.success).toBe(true);
        expect(saveResult.isOffline).toBe(true);
        expect(localDb.set).toHaveBeenCalled();
    });

    it('should return error when online save fails with non-network error', async () => {
        vi.mocked(cadernoService.addRegistro).mockRejectedValue(new Error('Validation error: Invalid field'));

        const { result } = renderHook(() => useCadernoOfflineLogic());

        const payload = { tipo: 'PLANTIO', produto: 'Invalid' };

        const saveResult = await act(async () => {
            return await result.current.saveRecord(payload);
        });

        expect(saveResult.success).toBe(false);
        expect(saveResult.error).toContain('Validation error');
        expect(localDb.set).not.toHaveBeenCalled();
    });
});
