import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao7MUI from './Secao7_MUI';

vi.mock('./CheckboxGroup_MUI', () => ({
    default: ({ onSelectionChange }) => (
        <button onClick={() => onSelectionChange('Opcao teste')}>Mock Checkbox</button>
    )
}));

describe('Secao7MUI', () => {
    test('deve adicionar membro da família', () => {
        const mockOnSectionChange = vi.fn();
        const data = { membros_familia_producao: [] };

        render(<Secao7MUI data={data} onSectionChange={mockOnSectionChange} />);

        const btnAdd = screen.getByText(/Adicionar Membro/i);
        fireEvent.click(btnAdd);

        expect(mockOnSectionChange).toHaveBeenCalled();
        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.membros_familia_producao).toHaveLength(1);
    });

    test('deve editar membro existente', () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            membros_familia_producao: [{ nome: '', parentesco: '', funcao: '' }]
        };

        render(<Secao7MUI data={data} onSectionChange={mockOnSectionChange} />);

        const inputs = screen.getAllByRole('textbox'); // Should find inputs in the table
        const nomeInput = inputs[0];

        fireEvent.change(nomeInput, { target: { value: 'João' } });

        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.membros_familia_producao[0].nome).toBe('João');
    });
});
