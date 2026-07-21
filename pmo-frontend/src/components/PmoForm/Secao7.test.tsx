import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Secao7 from './Secao7';

vi.mock('./CheckboxGroup', () => ({
    default: ({ onSelectionChange }: { onSelectionChange: (v: any) => void }) => (
        <button onClick={() => onSelectionChange('Opcao teste')}>Mock Checkbox</button>
    )
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user123' } }),
    useAuthProfile: () => ({
        profile: { pmo_ativo_id: 'pmo123', id: 'user123', role: 'producer' }
    })
}));

describe('Secao7', () => {
    test('deve adicionar membro da família', async () => {
        const mockOnSectionChange = vi.fn();
        const data = { membros_familia_producao: [] };

        render(<Secao7 data={data} onSectionChange={mockOnSectionChange} />);

        const btnAdd = screen.getByText(/Adicionar.*Membro/i);
        fireEvent.click(btnAdd);

        await waitFor(() => {
            expect(mockOnSectionChange).toHaveBeenCalled();
        }, { timeout: 3000 });
        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.membros_familia_producao).toHaveLength(1);
    });

    test('deve editar membro existente', async () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            membros_familia_producao: [{ id: '1', nome: '', parentesco: '', funcao: '' }]
        };

        render(<Secao7 data={data} onSectionChange={mockOnSectionChange} />);

        // O Accordion inicia fechado para itens já existentes na listagem, então precisamos expandir o card
        const btnExpand = screen.getByTitle('Expandir');
        fireEvent.click(btnExpand);

        const inputs = screen.getAllByRole('textbox'); // Should find inputs in the table
        const nomeInput = inputs[0];

        fireEvent.change(nomeInput, { target: { value: 'João' } });

        await waitFor(() => {
            expect(mockOnSectionChange).toHaveBeenCalled();
        }, { timeout: 3000 });
        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.membros_familia_producao[0].nome).toBe('JOÃO');
    });
});
