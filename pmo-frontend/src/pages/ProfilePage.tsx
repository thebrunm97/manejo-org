import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Save, Camera, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile, updateUserProfile } from '../services/profileService';
import { formatPhoneBR } from '../utils/masks';
import DashboardLayout from '../components/DashboardLayout';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { toast } from 'react-toastify';

const ProfilePage: React.FC = () => {
    const { user } = useAuth();
    const { navigateTo } = useAppNavigation();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        nome: '',
        telefone: '',
        role: 'user',
        email: user?.email || ''
    });

    useEffect(() => {
        const loadProfile = async () => {
            if (!user?.id) return;

            try {
                const result = await fetchUserProfile(user.id);
                if (result.success && result.data) {
                    setFormData(prev => ({
                        ...prev,
                        nome: result.data?.nome || '',
                        telefone: formatPhoneBR(result.data?.telefone || ''),
                        role: (result.data as any).role || 'user'
                    }));
                }
            } catch (error) {
                console.error('Erro ao carregar perfil:', error);
                toast.error('Erro ao carregar dados do perfil');
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [user?.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === 'telefone') {
            setFormData(prev => ({ ...prev, [name]: formatPhoneBR(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        // Validação básica de telefone (mínimo 10 dígitos: (99) 9999-9999)
        const phoneDigits = formData.telefone.replace(/\D/g, '');
        if (phoneDigits.length > 0 && phoneDigits.length < 10) {
            toast.warning('O WhatsApp deve ter pelo menos 10 dígitos');
            return;
        }

        setSaving(true);
        try {
            const result = await updateUserProfile(user.id, {
                nome: formData.nome,
                telefone: phoneDigits
            });

            if (result.success) {
                toast.success('Perfil atualizado com sucesso!');
            } else {
                toast.error(result.error || 'Erro ao atualizar perfil');
            }
        } catch (error) {
            toast.error('Ocorreu um erro ao salvar as alterações');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-12">
            {/* Header with back button */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigateTo('home' as any)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Meu Perfil</h1>
                    <p className="text-slate-500">Gerencie suas informações e preferências de conta</p>
                </div>
            </div >

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Avatar & Role */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center relative overflow-hidden group">
                        {/* Decorative background element */}
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-green-500/10 to-emerald-500/5 -z-0"></div>

                        <div className="relative z-10">
                            <div className="relative inline-block mb-4">
                                <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-slate-100 flex items-center justify-center overflow-hidden mx-auto">
                                    <User size={64} className="text-slate-300" />
                                </div>
                                <button className="absolute bottom-0 right-0 p-2 bg-green-600 text-white rounded-full border-2 border-white shadow-lg hover:bg-green-700 transition-colors">
                                    <Camera size={16} />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-slate-900">{formData.nome || 'Usuário'}</h3>
                            <p className="text-slate-500 text-sm mb-4">{user?.email}</p>

                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                                <Shield size={12} />
                                {formData.role === 'admin' ? 'Administrador' : 'Produtor'}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Shield size={80} />
                        </div>
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Lock size={16} className="text-green-400" />
                            Segurança da Conta
                        </h4>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Suas informações são protegidas pelo Supabase Auth.
                            O tipo de conta é definido durante o cadastro.
                        </p>
                    </div>
                </div>

                {/* Right Column: Profile Form */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-8 space-y-6">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <label htmlFor="nome" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <User size={16} className="text-slate-400" />
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    id="nome"
                                    name="nome"
                                    value={formData.nome}
                                    onChange={handleChange}
                                    placeholder="Seu nome completo"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-slate-50/30"
                                />
                            </div>

                            {/* Email Input (Read-only) */}
                            <div className="space-y-2 opacity-80">
                                <label htmlFor="email" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Mail size={16} className="text-slate-400" />
                                    E-Mail
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        id="email"
                                        value={formData.email}
                                        readOnly
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <Lock size={14} className="text-slate-400" />
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 italic">E-mail gerido pelo fornecedor de login profissional.</p>
                            </div>

                            {/* WhatsApp Input */}
                            <div className="space-y-2">
                                <label htmlFor="telefone" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Phone size={16} className="text-slate-400" />
                                    WhatsApp
                                </label>
                                <input
                                    type="text"
                                    id="telefone"
                                    name="telefone"
                                    value={formData.telefone}
                                    onChange={handleChange}
                                    placeholder="(00) 00000-0000"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-slate-50/30"
                                />
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100 mt-2">
                                    <p className="text-xs text-green-700 leading-tight">
                                        <strong>Dica:</strong> Este é o número que a Inteligência Artificial reconhecerá quando você enviar mensagens de voz ou texto.
                                    </p>
                                </div>
                            </div>

                            {/* Account Type (Read-only) */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Shield size={16} className="text-slate-400" />
                                    Nível de Acesso
                                </label>
                                <input
                                    type="text"
                                    value={formData.role === 'admin' ? 'Administrador (Full Access)' : 'Produtor Orgânico'}
                                    readOnly
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className={`flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${saving ? 'animate-pulse' : ''}`}
                            >
                                {saving ? (
                                    <>Salvando...</>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Salvar Alterações
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
