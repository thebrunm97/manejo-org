import * as Sentry from '@sentry/react';
import { addIntegration } from '@sentry/browser';

let replayIntegrationLoaded = false;

/**
 * Carrega o Session Replay (rrweb) sob demanda, só quando o usuário deu
 * consentimento explícito (F17, `profiles.consentimento_replay_sessao`).
 * Nunca roda em dev. Mascara todo texto por padrão — defesa em profundidade
 * mesmo com opt-in, dado que o caderno de campo pode conter dados sensíveis
 * do produtor.
 *
 * As sample rates ficam em 0 no `Sentry.init` (main.tsx); o SDK só lê essas
 * opções quando o Replay integration é registrado, então setamos aqui, no
 * mesmo momento em que a integração sobe.
 */
export const applySessionReplayConsent = (consented: boolean) => {
    if (!consented || import.meta.env.DEV || replayIntegrationLoaded) return;
    if (!import.meta.env.VITE_SENTRY_DSN) return;

    replayIntegrationLoaded = true;
    import('@sentry/replay').then(({ replayIntegration }) => {
        const options = Sentry.getClient()?.getOptions() as
            | { replaysSessionSampleRate?: number; replaysOnErrorSampleRate?: number }
            | undefined;
        if (options) {
            options.replaysSessionSampleRate = 0.1;
            options.replaysOnErrorSampleRate = 1.0;
        }
        addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: true }));
    }).catch(() => {
        // Replay é best-effort: falha silenciosa não deve impactar o app
        replayIntegrationLoaded = false;
    });
};
