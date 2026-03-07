import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao3 from './Secao3';

vi.mock('./TabelaDinamica.tsx', () => ({
    default: () => <div>Mock Tabela Dinamica</div>
}));

describe('Secao3', () => {
    test('deve atualizar o radio de produtos_nao_certificados', () => {
        const mockOnSectionChange = vi.fn();
        const data = { produtos_nao_certificados: false };

        render(<Secao3 data={data as any} onSectionChange={mockOnSectionChange} />);

        const radioSim = screen.getByLabelText('Sim');
        fireEvent.click(radioSim);

        expect(mockOnSectionChange).toHaveBeenCalledWith(expect.objectContaining({
            produtos_nao_certificados: true
        }));
    });

    test('deve renderizar tabelas apenas quando Sim é selecionado', () => {
        const mockOnSectionChange = vi.fn();

        const { rerender } = render(<Secao3 data={{ produtos_nao_certificados: 'false' } as any} onSectionChange={mockOnSectionChange} />);
        expect(screen.queryByText('3.1. Produção Primária Vegetal Não Orgânica')).not.toBeInTheDocument();

        rerender(<Secao3 data={{ produtos_nao_certificados: 'true' } as any} onSectionChange={mockOnSectionChange} />);
        expect(screen.getByText('3.1. Produção Primária Vegetal Não Orgânica')).toBeInTheDocument();
    });
});
