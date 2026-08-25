import React, { useState, FormEvent, ChangeEvent } from 'react';
import {
    User,
    Mail,
    Lock,
    Calendar,
    Briefcase,
    Loader2,
    AlertCircle,
    ChevronDown,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { toast } from 'react-toastify';

const SignUpPage: React.FC = () => {
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [profession, setProfession] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const { goToLogin } = useAppNavigation();

    const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }
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
            toast.success('Cadastro realizado! Um link de confirmação foi enviado para o seu e-mail.');
            goToLogin();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao realizar o cadastro.';
            setError(message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-agro-creme flex flex-row-reverse">
            {/* Lado Direito - Imagem Decorativa (Invertido em relação ao Login para variar a estética) */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-slate-900 overflow-hidden">
                {/* Imagem de Satélite / Plantio */}
                <img
                    src="https://images.unsplash.com/photo-1605000797499-95a51c5269ae?q=80&w=2000&auto=format&fit=crop"
                    alt="Lavouras Orgânicas"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay"
                />
                <div className="absolute inset-0 bg-agro-floresta/80 mix-blend-multiply" />
                <div className="absolute inset-0 bg-gradient-to-t from-agro-floresta via-agro-floresta/50 to-transparent" />
                
                <div className="relative z-10 flex flex-col justify-between p-12 h-full text-white">
                    <div className="flex justify-end">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-agro-floresta font-serif font-bold text-2xl shadow-xl">
                            MO
                        </div>
                    </div>
                    
                    <div className="mb-12">
                        <h2 className="font-serif text-5xl font-bold mb-6 tracking-tight leading-tight">
                            Junte-se à revolução<br/>agrícola.
                        </h2>
                        <p className="text-lg text-white/90 max-w-md font-medium">
                            Conecte sua propriedade aos princípios sintrópicos e ganhe eficiência no seu plano de manejo orgânico.
                        </p>
                    </div>
                </div>
            </div>

            {/* Lado Esquerdo - Formulário */}
            <div className="w-full lg:w-[55%] flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-y-auto">
                {/* Mobile Header / Logo */}
                <div className="lg:hidden absolute top-8 left-8">
                    <div className="w-12 h-12 bg-agro-floresta rounded-xl flex items-center justify-center text-white font-serif font-bold text-xl shadow-lg">
                        MO
                    </div>
                </div>

                <div className="w-full max-w-[480px] mt-16 lg:mt-0">
                    <div className="mb-10 text-center lg:text-left">
                        <h1 className="font-serif text-4xl font-bold text-agro-floresta tracking-tight mb-3">Cadastre-se</h1>
                        <p className="text-slate-500 font-medium">Crie sua conta e comece a gerenciar hoje mesmo.</p>
                    </div>
                    
                    <form onSubmit={handleSignUp} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Full Name */}
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Nome Completo</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        id="fullName"
                                        placeholder="Ex: João da Silva"
                                        autoFocus
                                        value={fullName}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Birth Date */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Data de Nasc.</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                        <Calendar size={18} />
                                    </div>
                                    <input
                                        required
                                        type="date"
                                        id="birthDate"
                                        max={new Date().toISOString().split('T')[0]}
                                        value={birthDate}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Gender Select */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Gênero</label>
                                <div className="relative group">
                                    <select
                                        required
                                        id="gender"
                                        aria-label="Gênero"
                                        value={gender}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setGender(e.target.value)}
                                        className="block w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Selecione</option>
                                        <option value="feminino">Feminino</option>
                                        <option value="masculino">Masculino</option>
                                        <option value="nao_binario">Não-binário</option>
                                        <option value="outro">Outro</option>
                                        <option value="nao_informar">Prefiro não informar</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                        <ChevronDown size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Profession Select */}
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Profissão / Área de Atuação</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                        <Briefcase size={18} />
                                    </div>
                                    <select
                                        required
                                        id="profession"
                                        value={profession}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setProfession(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Selecione sua área</option>
                                        <option value="agricultor">Agricultor(a)</option>
                                        <option value="agronomo">Engenheiro(a) Agrônomo(a)</option>
                                        <option value="tecnico">Técnico(a) Agrícola</option>
                                        <option value="estudante">Estudante</option>
                                        <option value="consultor">Consultor(a)</option>
                                        <option value="outro">Outro</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                        <ChevronDown size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Email Field */}
                            <div className="sm:col-span-2 space-y-1.5">
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
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-agro-floresta/20 focus:border-agro-floresta transition-all text-sm shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-agro-floresta transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        required
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        placeholder="Mínimo de 6 caracteres"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
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
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Cadastrar'}
                        </button>

                        {/* Login Link */}
                        <div className="pt-6 text-center">
                            <p className="text-sm font-medium text-slate-500">
                                Já tem uma conta?{' '}
                                <button
                                    type="button"
                                    onClick={goToLogin}
                                    className="text-agro-floresta font-bold hover:text-emerald-700 transition-colors underline underline-offset-4 decoration-agro-floresta/30"
                                >
                                    Faça o login
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
            </div>
        </div>
    );
};

export default SignUpPage;
