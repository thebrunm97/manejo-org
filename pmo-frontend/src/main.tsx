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
  // F17: Session Replay começa DESLIGADO (0/0). Só é habilitado via
  // `applySessionReplayConsent`, chamado depois que o perfil carrega e
  // confirma opt-in explícito em `profiles.consentimento_replay_sessao`.
  // Gravar 100% das sessões com erro por padrão, sem consentimento, expunha
  // dados sensíveis do caderno de campo (LGPD).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
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
