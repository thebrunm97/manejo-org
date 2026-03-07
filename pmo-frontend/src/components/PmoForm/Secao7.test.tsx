import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Secao7 from './Secao7';

vi.mock('./CheckboxGroup', () => ({
    default: ({ onSelectionChange }) => (
        <button onClick={() => onSelectionChange('Opcao teste')}>Mock Checkbox</button>
    )
}));

describe('Secao7', () => {
    test('deve adicionar membro da família', () => {
        const mockOnSectionChange = vi.fn();
        const data = { membros_familia_producao: [] };

        render(<Secao7 data={data} onSectionChange={mockOnSectionChange} />);

        const btnAdd = screen.getByText(/Adicionar Membro/i);
        fireEvent.click(btnAdd);

        expect(mockOnSectionChange).toHaveBeenCalled();
        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.membros_familia_producao).toHaveLength(1);
    });

    test('deve editar membro existente', () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            membros_familia_producao: [{ id: '1', nome: '', parentesco: '', funcao: '' }]
        };

        render(<Secao7 data={data} onSectionChange={mockOnSectionChange} />);

        const inputs = screen.getAllByRole('textbox'); // Should find inputs in the table
        const nomeInput = inputs[0];

        fireEvent.change(nomeInput, { target: { value: 'João' } });

        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.membros_familia_producao[0].nome).toBe('João');
    });
});
