// src/main.tsx — Zero MUI

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n'; // Configuração do i18next
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

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
