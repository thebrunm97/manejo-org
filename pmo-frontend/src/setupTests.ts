// src/setupTests.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('./context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user123', email: 'test@example.com' },
        profile: { id: 'user123', name: 'Test User', role: 'producer', pmo_ativo_id: 'pmo123' },
        currentPropriedade: { id: 'prop123', nome: 'Test Property' },
        allPropriedades: [],
        isLoadingProfile: false,
        isLoading: false
    }),
    useAuthProfile: () => ({
        profile: { id: 'user123', name: 'Test User', role: 'producer', pmo_ativo_id: 'pmo123' },
        currentPropriedade: { id: 'prop123', nome: 'Test Property' },
        allPropriedades: [],
        isLoadingProfile: false,
    }),
    useAuthCore: () => ({
        user: { id: 'user123', email: 'test@example.com' },
        isLoading: false,
    })
}));
