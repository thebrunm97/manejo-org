import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao1MUI from './Secao1';

// Mock children to simplify testing logic and assume they work (they should have their own tests)
vi.mock('./DadosCadastrais', () => ({
    default: ({ onDataChange }) => (
        <input
            data-testid="mock-dados-cadastrais"
            onChange={(e) => onDataChange({ nome: e.target.value })}
        />
    )
}));

// Mock other children as simple placeholders
vi.mock('./RoteiroAcesso', () => ({ default: () => <div>Mock Roteiro</div> }));
vi.mock('./MapaCroqui', () => ({ default: () => <div>Mock Mapa</div> }));
vi.mock('./Coordenadas', () => ({ default: () => <div>Mock Coordenadas</div> }));
vi.mock('./AreaPropriedade', () => ({ default: () => <div>Mock Area</div> }));
vi.mock('./Historico', () => ({ default: () => <div>Mock Historico</div> }));
vi.mock('./Situacao', () => ({ default: () => <div>Mock Situacao</div> }));
vi.mock('./SeparacaoAreasProducaoParalela', () => ({ default: () => <div>Mock Separacao</div> }));

describe('Secao1MUI', () => {
    test('deve renderizar e atualizar dados da subseção corretamente', () => {
        const mockOnSectionChange = vi.fn();
        const data = { dados_cadastrais: { nome: 'Antigo' } };

        render(<Secao1MUI data={data} onSectionChange={mockOnSectionChange} />);

        expect(screen.getByText('1.1 Dados Cadastrais')).toBeInTheDocument();

        const input = screen.getByTestId('mock-dados-cadastrais');
        fireEvent.change(input, { target: { value: 'Novo Nome' } });

        expect(mockOnSectionChange).toHaveBeenCalledWith({
            ...data,
            dados_cadastrais: { nome: 'Novo Nome' }
        });
    });
});
