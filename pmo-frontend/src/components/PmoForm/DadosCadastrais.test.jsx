// src/components/PmoForm/DadosCadastrais.test.jsx

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import DadosCadastrais from './DadosCadastrais'; // Importação Default

describe('Componente DadosCadastrais', () => {
  const mockData = {
    nome_produtor: 'Produtor Teste',
    cpf: '111.222.333-44',
  };

  test('deve renderizar os campos com os dados iniciais', () => {
    render(<DadosCadastrais data={mockData} onDataChange={() => { }} errors={{}} />);

    // Verifica se os campos são renderizados com os valores corretos
    expect(screen.getByLabelText(/Nome do Produtor/i)).toHaveValue('Produtor Teste');
    expect(screen.getByLabelText(/CPF/i)).toHaveValue('111.222.333-44');
  });

  test('deve chamar onDataChange quando um campo é alterado (após debounce)', async () => {
    // Usa fake timers para controlar o debounce
    vi.useFakeTimers();

    const mockOnDataChange = vi.fn();
    render(<DadosCadastrais data={mockData} onDataChange={mockOnDataChange} errors={{}} />);

    const emailInput = screen.getByLabelText(/E-mail/i);
    fireEvent.change(emailInput, { target: { value: 'teste@email.com' } });

    // Avança o timer para que o debounce dispare (default é 500ms)
    // Usamos act() para garantir que o React processe as atualizações de estado
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Verifica se a função de callback foi chamada com os dados atualizados
    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataChange).toHaveBeenCalledWith({
      ...mockData, // Inclui os dados antigos
      email: 'teste@email.com' // E o novo valor
    });

    vi.useRealTimers();
  });

  test('deve exibir a mensagem de erro quando a prop "errors" for passada', () => {
    const mockErrors = {
      cpf: 'O CPF informado é inválido.'
    };
    render(<DadosCadastrais data={mockData} onDataChange={() => { }} errors={mockErrors} />);

    const cpfInput = screen.getByLabelText(/CPF/i);

    // MUI TextField usa aria-invalid para indicar erros, não classes CSS
    expect(cpfInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('O CPF informado é inválido.')).toBeInTheDocument();
  });
});