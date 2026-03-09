import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const ReloadPrompt: React.FC = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] m-4 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900 shadow-2xl rounded-2xl p-4 max-w-sm w-full backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-950 p-2 rounded-xl">
                        <RefreshCw className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin-slow" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {offlineReady ? 'App pronto para offline' : 'Nova atualização disponível!'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {offlineReady
                                ? 'O Manejo Orgânico agora funciona sem internet.'
                                : 'Uma nova versão do sistema com melhorias foi detectada.'}
                        </p>
                    </div>
                    <button
                        onClick={close}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-4 flex gap-2">
                    {needRefresh && (
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-all shadow-sm shadow-emerald-200 dark:shadow-none active:scale-95"
                        >
                            Atualizar Agora
                        </button>
                    )}
                    <button
                        onClick={close}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium py-2 px-4 rounded-lg transition-all active:scale-95"
                    >
                        {needRefresh ? 'Depois' : 'Fechar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReloadPrompt;
