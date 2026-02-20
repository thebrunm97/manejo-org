import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Secao18MUI from './Secao18';

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user123' } })
}));

// Mock Supabase Client
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();

vi.mock('../../supabaseClient', () => ({
    supabase: {
        storage: {
            from: () => ({
                upload: mockUpload,
                getPublicUrl: mockGetPublicUrl,
                remove: mockRemove
            })
        }
    }
}));

describe('Secao18MUI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpload.mockResolvedValue({ error: null });
        mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://fake-url/doc.pdf' } });
        mockRemove.mockResolvedValue({ error: null });
    });

    test('deve realizar upload de arquivo com sucesso', async () => {
        const mockOnSectionChange = vi.fn();
        const data = { lista_anexos: [] };

        render(<Secao18MUI data={data} onSectionChange={mockOnSectionChange} />);

        // Mock file selection
        const file = new File(['dummy content'], 'documento.pdf', { type: 'application/pdf' });

        // Find input type file (it is hidden, but accessible by Label or direct selector)
        // Since it's hidden, we can select by container usually, but let's query the input directly if possible
        // The component has <input type="file" hidden ... />
        // FireEvent change on it
        const fileInput = document.querySelector('input[type="file"]');
        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(screen.getByText('documento.pdf')).toBeInTheDocument();

        // Ensure Doc Name is filled (it auto fills from filename in component logic)
        expect(screen.getByDisplayValue('documento')).toBeInTheDocument();

        // Click Upload
        const btnUpload = screen.getByText('Anexar Documento');
        fireEvent.click(btnUpload);

        await waitFor(() => {
            expect(mockUpload).toHaveBeenCalled();
            expect(mockOnSectionChange).toHaveBeenCalled();
        });

        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.lista_anexos).toHaveLength(1);
        expect(calledData.lista_anexos[0].url_arquivo).toBe('http://fake-url/doc.pdf');
    });

    test('deve remover anexo', async () => {
        const mockOnSectionChange = vi.fn();
        const data = {
            lista_anexos: [{
                nome_documento: 'Doc 1',
                url_arquivo: 'url1',
                path_arquivo: 'path/doc1.pdf'
            }]
        };

        render(<Secao18MUI data={data} onSectionChange={mockOnSectionChange} />);

        const btnDelete = screen.getByLabelText('deletar');
        fireEvent.click(btnDelete);

        await waitFor(() => {
            expect(mockRemove).toHaveBeenCalledWith(['path/doc1.pdf']);
            expect(mockOnSectionChange).toHaveBeenCalled();
        });

        const calledData = mockOnSectionChange.mock.calls[0][0];
        expect(calledData.lista_anexos).toHaveLength(0);
    });
});
