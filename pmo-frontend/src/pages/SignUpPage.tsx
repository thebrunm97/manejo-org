import React, { useState, FormEvent, ChangeEvent } from 'react';
import {
    User,
    Mail,
    Lock,
    Calendar,
    Briefcase,
    Loader2,
    AlertCircle,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';

const SignUpPage: React.FC = () => {
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [profession, setProfession] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const { goToLogin } = useAppNavigation();

    const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const profileData = {
            full_name: fullName,
            profession: profession,
            gender: gender,
            birth_date: birthDate,
        };

        try {
            await signUp(email, password, profileData);
            alert('Cadastro realizado! Um link de confirmação foi enviado para o seu e-mail.');
            goToLogin();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao realizar o cadastro.';
            setError(message);
            setLoading(false);
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
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90" />
            </div>

            {/* Glassmorphic Card */}
            <div className="relative z-10 w-full max-w-[550px] bg-slate-900/40 backdrop-blur-3xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                {/* Header Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-green-500/20 mb-4 tracking-tighter">
                        MO
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Cadastre-se</h1>
                    <p className="text-slate-400 mt-1.5 text-sm">Crie sua conta e comece a gerenciar</p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSignUp} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Full Name */}
                        <div className="sm:col-span-2">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                    <User size={20} />
                                </div>
                                <input
                                    required
                                    type="text"
                                    id="fullName"
                                    placeholder="Nome Completo"
                                    autoFocus
                                    value={fullName}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Birth Date */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                <Calendar size={20} />
                            </div>
                            <input
                                required
                                type="date"
                                id="birthDate"
                                placeholder="Data de Nascimento"
                                value={birthDate}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm"
                            />
                        </div>

                        {/* Gender Select */}
                        <div className="relative group">
                            <select
                                required
                                id="gender"
                                value={gender}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setGender(e.target.value)}
                                className="block w-full pl-4 pr-10 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm appearance-none cursor-pointer"
                            >
                                <option value="" disabled className="bg-slate-900">Gênero</option>
                                <option value="feminino" className="bg-slate-900">Feminino</option>
                                <option value="masculino" className="bg-slate-900">Masculino</option>
                                <option value="nao_binario" className="bg-slate-900">Não-binário</option>
                                <option value="outro" className="bg-slate-900">Outro</option>
                                <option value="nao_informar" className="bg-slate-900">Prefiro não informar</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                <ChevronDown size={18} />
                            </div>
                        </div>

                        {/* Profession Select */}
                        <div className="sm:col-span-2 relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                <Briefcase size={20} />
                            </div>
                            <select
                                required
                                id="profession"
                                value={profession}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setProfession(e.target.value)}
                                className="block w-full pl-11 pr-10 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm appearance-none cursor-pointer"
                            >
                                <option value="" disabled className="bg-slate-900">Profissão / Área de Atuação</option>
                                <option value="agricultor" className="bg-slate-900">Agricultor(a)</option>
                                <option value="agronomo" className="bg-slate-900">Engenheiro(a) Agrônomo(a)</option>
                                <option value="tecnico" className="bg-slate-900">Técnico(a) Agrícola</option>
                                <option value="estudante" className="bg-slate-900">Estudante</option>
                                <option value="consultor" className="bg-slate-900">Consultor(a)</option>
                                <option value="outro" className="bg-slate-900">Outro</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                <ChevronDown size={18} />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="sm:col-span-2">
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
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="sm:col-span-2">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-green-500 transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input
                                    required
                                    type="password"
                                    id="password"
                                    placeholder="Senha (mínimo 6 caracteres)"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-sm"
                                />
                            </div>
                        </div>
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
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Cadastrar'}
                    </button>

                    {/* Login Link */}
                    <div className="mt-8 pt-4 text-center">
                        <p className="text-sm text-slate-400">
                            Já tem uma conta?{' '}
                            <button
                                type="button"
                                onClick={goToLogin}
                                className="text-green-400 font-bold hover:text-green-300 transition-colors"
                            >
                                Faça o login
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
        </div>
    );
};

export default SignUpPage;
