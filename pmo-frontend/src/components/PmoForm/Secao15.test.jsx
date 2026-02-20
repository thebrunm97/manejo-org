import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao15MUI from './Secao15';

// Mock CheckboxGroupMUI
vi.mock('./CheckboxGroup', () => ({
    default: ({ onSelectionChange, selectedString }) => (
        <input
            data-testid="mock-checkbox-group"
            value={selectedString || ''}
            onChange={(e) => onSelectionChange(e.target.value)}
        />
    )
}));

describe('Secao15MUI', () => {
    test('deve atualizar registros de rastreabilidade', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao15MUI data={data} onSectionChange={mockOnSectionChange} />);

        const summary = screen.getByText(/15.1. Que tipo de registros são adotados para comprovar a rastreabilidade?/i);
        fireEvent.click(summary);

        const input = document.getElementsByName('registros_rastreabilidade')[0];
        fireEvent.change(input, { target: { value: 'Caderno de Campo Digital' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            registros_rastreabilidade: {
                registros_rastreabilidade: 'Caderno de Campo Digital'
            }
        }));
    });

    test('deve atualizar frequência dos registros', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao15MUI data={data} onSectionChange={mockOnSectionChange} />);

        const checkboxInput = screen.getByTestId('mock-checkbox-group');
        fireEvent.change(checkboxInput, { target: { value: 'Diário' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            frequencia_registros_anotacoes: 'Diário'
        }));
    });
});
