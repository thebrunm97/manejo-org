import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao6MUI from './Secao6';

// Mock CheckboxGroupMUI
vi.mock('./CheckboxGroup', () => ({
    default: ({ onSelectionChange, selectedString }) => (
        <div>
            <input
                data-testid="mock-checkbox-group"
                value={selectedString || ''}
                onChange={(e) => onSelectionChange(e.target.value)}
            />
        </div>
    )
}));

describe('Secao6MUI', () => {
    test('deve atualizar o controle de uso da água', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao6MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Find by name attribute since label is inside accordion
        // Material UI TextFields with name prop can be queried by name in testing-library if we look for the input
        // Or we can find by label text if visible. 
        // Let's try finding the specific accordion content first or just query by multiline textbox

        // Open accordion 6.3 
        const summary = screen.getByText(/6.3. Como controla o uso da água na produção?/i);
        fireEvent.click(summary);

        // Material UI multiline uses a textarea or contenteditable, often identifiable by role "textbox"
        // But let's use the container or name.
        // We can query by name attribute on the input element
        const inputs = document.getElementsByName('controle_uso_agua');
        const input = inputs[0]; // Access direct DOM node for simplicity in MUI structure

        fireEvent.change(input, { target: { value: 'Uso racional' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            controle_uso_agua: 'Uso racional'
        }));
    });

    test('deve atualizar checkboxes de biodiversidade', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao6MUI data={data} onSectionChange={mockOnSectionChange} />);

        const mockCheckbox = screen.getAllByTestId('mock-checkbox-group')[0];
        fireEvent.change(mockCheckbox, { target: { value: 'Nova Seleção' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            promocao_biodiversidade: 'Nova Seleção'
        }));
    });
});
