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

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, loginWithGoogle, loginWithFacebook } = useAuth();
    const { goHome, goToSignUp, goToLab } = useAppNavigation();

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            goHome();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao fazer login. Verifique suas credenciais.';
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
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden py-8 px-4">
            {/* Background Image with Organic Theme */}
            <div className="absolute inset-0 z-0 select-none pointer-events-none">
                <img
                    src="https://images.unsplash.com/photo-1625246333195-58197bd47d26?q=80&w=2561&auto=format&fit=crop"
                    alt="Background"
                    className="w-full h-full object-cover"
                />
                {/* Dark overlay for contrast */}
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
                {/* Organic decorative gradients */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90" />
            </div>

            {/* Glassmorphic Card */}
            <div className="relative z-10 w-full max-w-[420px] bg-slate-900/40 backdrop-blur-3xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                {/* Header Section */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-green-500/20 mb-4 tracking-tighter">
                        MO
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h1>
                    <p className="text-slate-400 mt-1.5 text-sm">Acesse sua gestão agrícola inteligente</p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleLogin} className="space-y-4">
                    {/* Email Field */}
                    <div className="space-y-1.5">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                <Mail size={20} />
                            </div>
                            <input
                                required
                                type="email"
                                id="email"
                                placeholder="Endereço de E-mail"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                required
                                type={showPassword ? "text" : "password"}
                                id="password"
                                placeholder="Sua Senha"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-12 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
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
                                    className="peer h-4 w-4 appearance-none rounded-md border border-white/20 bg-slate-900/80 checked:bg-green-600 checked:border-green-600 focus:outline-none transition-all cursor-pointer"
                                />
                                <CheckCircle className="absolute inset-0 h-4 w-4 text-white p-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Lembrar-me</span>
                        </label>
                        <button type="button" className="text-sm font-medium text-green-400 hover:text-green-300 transition-colors decoration-green-400/30 underline-offset-4">
                            Esqueceu a senha?
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm animate-shake">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-green-600/30 hover:shadow-green-600/50 transition-all duration-300"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
                    </button>

                    <div className="flex items-center gap-4 my-8">
                        <div className="h-[1px] flex-1 bg-white/10" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">ou continue com</span>
                        <div className="h-[1px] flex-1 bg-white/10" />
                    </div>

                    {/* Social Login Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => handleSocialLogin('google')}
                            className="flex items-center justify-center gap-2.5 h-11 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-medium text-white transition-all"
                        >
                            <Chrome size={18} className="text-red-400" />
                            Google
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSocialLogin('facebook')}
                            className="flex items-center justify-center gap-2.5 h-11 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-medium text-white transition-all"
                        >
                            <Facebook size={18} className="text-blue-500" />
                            Facebook
                        </button>
                    </div>

                    {/* Registration Link */}
                    <div className="mt-8 pt-4 text-center">
                        <p className="text-sm text-slate-400">
                            Não tem uma conta?{' '}
                            <button
                                type="button"
                                onClick={goToSignUp}
                                className="text-green-400 font-bold hover:text-green-300 transition-colors"
                            >
                                Cadastre-se
                            </button>
                        </p>
                    </div>
                </form>
            </div>

            {/* Footer */}
            <footer className="relative z-10 mt-10 text-center">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                    {import.meta.env.VITE_APP_NAME} © {new Date().getFullYear()}
                </p>
            </footer>

            {/* Lab Button (Secret Access) */}
            <div className="fixed bottom-6 right-6 z-10">
                <button
                    onClick={goToLab}
                    title="Design Lab"
                    className="p-3 bg-white/5 hover:bg-green-500/20 text-slate-600 hover:text-green-500 border border-white/5 rounded-full backdrop-blur-md transition-all group"
                >
                    <FlaskConical size={20} className="group-hover:scale-110 transition-transform" />
                </button>
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