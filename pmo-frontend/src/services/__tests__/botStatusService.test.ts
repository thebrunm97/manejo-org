import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBotStatus, getEffectiveStatus, formatRelativeTime } from '../botStatusService';
import { supabase } from '../../supabaseClient';

// Mock Supabase
vi.mock('../../supabaseClient', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn()
        }))
    }
}));

describe('botStatusService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-09T00:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('fetchBotStatus', () => {
        it('should return bot status correctly', async () => {
            const mockData = {
                session_name: 'agro_vivo',
                status: 'CONNECTED',
                last_heartbeat: '2026-03-09T00:00:00Z'
            };

            const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockData, error: null });
            vi.mocked(supabase.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle
            } as any);

            const result = await fetchBotStatus();
            expect(result).toEqual(mockData);
        });

        it('should return null on error', async () => {
            vi.mocked(supabase.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
            } as any);

            const result = await fetchBotStatus();
            expect(result).toBeNull();
        });
    });

    describe('getEffectiveStatus', () => {
        it('should return status as is if NOT stale', () => {
            const botStatus = {
                status: 'CONNECTED',
                last_heartbeat: '2026-03-08T23:58:00Z' // 2 mins ago
            } as any;

            const result = getEffectiveStatus(botStatus);
            expect(result.status).toBe('CONNECTED');
            expect(result.isStale).toBe(false);
        });

        it('should return DISCONNECTED if stale (over 3 mins)', () => {
            const botStatus = {
                status: 'CONNECTED',
                last_heartbeat: '2026-03-08T23:55:00Z' // 5 mins ago
            } as any;

            const result = getEffectiveStatus(botStatus);
            expect(result.status).toBe('DISCONNECTED');
            expect(result.isStale).toBe(true);
        });

        it('should return UNKNOWN if no status provided', () => {
            const result = getEffectiveStatus(null);
            expect(result.status).toBe('UNKNOWN');
            expect(result.isStale).toBe(true);
        });
    });

    describe('formatRelativeTime', () => {
        it('should return "agora mesmo" for very recent times', () => {
            expect(formatRelativeTime('2026-03-09T00:00:00Z')).toBe('agora mesmo');
        });

        it('should return "há 5 min" for 5 minutes ago', () => {
            expect(formatRelativeTime('2026-03-08T23:55:00Z')).toBe('há 5 min');
        });

        it('should return "há 2h" for 2 hours ago', () => {
            expect(formatRelativeTime('2026-03-08T22:00:00Z')).toBe('há 2h');
        });

        it('should return "há 3d" for 3 days ago', () => {
            expect(formatRelativeTime('2026-03-06T00:00:00Z')).toBe('há 3d');
        });
    });
});
