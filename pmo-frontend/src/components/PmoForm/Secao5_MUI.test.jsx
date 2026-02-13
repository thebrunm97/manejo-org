import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao5MUI from './Secao5_MUI';

// Secao5 defines its table internally, so we don't mock it, we test interaction.

describe('Secao5MUI', () => {
    test('deve adicionar item na tabela de produção terceirizada', () => {
        const mockOnSectionChange = vi.fn();
        const data = { produtos_terceirizados: [] };

        render(<Secao5MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Click Add Button
        const btnAdd = screen.getByText(/Adicionar Produto Terceirizado/i);
        fireEvent.click(btnAdd);

        // Expect onSectionChange to be called with a new array containing 1 item
        expect(mockOnSectionChange).toHaveBeenCalled();
        const callArgs = mockOnSectionChange.mock.calls[0][0];
        expect(callArgs.produtos_terceirizados).toHaveLength(1);
        expect(callArgs.produtos_terceirizados[0]).toHaveProperty('id');
    });

    test('deve renderizar itens existentes', () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            produtos_terceirizados: [
                { id: '1', fornecedor: 'Fornecedor A', produto: 'Tomate', quantidade_ano: 100 }
            ]
        };

        render(<Secao5MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Check if values are in the inputs
        expect(screen.getByDisplayValue('Fornecedor A')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Tomate')).toBeInTheDocument();
    });
});
