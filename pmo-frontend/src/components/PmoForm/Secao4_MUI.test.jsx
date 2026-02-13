import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao4MUI from './Secao4_MUI';

vi.mock('./TabelaDinamica_MUI.tsx', () => ({
    default: () => <div>Mock Tabela Dinamica</div>
}));

describe('Secao4MUI', () => {
    test('deve atualizar o radio de ha_animais', () => {
        const mockOnSectionChange = vi.fn();
        // data structure implies ha_animais_servico_subsistencia_companhia is an object wrapper
        const data = {
            ha_animais_servico_subsistencia_companhia: {
                ha_animais_servico_subsistencia_companhia: false
            }
        };

        render(<Secao4MUI data={data} onSectionChange={mockOnSectionChange} />);

        const radioSim = screen.getByLabelText('Sim');
        fireEvent.click(radioSim);

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            ha_animais_servico_subsistencia_companhia: {
                ha_animais_servico_subsistencia_companhia: true
            }
        }));
    });

    test('deve renderizar subseções apenas quando Sim é selecionado', () => {
        const mockOnSectionChange = vi.fn();

        const dataFalse = { ha_animais_servico_subsistencia_companhia: { ha_animais_servico_subsistencia_companhia: false } };
        const { rerender } = render(<Secao4MUI data={dataFalse} onSectionChange={mockOnSectionChange} />);
        expect(screen.queryByText('4.1.1 Animais de Serviço')).not.toBeInTheDocument();

        const dataTrue = { ha_animais_servico_subsistencia_companhia: { ha_animais_servico_subsistencia_companhia: true } };
        rerender(<Secao4MUI data={dataTrue} onSectionChange={mockOnSectionChange} />);
        expect(screen.getByText('4.1.1 Animais de Serviço')).toBeInTheDocument();
    });
});
