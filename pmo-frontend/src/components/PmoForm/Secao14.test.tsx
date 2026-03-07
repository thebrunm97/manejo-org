import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao14 from './Secao14';

describe('Secao14', () => {
    test('deve atualizar canais de comercialização', () => {
        const mockOnSectionChange = vi.fn();
        const data = { canais_comercializacao: '' };

        render(<Secao14 data={data} onSectionChange={mockOnSectionChange} />);

        const checkbox = screen.getByLabelText('Na unidade de produção.');
        fireEvent.click(checkbox);

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            canais_comercializacao: 'Na unidade de produção.'
        }));
    });

    test('deve remover canal se desmarcado', () => {
        const mockOnSectionChange = vi.fn();
        const data = { canais_comercializacao: 'Na unidade de produção.; Programa de Aquisição de Alimentos (PAA).' };

        render(<Secao14 data={data} onSectionChange={mockOnSectionChange} />);

        const checkbox = screen.getByLabelText('Na unidade de produção.');
        expect(checkbox).toBeChecked();

        fireEvent.click(checkbox);

        // Should leave only the second one. Note that logic usually rejoins with '; '
        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            canais_comercializacao: 'Programa de Aquisição de Alimentos (PAA).'
        }));
    });
});
