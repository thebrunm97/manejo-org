import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePropriedade } from './propriedadeService';
import { goApiRpc } from './goApiClient';

// DT-59, fatia 3: updatePropriedade chama rpc_update_propriedade via
// goApiRpc (gateway Go), não mais supabase.rpc direto — mocka o ponto real
// de saída em vez do caminho antigo.
vi.mock('./goApiClient', () => ({
    goApiRpc: vi.fn(),
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
            (goApiRpc as any).mockResolvedValue(mockRpcResponse);

            const payload = { nome: 'Fazenda Nova', car: 'CAR-1234' };

            // Act
            const result = await updatePropriedade(10, payload);

            // Assert
            expect(goApiRpc).toHaveBeenCalledWith('rpc_update_propriedade', {
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
            (goApiRpc as any).mockResolvedValue(mockRpcResponse);

            // Act
            const result = await updatePropriedade(10, { nome: 'Invasor' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Acesso negado. Apenas o proprietário pode alterar.');
        });
    });
});
