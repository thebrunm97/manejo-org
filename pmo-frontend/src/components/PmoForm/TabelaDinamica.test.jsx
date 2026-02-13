// src/components/PmoForm/TabelaDinamica.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabelaDinamica from './TabelaDinamica';
import { vi } from 'vitest';

// 1. Setup do Teste: Preparamos os dados que o componente precisa
const mockColumns = [
  { header: 'Nome do Produto', key: 'produto' },
  { header: 'Quantidade', key: 'quantidade', type: 'number' },
];

describe('Componente TabelaDinamica', () => {

  test('deve renderizar corretamente com dados iniciais', () => {
    const mockData = [{ produto: 'Tomate', quantidade: '10' }];
    render(
      <TabelaDinamica
        title="Teste de Tabela"
        columns={mockColumns}
        data={mockData}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    // Verifica se o título e os cabeçalhos das colunas estão na tela
    expect(screen.getByText('Teste de Tabela')).toBeInTheDocument();
    expect(screen.getByText('Nome do Produto')).toBeInTheDocument();
    // Verifica se o input foi renderizado com o valor inicial
    expect(screen.getByDisplayValue('Tomate')).toBeInTheDocument();
  });

  test('deve adicionar uma nova linha ao clicar no botão "Adicionar"', () => {
    const mockOnDataChange = vi.fn();
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[]} // Começamos com a tabela vazia
        onDataChange={mockOnDataChange}
        itemName="Produto"
        itemNoun="o"
      />
    );

    // Encontra o botão de adicionar pelo seu texto
    const addButton = screen.getByRole('button', { name: /Adicionar novo Produto/i });
    // Simula o clique do usuário
    fireEvent.click(addButton);

    // Verifica se a função onDataChange foi chamada com um novo array contendo um item vazio
    // Usa expect.objectContaining para não acoplar ao _id gerado internamente
    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataChange).toHaveBeenCalledWith([
      expect.objectContaining({ produto: '', quantidade: '' })
    ]);
  });

  test('deve remover uma linha ao clicar no botão "Remover"', () => {
    const mockOnDataChange = vi.fn();
    const mockData = [{ produto: 'Alface', quantidade: '50' }];
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={mockData}
        onDataChange={mockOnDataChange}
        itemName="Produto"
      />
    );

    // Encontra o botão de remover
    const removeButton = screen.getByRole('button', { name: /Remover/i });
    fireEvent.click(removeButton);

    // Verifica se a função onDataChange foi chamada com um array vazio
    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataChange).toHaveBeenCalledWith([]);
  });

  test('deve atualizar o estado ao digitar em um campo', () => {
    const mockOnDataChange = vi.fn();
    const mockData = [{ produto: '', quantidade: '' }];
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={mockData}
        onDataChange={mockOnDataChange}
        itemName="Produto"
      />
    );

    // Encontra o input pelo seu placeholder
    const inputProduto = screen.getByPlaceholderText('Nome do Produto');
    // Simula a digitação
    fireEvent.change(inputProduto, { target: { value: 'Cenoura' } });

    // Verifica se onDataChange foi chamado com o array atualizado
    // Usa expect.objectContaining para não acoplar ao _id gerado internamente
    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataChange).toHaveBeenCalledWith([
      expect.objectContaining({ produto: 'Cenoura', quantidade: '' })
    ]);
  });

});