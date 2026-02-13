import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao13MUI from './Secao13_MUI';

// Mock TabelaDinamicaMUI for simplicity
vi.mock('./TabelaDinamica_MUI.tsx', () => ({
    default: () => <div>Mock Tabela Dinamica</div>
}));

// CheckboxGroupMUI is used heavily, let's mock it
vi.mock('./CheckboxGroup_MUI', () => ({
    default: ({ onSelectionChange, selectedString }) => (
        <button onClick={() => onSelectionChange('Opcao Teste')}>Update Checkbox {selectedString}</button>
    )
}));

describe('Secao13MUI', () => {
    test('deve atualizar técnicas de melhoria de pastos', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao13MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Find the specific checkbox group mock (first one) or by context
        // We can just generic search
        const buttons = screen.getAllByText(/Update Checkbox/i);
        fireEvent.click(buttons[0]); // 13.1

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            tecnicas_melhoria_pastos: 'Opcao Teste'
        }));
    });

    test('deve adicionar item na nutrição animal', () => {
        const mockOnSectionChange = vi.fn();
        const data = { nutricao_animal: [] };

        render(<Secao13MUI data={data} onSectionChange={mockOnSectionChange} />);

        const btnAdd = screen.getByText(/Adicionar Nutrição/i);
        fireEvent.click(btnAdd);

        expect(mockOnSectionChange).toHaveBeenCalled();
        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.nutricao_animal).toHaveLength(1);
    });
});
