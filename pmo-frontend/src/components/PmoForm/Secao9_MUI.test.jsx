import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao9MUI from './Secao9_MUI';

// Mock PropagacaoCard to simplify list view
vi.mock('./cards/PropagacaoCard', () => ({
    default: ({ item, onEdit }) => (
        <div data-testid="propagacao-card">
            <span>{item.especies}</span>
            <button onClick={onEdit}>Editar</button>
        </div>
    )
}));

describe('Secao9MUI', () => {
    test('deve abrir modal e adicionar novo item', async () => {
        const mockOnSectionChange = vi.fn();
        const data = { sementes_mudas_organicas: [] };

        render(<Secao9MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Open Modal
        const btnAdd = screen.getByText(/Adicionar Agora/i);
        fireEvent.click(btnAdd);

        expect(screen.getByText('Novo Item')).toBeInTheDocument();

        // Fill Form
        // We need to target inputs inside the Dialog.
        // The dialog uses TextFields.

        // Especies (Required)
        const especieInput = screen.getByLabelText(/Espécie \/ Cultivar/i);
        fireEvent.change(especieInput, { target: { value: 'Alface Americana' } });

        // Save
        const btnSave = screen.getByText('Salvar');
        fireEvent.click(btnSave);

        await waitFor(() => {
            expect(mockOnSectionChange).toHaveBeenCalled();
        });

        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.sementes_mudas_organicas).toHaveLength(1);
        expect(calledData.sementes_mudas_organicas[0].especies).toBe('Alface Americana');
    });

    test('deve editar item existente', () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            sementes_mudas_organicas: [
                { _id: '1', especies: 'Tomate', tipo: 'semente' }
            ]
        };

        render(<Secao9MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Find Edit button on mocked card
        const btnEdit = screen.getByText('Editar');
        fireEvent.click(btnEdit);

        expect(screen.getByText('Editar Item')).toBeInTheDocument();

        const especieInput = screen.getByLabelText(/Espécie \/ Cultivar/i);
        fireEvent.change(especieInput, { target: { value: 'Tomate Cereja' } });

        const btnSave = screen.getByText('Salvar');
        fireEvent.click(btnSave);

        const calledData = mockOnSectionChange.mock.calls[mockOnSectionChange.mock.calls.length - 1][0];
        // The logic in component replaces the item by ID
        expect(calledData.sementes_mudas_organicas[0].especies).toBe('Tomate Cereja');
    });
});
