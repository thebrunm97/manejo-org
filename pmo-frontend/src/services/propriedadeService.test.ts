import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePropriedade } from './propriedadeService';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
    supabase: {
        rpc: vi.fn(),
        from: vi.fn(),
    },
}));

describe('propriedadeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('updatePropriedade', () => {
        it('deve atualizar a propriedade com sucesso e formatar os parametros nomeados via rpc_update_propriedade', async () => {
            // Arrange
            const mockRpcResponse = {
                data: {
                    status: 'success',
                    data: { id: 10 }
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const payload = { nome: 'Fazenda Nova', car: 'CAR-1234' };

            // Act
            const result = await updatePropriedade(10, payload);

            // Assert
            expect(supabase.rpc).toHaveBeenCalledWith('rpc_update_propriedade', {
                p_id: 10,
                p_updates: payload
            });
            expect(result.success).toBe(true);
        });

        it('deve retornar erro se a propriedade nao pertencer ao usuario (code FORBIDDEN)', async () => {
            // Arrange
            const mockRpcResponse = {
                data: {
                    status: 'error',
                    message: 'Acesso negado. Apenas o proprietário pode alterar.',
                    code: 'FORBIDDEN'
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            // Act
            const result = await updatePropriedade(10, { nome: 'Invasor' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Acesso negado. Apenas o proprietário pode alterar.');
        });
    });
});
