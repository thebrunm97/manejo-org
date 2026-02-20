import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao10MUI from './Secao10';

// Mock SectionContainer
vi.mock('../Common/SectionContainer', () => ({
    default: ({ children, onAdd, addButtonLabel }) => (
        <div>
            <button onClick={onAdd}>{addButtonLabel}</button>
            <div>{children}</div>
        </div>
    )
}));

describe('Secao10MUI', () => {
    test('deve abrir modal e adicionar novo manejo', async () => {
        const mockOnSectionChange = vi.fn();
        const data = { lista_fitossanidade: [] };

        render(<Secao10MUI data={data} onSectionChange={mockOnSectionChange} />);

        const btnAdd = screen.getByText(/Adicionar Manejo/i);
        fireEvent.click(btnAdd);

        expect(screen.getByText('Novo Manejo Fitossanitário')).toBeInTheDocument();

        // Fill Required Field
        const produtoInput = screen.getByLabelText(/Produto ou Manejo/i);
        fireEvent.change(produtoInput, { target: { value: 'Calda Sulfocálcica' } });

        // Save
        const btnSave = screen.getByText('Salvar');
        fireEvent.click(btnSave);

        expect(mockOnSectionChange).toHaveBeenCalled();
        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.lista_fitossanidade).toHaveLength(1);
        expect(calledData.lista_fitossanidade[0].produto_ou_manejo).toBe('Calda Sulfocálcica');
    });

    test('deve editar manejo existente', () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            lista_fitossanidade: [{ _id: '1', produto_ou_manejo: 'Neem', alvo_principal: 'Pulgão' }]
        };

        render(<Secao10MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Find Edit Icon (by arial label or role button inside the card)
        // Since we are not mocking the Card fully, we can find the button inside it.
        // There are multiple buttons, let's find by icon logic or structure.
        // The edit button has color='primary' and usually <EditIcon/>.
        // Let's rely on the fact there is only one item.
        const buttons = screen.getAllByRole('button');
        // Filter for the one that looks like edit (or try click the first icon button that is not 'Adicionar' or 'Ver detalhes')

        // Actually, we can look for the edit/delete buttons logic. 
        // Or cleaner: Mock FitossanidadeCard if we want easier selection, but testing the card is good.
        // Let's assume the Edit button is the first IconButton in the stack on the right.

        // We can just query by the "Neem" text which is in the card, then find the button near it.
        // But easier: rely on the fact that EditIcon creates an SVG with data-testid="EditIcon" by default in MUI if rendered?
        // Let's try finding by testid if MUI provides one, or just assume standard role button.

        // Let's find the edit button by relying on it being an IconButton.
        // It renders an <EditIcon />. Vitest/RTL usually renders SVGs.

        // Alternative: Mock FitossanidadeCard? No, let's use the real one for coverage.
        // We can find the button by its child SVG if we know the test id.
        // By default MUI icons have `data-testid="XIcon"`.
        const editButton = screen.getByTestId('EditIcon').closest('button');
        fireEvent.click(editButton);

        expect(screen.getByText('Editar Manejo')).toBeInTheDocument();

        const produtoInput = screen.getByLabelText(/Produto ou Manejo/i);
        fireEvent.change(produtoInput, { target: { value: 'Neem Oil' } });

        const btnSave = screen.getByText('Salvar');
        fireEvent.click(btnSave);

        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.lista_fitossanidade[0].produto_ou_manejo).toBe('Neem Oil');
    });
});
