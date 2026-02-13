import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao8MUI from './Secao8_MUI';

vi.mock('./TabelaDinamica_MUI.tsx', () => ({
    default: ({ onDataChange }) => (
        <button onClick={() => onDataChange([{ produto_ou_manejo: 'Composto' }])}>
            Atualizar Insumos
        </button>
    )
}));

describe('Secao8MUI', () => {
    test('deve atualizar lista de insumos', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};
        const formData = { insumos_melhorar_fertilidade: [] };

        render(<Secao8MUI data={data} formData={formData} onSectionChange={mockOnSectionChange} />);

        const btn = screen.getByText('Atualizar Insumos');
        fireEvent.click(btn);

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            insumos_melhorar_fertilidade: [{ produto_ou_manejo: 'Composto' }]
        }));
    });

    test('deve atualizar campo de insumos produção não orgânica', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao8MUI data={data} formData={{}} onSectionChange={mockOnSectionChange} />);

        const summary = screen.getByText(/8.2. Quais são os insumos utilizados na produção não orgânica?/i);
        fireEvent.click(summary);

        const input = document.getElementsByName('insumos_producao_nao_organica')[0];
        fireEvent.change(input, { target: { value: 'NPK 10-10-10' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            insumos_producao_nao_organica: {
                insumos_producao_nao_organica: 'NPK 10-10-10'
            }
        }));
    });
});
