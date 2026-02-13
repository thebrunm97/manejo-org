import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao12MUI from './Secao12_MUI';

describe('Secao12MUI', () => {
    test('deve atualizar higienização dos produtos orgânicos', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao12MUI data={data} onSectionChange={mockOnSectionChange} />);

        // 12.1 is the first accordion
        const input = document.getElementsByName('higienizacao_produtos_organicos')[0];
        fireEvent.change(input, { target: { value: 'Lavagem com água clorada' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            higienizacao_produtos_organicos: {
                higienizacao_produtos_organicos: 'Lavagem com água clorada'
            }
        }));
    });

    test('deve atualizar acondicionamento de produtos via subcomponente', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao12MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Open accordion 12.5
        const summary = screen.getByText(/12.5. Acondicionamento dos produtos/i);
        fireEvent.click(summary);

        const input = document.getElementsByName('embalados_envasados_produtos')[0];
        fireEvent.change(input, { target: { value: 'Sacos de 1kg' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            acondicionamento_produtos: {
                embalados_envasados_produtos: 'Sacos de 1kg'
            }
        }));
    });
});
