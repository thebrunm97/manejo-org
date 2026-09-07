import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-toastify';
import { clsx } from 'clsx';

const AuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [code, setCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const urlCode = searchParams.get('code');
        if (!urlCode) {
            setError("Nenhum código de acesso fornecido na URL.");
        } else {
            setCode(urlCode);
        }
    }, [searchParams]);

    const handleLogin = async () => {
        if (!code) return;
        
        setIsLoading(true);
        setError(null);

        try {
            // Chamada ao backend para trocar o código opaco por uma sessão
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            const response = await fetch(`${apiUrl}/api/v1/auth/exchange`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            let data;
            try {
                data = await response.json();
            } catch (e) {
                throw new Error("Erro de comunicação com o servidor.");
            }

            if (!response.ok) {
                // Rate limit, expirado ou falha
                throw new Error(data.error || "Código inválido ou expirado.");
            }

            // Backend retornou os tokens com sucesso
            const { access_token, refresh_token } = data;
            
            if (!access_token || !refresh_token) {
                throw new Error("Resposta inválida do servidor.");
            }

            // Injeta a sessão no cliente Supabase
            const { error: sessionError } = await supabase.auth.setSession({
                access_token,
                refresh_token
            });

            if (sessionError) {
                throw sessionError;
            }

            toast.success("Login realizado com sucesso!");
            
            // Limpa a URL para não deixar o código visível no histórico
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Navega para a raiz, o RouteGuard redirecionará para hub, onboarding ou dashboard
            navigate('/', { replace: true });

        } catch (err: any) {
            console.error("Erro na autenticação:", err);
            // Distingue erros de rede (fetch falhou) de erros da API (4xx/5xx)
            if (err instanceof TypeError) {
                setError("Falha de conexão. Verifique sua internet e tente novamente.");
            } else {
                setError(err.message || "Ocorreu um erro ao tentar acessar.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-emerald-600 p-6 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Acesso Seguro</h1>
                    <p className="text-emerald-100 mt-2 text-sm">
                        Manejo Orgânico App
                    </p>
                </div>

                <div className="p-8 text-center">
                    {error ? (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                                <AlertCircle className="w-6 h-6 text-rose-600" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Este link não é mais válido</h2>
                            <p className="text-slate-600 mb-6">{error}</p>
                            
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 w-full text-left">
                                <p className="font-medium mb-1">Como resolver?</p>
                                <p>Por segurança, este link expirou. Mande um <strong>"Oi"</strong> no WhatsApp para o bot para gerar um novo acesso.</p>
                            </div>
                            
                            <button 
                                onClick={() => navigate('/login')}
                                className="mt-6 text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
                            >
                                Voltar para o início
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">Quase lá!</h2>
                            <p className="text-slate-600 mb-8">
                                Clique no botão abaixo para confirmar seu acesso. Isso garante que você está navegando de forma segura.
                            </p>
                            
                            <button
                                onClick={handleLogin}
                                disabled={isLoading || !code}
                                className={clsx(
                                    "w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md",
                                    isLoading || !code
                                        ? "bg-slate-400 cursor-not-allowed shadow-none"
                                        : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Autenticando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Entrar no App</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthCallback;
