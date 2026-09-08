// src/main.tsx — Zero MUI

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n'; // Configuração do i18next
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from "@sentry/react";
import { addIntegration } from "@sentry/browser";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  // Performance Monitoring — 10% em produção reduz overhead do tracing sem perder visibilidade
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  // Session Replay config (carregado sob demanda em `loadReplayLazy`)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

/**
 * Session Replay (rrweb) é carregado sob demanda (lazy) para não pesar no
 * primeiro load. Sobe apenas após a primeira interação do usuário, mantendo
 * a funcionalidade de gravação de sessão (inclusive em erros).
 */
const loadReplayLazy = () => {
  import('@sentry/replay').then(({ replayIntegration }) => {
    if (import.meta.env.VITE_SENTRY_DSN) {
      addIntegration(replayIntegration());
    }
  }).catch(() => {
    // Replay é best-effort: falha silenciosa não deve impactar o app
  });
};

['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, loadReplayLazy, { once: true });
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
