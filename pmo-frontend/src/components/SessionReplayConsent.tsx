import { useEffect, useRef, useState } from 'react';
import { addIntegration } from '@sentry/browser';
import { useAuth } from '../context/AuthContext';
import { updateSessionReplayConsent } from '../services/profileService';
import { Button } from './ui/button';

/**
 * F17 (TECHNICAL_DEBT.md): gate de consentimento para o Session Replay do
 * Sentry (rrweb). O replay só é carregado depois de um "sim" explícito do
 * produtor, persistido em `profiles.consentimento_replay_sessao` — não em
 * localStorage, porque a decisão precisa valer em qualquer dispositivo que
 * o produtor use, não só no navegador onde ele respondeu.
 *
 * `null`/`undefined` = ainda não perguntado -> mostra o banner.
 * `true`  = aceitou -> carrega o replay (lazy, na primeira interação).
 * `false` = recusou -> nunca carrega, nunca mostra o banner de novo.
 */
export default function SessionReplayConsent() {
    const { profile, isLoadingProfile, refreshProfile } = useAuth();
    const [isSaving, setIsSaving] = useState<'accept' | 'decline' | null>(null);
    const replayLoadedRef = useRef(false);

    const consent = profile?.consentimento_replay_sessao;

    // Carrega o replay (lazy, só na primeira interação) quando o produtor já
    // aceitou. Roda só em produção -- ambiente local/staging sem
    // VITE_SENTRY_DSN de produção não precisa gravar nada.
    useEffect(() => {
        if (!import.meta.env.PROD) return;
        if (consent !== true) return;
        if (replayLoadedRef.current) return;
        if (!import.meta.env.VITE_SENTRY_DSN) return;

        replayLoadedRef.current = true;

        const loadReplay = () => {
            import('@sentry/replay').then(({ replayIntegration }) => {
                addIntegration(replayIntegration({
                    // Explícito mesmo sendo o default do SDK: qualquer regressão
                    // futura na lib não deve reabrir a exposição de dados do
                    // caderno de campo que motivou o F17.
                    maskAllText: true,
                    blockAllMedia: true,
                }));
            }).catch(() => {
                // Replay é best-effort: falha silenciosa não deve impactar o app.
            });
        };

        const events = ['pointerdown', 'keydown', 'touchstart'] as const;
        events.forEach((eventName) => window.addEventListener(eventName, loadReplay, { once: true }));
        return () => events.forEach((eventName) => window.removeEventListener(eventName, loadReplay));
    }, [consent]);

    const handleDecision = async (accepted: boolean) => {
        setIsSaving(accepted ? 'accept' : 'decline');
        const result = await updateSessionReplayConsent(accepted);
        if (result.success) {
            await refreshProfile();
        } else {
            console.error('[SessionReplayConsent] Falha ao salvar consentimento:', result.error);
        }
        setIsSaving(null);
    };

    // Sem produtor logado, sem perfil carregado, ou decisão já tomada: nada a mostrar.
    if (isLoadingProfile || !profile || consent === true || consent === false) {
        return null;
    }

    return (
        <div
            role="dialog"
            aria-label="Consentimento de gravação de sessão"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
            <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    Para corrigir erros mais rápido, podemos gravar sua sessão (tela e
                    ações, sem texto nem imagens sensíveis) só quando algo dá errado.
                    Você pode aceitar ou recusar — isso não muda nenhuma outra
                    funcionalidade do app.
                </p>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isSaving !== null}
                        onClick={() => handleDecision(false)}
                    >
                        {isSaving === 'decline' ? 'Salvando…' : 'Recusar'}
                    </Button>
                    <Button
                        size="sm"
                        disabled={isSaving !== null}
                        onClick={() => handleDecision(true)}
                    >
                        {isSaving === 'accept' ? 'Salvando…' : 'Aceitar'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
