import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao2MUI from './Secao2_MUI';

// Mock TabelaDinamicaMUI to avoid complexity
vi.mock('./TabelaDinamica_MUI.tsx', () => ({
    default: ({ onDataChange, itemName }) => (
        <div>
            <span>Mock Table {itemName}</span>
            <button onClick={() => onDataChange([{ produto: 'Produto Teste' }])}>
                Atualizar {itemName}
            </button>
        </div>
    )
}));

describe('Secao2MUI', () => {
    test('deve atualizar dados de produção vegetal', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao2MUI data={data} onSectionChange={mockOnSectionChange} />);

        expect(screen.getByText('2.1. Produção Primária Vegetal (PPV)')).toBeInTheDocument();

        // Find button for the first table (Vegetal has itemName="Produto")
        const btn = screen.getByText('Atualizar Produto');
        fireEvent.click(btn);

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            producao_primaria_vegetal: {
                produtos_primaria_vegetal: [{ produto: 'Produto Teste' }]
            }
        }));
    });

    test('deve atualizar dados de produção animal', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao2MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Animal table has itemName="Animal"
        const btn = screen.getByText('Atualizar Animal');
        fireEvent.click(btn);

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            producao_primaria_animal: {
                animais_primaria_animal: [{ produto: 'Produto Teste' }]
            }
        }));
    });
});
