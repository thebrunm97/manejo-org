import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao5MUI from './Secao5';

// TabelaDinamica uses a heuristic to pick the title column. 
// For Secao5, 'produto' is in the priority list, so it becomes the card title.

describe('Secao5MUI', () => {
    test('deve adicionar item na tabela de produção terceirizada', async () => {
        const mockOnSectionChange = vi.fn();
        const data = { produtos_terceirizados: [] };

        render(<Secao5MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Click Add Button
        const btnAdd = await screen.findByText(/Adicionar.*Produto Terceirizado/i);
        fireEvent.click(btnAdd);

        expect(mockOnSectionChange).toHaveBeenCalled();
        const callArgs = mockOnSectionChange.mock.calls[0][0];
        expect(callArgs.produtos_terceirizados).toHaveLength(1);
    });

    test('deve renderizar itens existentes e permitir expansão', async () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            produtos_terceirizados: [
                { id: '1', fornecedor: 'Fornecedor A', produto: 'Tomate', quantidade_ano: 100 }
            ]
        };

        const { debug } = render(<Secao5MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Wait for the sync effect to run
        const tomato = await screen.findByText(/Tomate/i);
        expect(tomato).toBeInTheDocument();

        // Expand the card
        const expandBtn = screen.getByTitle('Expandir');
        fireEvent.click(expandBtn);

        // Check values in expanded body
        expect(await screen.findByDisplayValue('Fornecedor A')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Tomate')).toBeInTheDocument();
    });
});
