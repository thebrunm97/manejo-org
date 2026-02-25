// Arquivo: src/components/PmoForm/Secao11.test.jsx (versão corrigida)

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Secao11 from './Secao11';

// 'describe' agrupa testes relacionados para um mesmo componente
describe('Componente Secao11', () => {

  // 'test' (ou 'it') define um caso de teste específico
  test('deve renderizar os campos e atualizar o estado ao digitar', () => {
    
    // CORREÇÃO: Usamos 'vi.fn()' em vez de 'jest.fn()'
    // A variável 'vi' é fornecida globalmente pelo Vitest
    const mockOnSectionChange = vi.fn();

    // 1. RENDERIZA o componente em um ambiente de teste
    render(<Secao11 data={{}} onSectionChange={mockOnSectionChange} />);

    // 2. ENCONTRA um elemento na tela pela sua label
    const inputControleOrganico = screen.getByLabelText(/Como é controlada a colheita dos produtos orgânicos?/i);

    // 3. SIMULA a digitação do usuário
    fireEvent.change(inputControleOrganico, { target: { value: 'Colheita manual cuidadosa' } });

    // 4. VERIFICA se o resultado esperado aconteceu
    expect(mockOnSectionChange).toHaveBeenCalledWith({
      controle_colheita_organicos: {
        controle_colheita_organicos: 'Colheita manual cuidadosa'
      }
    });
  });
});