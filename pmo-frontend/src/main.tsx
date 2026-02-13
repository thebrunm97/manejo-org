// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

// MUI Imports
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Import do Provedor de Autenticação
import { AuthProvider } from './context/AuthContext';

// Import do ErrorBoundary
import ErrorBoundary from './components/ErrorBoundary';

// Tema Personalizado
import theme from './theme';

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso! Escopo:', registration.scope);
            })
            .catch(error => {
                console.error('Falha no registro do Service Worker:', error);
            });
    });
}

// Renderização da aplicação
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <AuthProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <App />
                    </ThemeProvider>
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
