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
  ],
  // Performance Monitoring — 10% em produção reduz overhead do tracing sem perder visibilidade
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  // Session Replay config (a integration em si só é adicionada com consentimento
  // explícito do produtor — ver components/SessionReplayConsent.tsx, F17).
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Import do Provedor de Autenticação
import { AuthProvider } from './context/AuthContext';

// Import do ErrorBoundary
import ErrorBoundary from './components/ErrorBoundary';

// F17: banner de consentimento LGPD + gate do Session Replay
import SessionReplayConsent from './components/SessionReplayConsent';


// Renderização da aplicação
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <AuthProvider>
                    <App />
                    <SessionReplayConsent />
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
