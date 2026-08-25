import React, { useState, FormEvent } from 'react';
import {
    Mail,
    Lock,
    Chrome,
    Facebook,
    FlaskConical,
    Loader2,
    AlertCircle,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { toast } from 'react-toastify';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, loginWithGoogle, loginWithFacebook } = useAuth();
    const { goHome, goToSignUp, goToLab } = useAppNavigation();
    const { t } = useTranslation('auth');

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            goHome();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('login.error');
            setError(message);
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook') => {
        try {
            setError('');
            if (provider === 'google') await loginWithGoogle();
            if (provider === 'facebook') await loginWithFacebook();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : `Falha ao fazer login com ${provider}.`;
            setError(message);
        }
    };

    return (
        <div className="min-h-screen bg-agro-creme flex">
            {/* Lado Esquerdo - Imagem Decorativa */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-slate-900 overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=2561&auto=format&fit=crop"
                    alt="Manejo Orgânico"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay"
                />
                <div className="absolute inset-0 bg-agro-floresta/80 mix-blend-multiply" />
                <div className="absolute inset-0 bg-gradient-to-t from-agro-floresta via-agro-floresta/50 to-transparent" />
                
                <div className="relative z-10 flex flex-col justify-between p-12 h-full text-white">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-agro-floresta font-serif font-bold text-2xl shadow-xl">
                        MO
                    </div>
                    
                    <div className="mb-12">
                        <h2 className="font-serif text-5xl font-bold mb-6 tracking-tight leading-tight">
                            A sabedoria da terra<br/>na palma da mão.
                        </h2>
                        <p className="text-lg text-white/90 max-w-md font-medium">
                            Gerencie sua certificação, safras e equipe em um único ambiente digital focado em agricultura orgânica.
                        </p>
                    </div>
                </div>
            </div>

            {/* Lado Direito - Formulário */}
            <div className="w-full lg:w-[55%] flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-y-auto">
                {/* Mobile Header / Logo */}
                <div className="lg:hidden absolute top-8 left-8">
                    <div className="w-12 h-12 bg-agro-floresta rounded-xl flex items-center justify-center text-white font-serif font-bold text-xl shadow-lg">
                        MO
                    </div>
                </div>

                {/* Top Controls */}
                <div className="absolute top-8 right-8 flex items-center gap-4">
                    <LanguageSwitcher />
                </div>

                <div className="w-full max-w-[400px] mt-16 lg:mt-0">
                    <div className="mb-10 text-center lg:text-left">
                        <h1 className="font-serif text-4xl font-bold text-agro-floresta tracking-tight mb-3">{t('login.title')}</h1>
                        <p className="text-slate-500 font-medium">Acesse sua gestão agrícola inteligente</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 ml-1">E-mail</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    required
                                    type="email"
                                    id="email"
                                    placeholder="seu@email.com"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 ml-1">{t('login.passwordLabel')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm"
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Options Row */}
                        <div className="flex items-center justify-between mt-2 mb-6">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer h-4 w-4 appearance-none rounded border border-slate-300 bg-white checked:bg-agro-floresta checked:border-agro-floresta focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 transition-all cursor-pointer"
                                    />
                                    <CheckCircle className="absolute inset-0 h-4 w-4 text-white p-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">Lembrar-me</span>
                            </label>
                            <button 
                                type="button" 
                                onClick={() => toast.info('Caso tenha esquecido sua senha, contate o suporte da sua cooperativa.')}
                                className="text-sm font-bold text-agro-floresta hover:text-emerald-700 transition-colors decoration-agro-floresta/30 underline-offset-4"
                            >
                                Esqueceu a senha?
                            </button>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm animate-shake shadow-sm">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center h-12 bg-agro-floresta hover:bg-emerald-900 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-agro-floresta/20 hover:shadow-agro-floresta/40 transition-all duration-300 active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : t('login.submit')}
                        </button>

                        <div className="flex items-center gap-4 my-8 opacity-70">
                            <div className="h-[1px] flex-1 bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">ou continue com</span>
                            <div className="h-[1px] flex-1 bg-slate-200" />
                        </div>

                        {/* Social Login Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => handleSocialLogin('google')}
                                className="flex items-center justify-center gap-2.5 h-11 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:shadow transition-all active:scale-[0.98]"
                            >
                                <Chrome size={18} className="text-red-500" />
                                Google
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSocialLogin('facebook')}
                                className="flex items-center justify-center gap-2.5 h-11 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:shadow transition-all active:scale-[0.98]"
                            >
                                <Facebook size={18} className="text-blue-600" />
                                Facebook
                            </button>
                        </div>

                        {/* Registration Link */}
                        <div className="mt-8 pt-6 text-center">
                            <p className="text-sm font-medium text-slate-500">
                                Não tem uma conta?{' '}
                                <button
                                    type="button"
                                    onClick={goToSignUp}
                                    className="text-agro-floresta font-bold hover:text-emerald-700 transition-colors underline underline-offset-4 decoration-agro-floresta/30"
                                >
                                    Cadastre-se grátis
                                </button>
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <footer className="absolute bottom-6 w-full text-center pointer-events-none">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {import.meta.env.VITE_APP_NAME} © {new Date().getFullYear()}
                    </p>
                </footer>

                {/* Lab Button (Secret Access) */}
                <div className="fixed bottom-6 right-6 z-10">
                    <button
                        onClick={goToLab}
                        title="Design Lab"
                        className="p-3 bg-white hover:bg-agro-creme text-slate-400 hover:text-agro-floresta border border-slate-200 rounded-full shadow-sm hover:shadow transition-all group"
                    >
                        <FlaskConical size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple helper icon for the checkbox
const CheckCircle: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export default LoginPage;