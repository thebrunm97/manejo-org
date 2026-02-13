// src/components/PmoForm/Coordenadas.test.jsx (versão com mock corrigido)

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Coordenadas from './Coordenadas_MUI';

// Guarda a implementação original do navigator.geolocation para restaurá-la depois
const originalGeolocation = navigator.geolocation;

describe('Componente Coordenadas', () => {

  // Antes de cada teste, definimos nosso mock
  beforeEach(() => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn(),
      // Adicionamos as outras funções da API para evitar erros, mesmo que não as usemos
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    // Redefinimos a propriedade geolocation no objeto navigator
    Object.defineProperty(window.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });
  });

  // Depois de cada teste, limpamos o mock e restauramos a original
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, 'geolocation', {
      value: originalGeolocation,
      writable: true,
    });
  });

  test('deve renderizar os campos de latitude e longitude', () => {
    render(<Coordenadas data={{}} onDataChange={() => { }} errors={{}} />);
    expect(screen.getByLabelText(/Latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Longitude/i)).toBeInTheDocument();
  });

  test('deve exibir erros de validação quando a prop errors for passada', () => {
    const mockErrors = { latitude: 'Latitude é obrigatória.' };
    render(<Coordenadas data={{}} onDataChange={() => { }} errors={mockErrors} />);
    // MUI TextField usa aria-invalid para indicar erros, não classes CSS
    expect(screen.getByLabelText(/Latitude/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Latitude é obrigatória.')).toBeInTheDocument();
  });

  test('deve preencher os campos ao clicar no botão de geolocalização (sucesso)', async () => {
    const mockOnDataChange = vi.fn();

    // Agora, nosso mock de getCurrentPosition pode ser mais simples
    navigator.geolocation.getCurrentPosition.mockImplementation((success) =>
      success({
        coords: {
          latitude: -18.9113,
          longitude: -48.2622,
        },
      })
    );

    render(<Coordenadas data={{}} onDataChange={mockOnDataChange} errors={{}} />);

    const getCoordsButton = screen.getByRole('button', { name: /Usar Localização/i });
    fireEvent.click(getCoordsButton);

    await waitFor(() => {
      expect(mockOnDataChange).toHaveBeenCalledWith({
        latitude: '-18.911300',
        longitude: '-48.262200',
      });
    });
  });

  test('deve exibir uma mensagem de erro se o usuário negar a permissão (falha)', async () => {
    // Mock para o caso de falha (permissão negada)
    navigator.geolocation.getCurrentPosition.mockImplementation((success, error) =>
      error({
        code: 1, // PERMISSION_DENIED
        message: "User denied Geolocation"
      })
    );

    render(<Coordenadas data={{}} onDataChange={() => { }} errors={{}} />);

    const getCoordsButton = screen.getByRole('button', { name: /Usar Localização/i });
    fireEvent.click(getCoordsButton);

    const errorMessage = await screen.findByText(/Permissão para obter a localização foi negada/i);
    expect(errorMessage).toBeInTheDocument();
  });
});