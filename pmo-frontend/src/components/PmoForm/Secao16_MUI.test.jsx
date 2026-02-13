import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao16MUI from './Secao16_MUI';

describe('Secao16MUI', () => {
    test('deve atualizar formas de reclamação', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao16MUI data={data} onSectionChange={mockOnSectionChange} />);

        const input = document.getElementsByName('formas_reclamacoes_criticas')[0];
        fireEvent.change(input, { target: { value: 'Email e WhatsApp' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            formas_reclamacoes_criticas: {
                formas_reclamacoes_criticas: 'Email e WhatsApp'
            }
        }));
    });
});
