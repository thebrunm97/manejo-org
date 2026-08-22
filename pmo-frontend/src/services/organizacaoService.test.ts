import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrganizacao, addMembro, removeMembro } from './organizacaoService';
import { supabase } from '../supabaseClient';

// Mock do supabase client
vi.mock('../supabaseClient', () => ({
    supabase: {
        rpc: vi.fn(),
    },
}));

describe('organizacaoService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createOrganizacao', () => {
        it('deve chamar rpc_insert_organizacao e retornar os dados em caso de sucesso', async () => {
            // Arrange
            const mockRpcResponse = {
                data: {
                    status: 'success',
                    data: { id: 1, nome: 'Org Teste', tipo: 'cooperativa' }
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const payload = { nome: 'Org Teste', tipo: 'cooperativa' as const };

            // Act
            const result = await createOrganizacao(payload);

            // Assert
            expect(supabase.rpc).toHaveBeenCalledWith('rpc_insert_organizacao', {
                p_nome: 'Org Teste',
                p_tipo: 'cooperativa',
                p_cnpj: null
            });
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockRpcResponse.data.data);
        });

        it('deve retornar erro se o status do contrato JSONB for error (ex: RLS Admin)', async () => {
            // Arrange
            const mockRpcResponse = {
                data: {
                    status: 'error',
                    message: 'Apenas administradores podem criar organizações',
                    code: 'FORBIDDEN'
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const payload = { nome: 'Org Teste', tipo: 'cooperativa' as const };

            // Act
            const result = await createOrganizacao(payload);

            // Assert
            expect(supabase.rpc).toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Apenas administradores podem criar organizações');
        });

        it('deve retornar erro de CNPJ duplicado em caso de unique_violation', async () => {
            // Arrange
            const mockRpcResponse = {
                data: {
                    status: 'error',
                    message: 'Já existe uma organização com este CNPJ.',
                    code: 'UNIQUE_VIOLATION'
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const payload = { nome: 'Org Teste Duplicada', cnpj: '12345678000199', tipo: 'cooperativa' as const };

            // Act
            const result = await createOrganizacao(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Já existe uma organização com este CNPJ.');
        });
    });

    describe('addMembro', () => {
        it('deve retornar success=true no caminho feliz', async () => {
            const mockRpcResponse = {
                data: { status: 'success' },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const result = await addMembro(1, 10);

            expect(supabase.rpc).toHaveBeenCalledWith('rpc_add_organizacao_membro', {
                p_organizacao_id: 1,
                p_propriedade_id: 10
            });
            expect(result.success).toBe(true);
        });

        it('deve retornar erro se o usuário não for o dono da propriedade (ERR_AUTH)', async () => {
            const mockRpcResponse = {
                data: {
                    status: 'error',
                    message: 'Apenas o dono da propriedade pode vinculá-la a uma organização.',
                    code: 'ERR_AUTH_FORBIDDEN'
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const result = await addMembro(1, 10);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Apenas o dono da propriedade pode vinculá-la a uma organização.');
        });

        it('deve retornar erro se já houver vínculo (ERR_DUPLICATE)', async () => {
            const mockRpcResponse = {
                data: {
                    status: 'error',
                    message: 'Esta propriedade já é membro desta organização.',
                    code: 'ERR_DUPLICATE'
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const result = await addMembro(1, 10);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Esta propriedade já é membro desta organização.');
        });
    });

    describe('removeMembro', () => {
        it('deve retornar success=true no caminho feliz', async () => {
            const mockRpcResponse = {
                data: { status: 'success' },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const result = await removeMembro(1, 10);

            expect(supabase.rpc).toHaveBeenCalledWith('rpc_remove_organizacao_membro', {
                p_organizacao_id: 1,
                p_propriedade_id: 10
            });
            expect(result.success).toBe(true);
        });

        it('deve tratar e retornar erro de auth retornado pela RPC', async () => {
            const mockRpcResponse = {
                data: {
                    status: 'error',
                    message: 'Apenas o dono da propriedade pode desvinculá-la de uma organização.',
                    code: 'ERR_AUTH_FORBIDDEN'
                },
                error: null
            };
            (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

            const result = await removeMembro(1, 10);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Apenas o dono da propriedade pode desvinculá-la de uma organização.');
        });
    });
});
