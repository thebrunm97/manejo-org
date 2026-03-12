// src/main.tsx — Zero MUI

import React from 'react';
import L from 'leaflet';
if (typeof window !== 'undefined') {
    (window as any).L = L;
}
import './leaflet-draw-shim';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

// Import do Provedor de Autenticação
import { AuthProvider } from './context/AuthContext';

// Import do ErrorBoundary
import ErrorBoundary from './components/ErrorBoundary';


// Renderização da aplicação
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
