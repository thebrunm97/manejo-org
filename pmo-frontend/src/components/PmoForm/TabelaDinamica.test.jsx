// src/components/PmoForm/TabelaDinamica.test.jsx

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabelaDinamica from './TabelaDinamica';
import { vi } from 'vitest';

// Column definitions using current id/label format
const mockColumns = [
  { id: 'produto', label: 'Nome do Produto', type: 'text' },
  { id: 'quantidade', label: 'Quantidade', type: 'number' },
];

describe('Componente TabelaDinamica (Cards/Accordion)', () => {

  test('deve renderizar label/título quando passado', () => {
    render(
      <TabelaDinamica
        label="Teste de Tabela"
        columns={mockColumns}
        data={[{ id: '1', produto: 'Tomate', quantidade: '10' }]}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    expect(screen.getByText('Teste de Tabela')).toBeInTheDocument();
  });

  test('deve renderizar card com título do item', () => {
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[{ id: '1', produto: 'Tomate', quantidade: '10' }]}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    expect(screen.getByText('Tomate')).toBeInTheDocument();
  });

  test('deve mostrar empty state quando não há dados', () => {
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[]}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    expect(screen.getByText(/nenhum produto adicionado/i)).toBeInTheDocument();
  });

  test('deve adicionar um novo item ao clicar no botão "Adicionar"', () => {
    const mockOnDataChange = vi.fn();
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[]}
        onDataChange={mockOnDataChange}
        itemName="Produto"
        itemNoun="o"
      />
    );

    // Click the "Adicionar" button in the empty state
    const addButton = screen.getByRole('button', { name: /Adicionar novo Produto/i });
    fireEvent.click(addButton);

    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
    expect(mockOnDataChange).toHaveBeenCalledWith([
      expect.objectContaining({ produto: '', quantidade: '' })
    ]);
  });

  test('novo item deve nascer com card expandido (campos visíveis)', () => {
    const mockOnDataChange = vi.fn();
    const { rerender } = render(
      <TabelaDinamica
        columns={mockColumns}
        data={[]}
        onDataChange={mockOnDataChange}
        itemName="Produto"
        itemNoun="o"
      />
    );

    // Add a new item
    const addButton = screen.getByRole('button', { name: /Adicionar novo Produto/i });
    fireEvent.click(addButton);

    // The card should be auto-expanded, so the field labels should be visible
    expect(screen.getByText('Nome do Produto')).toBeInTheDocument();
    expect(screen.getByText('Quantidade')).toBeInTheDocument();
  });

  test('deve mostrar fallback "Novo Produto" para itens sem título', () => {
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[{ id: '1', produto: '', quantidade: '' }]}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    expect(screen.getByText('Novo Produto')).toBeInTheDocument();
  });

  test('deve remover item ao confirmar no modal', () => {
    const mockOnDataChange = vi.fn();
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[{ id: '1', produto: 'Alface', quantidade: '50' }]}
        onDataChange={mockOnDataChange}
        itemName="Produto"
      />
    );

    // Click the remove button (icon button in card header with title="Remover")
    const removeButton = screen.getByTitle('Remover');
    fireEvent.click(removeButton);

    // Confirm deletion in the modal — isolate the modal context
    const modal = screen.getByText('Confirmar Exclusão').closest('div');
    const confirmButton = within(modal).getByRole('button', { name: /^remover$/i });
    fireEvent.click(confirmButton);

    expect(mockOnDataChange).toHaveBeenCalledWith([]);
  });

  test('todos os botões devem ter type="button"', () => {
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[{ id: '1', produto: 'Tomate', quantidade: '10' }]}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn).toHaveAttribute('type', 'button');
    });
  });

  test('deve expandir/colapsar card ao clicar no chevron', () => {
    render(
      <TabelaDinamica
        columns={mockColumns}
        data={[{ id: '1', produto: 'Tomate', quantidade: '10' }]}
        onDataChange={() => { }}
        itemName="Produto"
      />
    );

    // Card should be closed initially — field labels not in the body
    expect(screen.queryByText('Nome do Produto')).not.toBeInTheDocument();

    // Click the expand button
    const expandBtn = screen.getByRole('button', { name: /Expandir/i });
    fireEvent.click(expandBtn);

    // Now field labels should be visible
    expect(screen.getByText('Nome do Produto')).toBeInTheDocument();
    expect(screen.getByText('Quantidade')).toBeInTheDocument();
  });
});