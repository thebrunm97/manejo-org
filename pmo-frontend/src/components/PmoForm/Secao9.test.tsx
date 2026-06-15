import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Secao9 from './Secao9';

// Mock PropagacaoCard to simplify list view
vi.mock('./cards/PropagacaoCard', () => ({
    default: ({ item, onEdit }: { item: any, onEdit: () => void }) => (
        <div data-testid="propagacao-card">
            <span>{item.especies}</span>
            <button onClick={onEdit}>Editar</button>
        </div>
    )
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user123' } }),
    useAuthProfile: () => ({
        profile: { pmo_ativo_id: 'pmo123', id: 'user123', role: 'producer' }
    })
}));

const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
const mockSelect = vi.fn(() => ({
    eq: mockEq
}));

vi.mock('../../supabaseClient', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: mockSelect,
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { id: 'new-row-id' }, error: null })
                }))
            })),
            update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null })
            })),
            delete: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null })
            }))
        }))
    }
}));

describe('Secao9', () => {
    test('deve abrir modal e adicionar novo item', async () => {
        const mockOnSectionChange = vi.fn();
        const data = { sementes_mudas_organicas: [] };

        render(<Secao9 data={data} onSectionChange={mockOnSectionChange} />);

        // Esperar o carregamento inicial terminar
        await waitFor(() => {
            expect(screen.queryByText(/Carregando dados/i)).not.toBeInTheDocument();
        });

        // Open Modal
        const btnAdd = screen.getByText('Adicionar');
        fireEvent.click(btnAdd);

        await waitFor(() => {
            expect(screen.getByText('Editar Item')).toBeInTheDocument();
        });

        // Fill Form
        // We need to target inputs inside the Dialog.
        // The dialog uses TextFields.

        // Especies (Required)
        const especieInput = screen.getByPlaceholderText('Ex: Alface Crespa');
        fireEvent.change(especieInput, { target: { value: 'Alface Americana' } });

        // Save
        const btnSave = screen.getByText('Salvar');
        fireEvent.click(btnSave);

        await waitFor(() => {
            expect(mockOnSectionChange).toHaveBeenCalledTimes(2);
        });

        const calledData = mockOnSectionChange.mock.calls[mockOnSectionChange.mock.calls.length - 1][0];
        expect(calledData.sementes_mudas_organicas).toHaveLength(1);
        expect(calledData.sementes_mudas_organicas[0].especies).toBe('Alface Americana');
    });

    test('deve editar item existente', async () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            sementes_mudas_organicas: [
                { _id: '1', especies: 'Tomate', tipo: 'semente' }
            ]
        };

        render(<Secao9 data={data} onSectionChange={mockOnSectionChange} />);

        // Esperar o carregamento inicial terminar
        await waitFor(() => {
            expect(screen.queryByText(/Carregando dados/i)).not.toBeInTheDocument();
        });

        // Find Edit button on mocked card
        const btnEdit = screen.getByText('Editar');
        fireEvent.click(btnEdit);

        await waitFor(() => {
            expect(screen.getByText('Editar Item')).toBeInTheDocument();
        });

        const especieInput = screen.getByPlaceholderText('Ex: Alface Crespa');
        fireEvent.change(especieInput, { target: { value: 'Tomate Cereja' } });

        const btnSave = screen.getByText('Salvar');
        fireEvent.click(btnSave);

        await waitFor(() => {
            expect(mockOnSectionChange).toHaveBeenCalledTimes(2);
        });

        const calledData = mockOnSectionChange.mock.calls[mockOnSectionChange.mock.calls.length - 1][0];
        // The logic in component replaces the item by ID
        expect(calledData.sementes_mudas_organicas[0].especies).toBe('Tomate Cereja');
    });
});
