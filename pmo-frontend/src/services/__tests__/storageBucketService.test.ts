import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFileToBucket } from '../storageBucketService';
import { supabase } from '../../supabaseClient';
import { MediaAsset } from '../../domain/media/mediaTypes';

// Mock Supabase
vi.mock('../../supabaseClient', () => ({
    supabase: {
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(),
                getPublicUrl: vi.fn()
            }))
        }
    }
}));

describe('storageBucketService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should upload from asset.file (Web)', async () => {
        const mockFile = new File(['test'], 'img.jpg', { type: 'image/jpeg' });
        const asset: MediaAsset = {
            name: 'img.jpg',
            file: mockFile,
            mimeType: 'image/jpeg',
            uri: '',
            size: 100
        };
        const userId = 'user-1';

        const mockUpload = vi.fn().mockResolvedValue({ error: null });
        const mockGetUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'http://cdn/img.jpg' } });

        vi.mocked(supabase.storage.from).mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetUrl
        } as any);

        const result = await uploadFileToBucket(asset, userId);

        expect(mockUpload).toHaveBeenCalledWith(
            expect.stringContaining('user-1'),
            mockFile,
            expect.objectContaining({ contentType: 'image/jpeg' })
        );
        expect(result).toBe('http://cdn/img.jpg');
    });

    it('should upload from asset.uri (Mobile)', async () => {
        const asset: MediaAsset = {
            name: 'photo.png',
            uri: 'file://local/path.png',
            mimeType: 'image/png',
            size: 500
        };
        const userId = 'user-2';
        const mockBlob = new Blob(['photo content']);

        vi.mocked(fetch).mockResolvedValue({
            blob: vi.fn().mockResolvedValue(mockBlob)
        } as any);

        const mockUpload = vi.fn().mockResolvedValue({ error: null });
        const mockGetUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'http://cdn/photo.png' } });

        vi.mocked(supabase.storage.from).mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetUrl
        } as any);

        const result = await uploadFileToBucket(asset, userId);

        expect(fetch).toHaveBeenCalledWith('file://local/path.png');
        expect(mockUpload).toHaveBeenCalledWith(
            expect.any(String),
            mockBlob,
            expect.any(Object)
        );
        expect(result).toBe('http://cdn/photo.png');
    });

    it('should return null if upload fails', async () => {
        const asset: MediaAsset = { name: 'f.txt', file: new File([], 'f.txt'), mimeType: 'text/plain', size: 0, uri: '' };

        vi.mocked(supabase.storage.from).mockReturnValue({
            upload: vi.fn().mockResolvedValue({ error: new Error('Storage Full') }),
            getPublicUrl: vi.fn()
        } as any);

        const result = await uploadFileToBucket(asset, 'u-3');
        expect(result).toBeNull();
    });

    it('should return null if asset is invalid', async () => {
        const asset: any = { name: 'invalid.jpg' }; // Missing file and uri
        const result = await uploadFileToBucket(asset, 'u-4');
        expect(result).toBeNull();
    });
});
