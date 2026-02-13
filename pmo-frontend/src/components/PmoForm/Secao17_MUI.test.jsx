import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao17MUI from './Secao17_MUI';

describe('Secao17MUI', () => {
    test('deve atualizar principais problemas', () => {
        const mockOnSectionChange = vi.fn();
        const data = {};

        render(<Secao17MUI data={data} onSectionChange={mockOnSectionChange} />);

        const input = document.getElementsByName('principais_problemas_producao_organica')[0];
        fireEvent.change(input, { target: { value: 'Falta de mão de obra' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            principais_problemas_producao_organica: {
                principais_problemas_producao_organica: 'Falta de mão de obra'
            }
        }));
    });
});
