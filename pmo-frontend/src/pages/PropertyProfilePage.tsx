import React, { useState, useEffect } from 'react';
import { Home, MapPin, FileText, Calendar, Layers, Save, ArrowLeft, Info, Landmark, Shield, CheckCircle2, ChevronRight, Users, Building2, Trash2, CloudDownload, Loader2 as Spinner } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { fetchPropriedade, updatePropriedade, getPropriedadeMetrics, deletePropriedade } from '../services/propriedadeService';
import { fetchPropriedadeOrganizacoes } from '../services/organizacaoService';
import { OrganizacaoMembro } from '../domain/organizacao/orgTypes';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import { toast } from 'react-toastify';
import { SCREENS } from '../routes/routeNames';
import { cn } from '../utils/cn';
import { exportarBackupPropriedade } from '../services/backupService';

// --- SKELETON COMPONENT ---
const PropertyProfileSkeleton = () => (
    <div className="max-w-5xl mx-auto pb-16 px-4 animate-pulse">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-200 rounded-full" />
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-slate-200 rounded-md" />
                    <div className="h-4 w-64 bg-slate-100 rounded-md" />
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
                <div className="h-64 bg-slate-100 rounded-[2.5rem]" />
                <div className="h-40 bg-slate-100 rounded-[2.5rem]" />
            </div>
            <div className="lg:col-span-8 h-[600px] bg-slate-100 rounded-[2.5rem]" />
        </div>
    </div>
);

import { ModalidadeProducao } from '../domain/pmo/pmoTypes';

const PropertyProfilePage: React.FC = () => {
    const { currentPropriedade, refreshProfile, role, pmoAtivoId, user } = useAuth();
    const { navigateTo } = useAppNavigation();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'documentacao' | 'localizacao' | 'organizacoes' | 'danger' | 'seguranca'>('geral');
    const [metrics, setMetrics] = useState<{ area_total_ha: number; total_talhoes: number } | null>(null);
    const [orgs, setOrgs] = useState<OrganizacaoMembro[]>([]);

    const [limiteTransacao, setLimiteTransacao] = useState<number>(50000);
    const [limiteManejo, setLimiteManejo] = useState<number>(5000);
    const [loadingLimites, setLoadingLimites] = useState(false);

    const isAuthorized = role === 'admin' || (currentPropriedade && user && currentPropriedade.user_id === user.id);

    const [formData, setFormData] = useState({
        nome: '',
        car: '',
        inscricao_estadual: '',
        matricula: '',
        endereco_cadastral: '',
        modalidade_predominante: 'ORGANICO' as ModalidadeProducao,
        tem_producao_paralela: false
    });

    useEffect(() => {
        const loadData = async () => {
            if (!currentPropriedade?.id) {
                setLoading(false);
                return;
            }

            try {
                const [propResult, metricsResult, orgsResult] = await Promise.all([
                    fetchPropriedade(currentPropriedade.id),
                    getPropriedadeMetrics(currentPropriedade.id),
                    fetchPropriedadeOrganizacoes(currentPropriedade.id)
                ]);

                if (propResult.success && propResult.data) {
                    setFormData({
                        nome: propResult.data.nome || '',
                        car: propResult.data.car || '',
                        inscricao_estadual: propResult.data.inscricao_estadual || '',
                        matricula: propResult.data.matricula || '',
                        endereco_cadastral: propResult.data.endereco_cadastral || '',
                        modalidade_predominante: (propResult.data.modalidade_predominante as ModalidadeProducao) || 'ORGANICO',
                        tem_producao_paralela: propResult.data.tem_producao_paralela || false
                    });
                }

                if (metricsResult.success) {
                    setMetrics(metricsResult.data);
                }

                if (orgsResult.success) {
                    setOrgs(orgsResult.data || []);
                }

                if (pmoAtivoId) {
                    setLoadingLimites(true);
                    const { data: limitesData, error: limitesError } = await supabase
                        .from('limites_seguranca')
                        .select('limite_transacao, limite_manejo')
                        .eq('propriedade_id', currentPropriedade.id)
                        .eq('pmo_id', parseInt(pmoAtivoId))
                        .maybeSingle();

                    if (limitesError) {
                        console.error('Erro ao buscar limites de segurança:', limitesError);
                    } else if (limitesData) {
                        setLimiteTransacao(Number(limitesData.limite_transacao));
                        setLimiteManejo(Number(limitesData.limite_manejo));
                    } else {
                        // Fallback padrão se não houver registro no banco
                        setLimiteTransacao(50000);
                        setLimiteManejo(5000);
                    }
                    setLoadingLimites(false);
                } else {
                    setLimiteTransacao(50000);
                    setLimiteManejo(5000);
                }
            } catch (error) {
                console.error('Erro ao carregar dados da propriedade:', error);
                toast.error('Erro ao carregar dados da propriedade');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentPropriedade?.id, pmoAtivoId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectOption = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPropriedade?.id) return;

        setSaving(true);
        try {
            if (activeTab === 'seguranca') {
                if (!isAuthorized) {
                    toast.error('Apenas administradores ou o dono da propriedade podem alterar as configurações de segurança.');
                    setSaving(false);
                    return;
                }

                if (!pmoAtivoId) {
                    toast.error('Nenhum PMO ativo encontrado.');
                    setSaving(false);
                    return;
                }

                const { error: upsertError } = await supabase
                    .from('limites_seguranca')
                    .upsert({
                        propriedade_id: currentPropriedade.id,
                        pmo_id: parseInt(pmoAtivoId),
                        limite_transacao: limiteTransacao,
                        limite_manejo: limiteManejo,
                    }, { onConflict: 'propriedade_id,pmo_id' });

                if (upsertError) {
                    console.error('Erro ao salvar limites de segurança:', upsertError);
                    toast.error('Erro ao salvar os limites de segurança.');
                } else {
                    toast.success('Limites de segurança atualizados com sucesso!');
                }
                setSaving(false);
                return;
            }

            const result = await updatePropriedade(currentPropriedade.id, {
                nome: formData.nome,
                car: formData.car,
                inscricao_estadual: formData.inscricao_estadual,
                matricula: formData.matricula,
                endereco_cadastral: formData.endereco_cadastral,
                modalidade_predominante: formData.modalidade_predominante,
                tem_producao_paralela: formData.tem_producao_paralela
            });

            if (result.success) {
                toast.success('Propriedade atualizada com sucesso!');
                await refreshProfile(); // Refresh global context
            } else {
                toast.error(result.error || 'Erro ao atualizar propriedade');
            }
        } catch (error) {
            toast.error('Ocorreu um erro ao salvar as alterações');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePropriedade = async () => {
        if (!currentPropriedade?.id) return;
        
        setDeleting(true);
        try {
            const result = await deletePropriedade(currentPropriedade.id);
            if (result.success) {
                toast.success('Propriedade excluída permanentemente!');
                await refreshProfile(); // Recarrega perfil (vai limpar propriedade ativa)
                navigateTo(SCREENS.HOME); // Volta pro Dashboard/Hub
            } else {
                toast.error(result.error || 'Erro ao excluir propriedade');
            }
        } catch (error) {
            toast.error('Erro inesperado ao excluir');
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleExportBackup = async () => {
        if (!currentPropriedade?.id) return;

        setBackingUp(true);
        try {
            const result = await exportarBackupPropriedade(currentPropriedade.id, formData.nome || currentPropriedade.nome);
            if (result.success) {
                toast.success('Backup gerado e download iniciado!', {
                    icon: <span>💾</span>
                });
            } else {
                toast.error(result.error || 'Falha ao gerar backup');
            }
        } catch (error) {
            toast.error('Erro ao processar backup');
        } finally {
            setBackingUp(false);
        }
    };

    if (loading) return <PropertyProfileSkeleton />;

    if (!currentPropriedade) {
        return (
            <div className="text-center py-20 px-6">
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Home size={40} className="text-slate-300" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Nenhuma propriedade selecionada</h2>
                <p className="text-slate-500 font-medium mb-8">Selecione uma propriedade no hub para gerenciar seus dados.</p>
                <button 
                  onClick={() => navigateTo(SCREENS.HOME)}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                >
                  Ir para Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-24 md:pb-16 px-4">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigateTo(SCREENS.HOME)}
                        className="p-3 hover:bg-white bg-slate-50 border border-slate-200 rounded-2xl transition-all text-slate-600 hover:shadow-md active:scale-95"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight italic leading-tight">Perfil da Propriedade</h1>
                        <p className="text-slate-500 text-sm font-bold bg-slate-100 inline-block px-2 py-0.5 rounded-md mt-1 italic uppercase tracking-tighter">Dados Mestre & Compliance</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-2 text-sm font-black shadow-sm">
                        <Calendar size={16} />
                        Safra 2026/27
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Metrics Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Home size={140} />
                        </div>
                        
                        <div className="relative z-10 space-y-8">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Atalhos de Gestão</h3>
                                
                                <div className="space-y-4">
                                    <button 
                                        onClick={() => navigateTo(SCREENS.HOME)}
                                        className="w-full flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-emerald-50 hover:border-emerald-100 transition-all group text-left"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                            <MapPin size={22} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Área Explorada</p>
                                            <p className="text-lg font-black text-slate-800 tracking-tight">
                                                {metrics?.area_total_ha.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-400 italic">HA</span>
                                            </p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500" />
                                    </button>

                                    <button 
                                        onClick={() => navigateTo(SCREENS.MAP)}
                                        className="w-full flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:border-blue-100 transition-all group text-left"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                            <Layers size={22} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Talhões Ativos</p>
                                            <p className="text-lg font-black text-slate-800 tracking-tight">
                                                {metrics?.total_talhoes} <span className="text-xs font-bold text-slate-400 italic">TALHÕES</span>
                                            </p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[2.2rem] p-6 text-white relative overflow-hidden group">
                                <div className="absolute -bottom-6 -right-6 opacity-20 transform group-hover:scale-110 transition-transform duration-700">
                                    <Shield size={100} />
                                </div>
                                <h4 className="text-sm font-black mb-1.5 tracking-tight flex items-center gap-2">
                                    <Shield size={14} className="text-emerald-400" /> 
                                    Compliance
                                </h4>
                                <p className="text-slate-400 text-[10px] leading-relaxed font-medium mb-0 italic">
                                    Status de certificação orgânica e dados cadastrais protegidos.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Form Content with Tabs */}
                <div className="lg:col-span-8 flex flex-col h-full">
                    {/* Tab Selector */}
                    <div className="flex p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl mb-6 self-start border border-slate-200/50">
                        <button
                            type="button"
                            onClick={() => setActiveTab('geral')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
                                activeTab === 'geral' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            GERAL
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('documentacao')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
                                activeTab === 'documentacao' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            LEGAL
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('localizacao')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
                                activeTab === 'localizacao' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            LOCAL
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('organizacoes')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
                                activeTab === 'organizacoes' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            ORGANIZAÇÕES
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('seguranca')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
                                activeTab === 'seguranca' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            LIMITES DO ASSISTENTE
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('danger')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
                                activeTab === 'danger' ? "bg-red-600 text-white shadow-sm" : "text-red-500 hover:text-red-700 hover:bg-red-50"
                            )}
                        >
                            DANGER ZONE
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-visible flex flex-col h-full border-b-[8px] border-b-emerald-600 mb-20 md:mb-0">
                        <div className="p-8 md:p-10 space-y-10 flex-1">
                            {activeTab === 'geral' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* Prop Name */}
                                    <div className="space-y-3">
                                        <label htmlFor="nome" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            Nome da Propriedade
                                        </label>
                                        <input
                                            type="text"
                                            id="nome"
                                            name="nome"
                                            value={formData.nome}
                                            onChange={handleChange}
                                            required
                                            placeholder="Ex: Fazenda Santa Fé"
                                            className="w-full px-6 py-4.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 text-lg font-bold text-slate-800"
                                        />
                                    </div>

                                    {/* Modalidade Radio Cards */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Modalidade de Produção
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {[
                                                { id: 'ORGANICO', label: '100% Orgânico', icon: <Layers size={20} className="text-emerald-500" />, desc: 'Certificação plena e exclusividade orgânica.' },
                                                { id: 'CONVENCIONAL', label: 'Convencional', icon: <Layers size={20} className="text-slate-400" />, desc: 'Manejo tradicional sem selo orgânico.' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => handleSelectOption('modalidade_predominante', opt.id)}
                                                    className={cn(
                                                        "flex flex-col items-start p-5 rounded-3xl border-2 transition-all text-left group",
                                                        formData.modalidade_predominante === opt.id 
                                                            ? "border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10 shadow-md shadow-emerald-500/10" 
                                                            : "border-slate-100 bg-white hover:border-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between w-full mb-3">
                                                        <div className={cn("p-2 rounded-xl transition-colors", formData.modalidade_predominante === opt.id ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200")}>
                                                            {opt.icon}
                                                        </div>
                                                        {formData.modalidade_predominante === opt.id && <CheckCircle2 size={20} className="text-emerald-600" />}
                                                    </div>
                                                    <p className="font-black text-slate-900 tracking-tight mb-1">{opt.label}</p>
                                                    <p className="text-[11px] font-medium text-slate-500 leading-tight italic">{opt.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Produção Paralela Toggle Cards */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Gestão Multi-Modality
                                            </label>
                                            {formData.tem_producao_paralela && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-black">PRODUÇÃO PARALELA ATIVA</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleSelectOption('tem_producao_paralela', false)}
                                                className={cn(
                                                    "flex items-center gap-4 p-5 rounded-3xl border-2 transition-all group",
                                                    !formData.tem_producao_paralela 
                                                        ? "border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/5" 
                                                        : "border-slate-100 bg-white hover:border-slate-300"
                                                )}
                                            >
                                                <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all", !formData.tem_producao_paralela ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white group-hover:border-slate-400")}>
                                                    {!formData.tem_producao_paralela && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-black text-slate-900 tracking-tight">Modalidade Única</p>
                                                    <p className="text-[11px] text-slate-500 italic font-medium leading-none mt-1">Todos os talhões iguais.</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectOption('tem_producao_paralela', true)}
                                                className={cn(
                                                    "flex items-center gap-4 p-5 rounded-3xl border-2 transition-all group",
                                                    formData.tem_producao_paralela 
                                                        ? "border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/5" 
                                                        : "border-slate-100 bg-white hover:border-slate-300"
                                                )}
                                            >
                                                <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all", formData.tem_producao_paralela ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white group-hover:border-slate-400")}>
                                                    {formData.tem_producao_paralela && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-black text-slate-900 tracking-tight">Híbrida / Paralela</p>
                                                    <p className="text-[11px] text-slate-500 italic font-medium leading-none mt-1">Orgânico + Convencional.</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'documentacao' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* Grid for Legal Docs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label htmlFor="car" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <FileText size={14} className="text-emerald-500" /> Cadastro Ambiental Rural (CAR)
                                            </label>
                                            <input
                                                type="text"
                                                id="car"
                                                name="car"
                                                value={formData.car}
                                                onChange={handleChange}
                                                placeholder="UF-9999999-XXXX.XXXX.XXXX"
                                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 font-bold text-slate-800"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label htmlFor="inscricao_estadual" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Landmark size={14} className="text-blue-500" /> Inscrição Estadual
                                            </label>
                                            <input
                                                type="text"
                                                id="inscricao_estadual"
                                                name="inscricao_estadual"
                                                value={formData.inscricao_estadual}
                                                onChange={handleChange}
                                                placeholder="Nº da IE"
                                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 font-bold text-slate-800"
                                            />
                                        </div>

                                        <div className="space-y-3 md:col-span-2">
                                            <label htmlFor="matricula" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Shield size={14} className="text-orange-500" /> Registro de Matrícula (Escritura)
                                            </label>
                                            <input
                                                type="text"
                                                id="matricula"
                                                name="matricula"
                                                value={formData.matricula}
                                                onChange={handleChange}
                                                placeholder="Número da Matrícula"
                                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100 flex items-start gap-4 shadow-sm italic">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shrink-0 shadow-sm">
                                            <Info size={20} />
                                        </div>
                                        <p className="text-xs text-orange-800 font-medium leading-relaxed">
                                            Certifique-se que o CAR e a IE estão atualizados conforme os dados da secretária de agricultura do seu estado para validade dos certificados orgânicos.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'localizacao' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="space-y-3">
                                        <label htmlFor="endereco_cadastral" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Endereço Completo / Sede
                                        </label>
                                        <textarea
                                            id="endereco_cadastral"
                                            name="endereco_cadastral"
                                            value={formData.endereco_cadastral}
                                            onChange={handleChange}
                                            rows={4}
                                            placeholder="Ex: Rodovia PR-444, Km 12 - Zona Rural"
                                            className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 font-bold text-slate-800 resize-none"
                                        />
                                    </div>

                                    <div className="relative rounded-[2.5rem] overflow-hidden border border-slate-200 h-64 bg-slate-50 flex flex-col items-center justify-center group cursor-pointer hover:shadow-xl transition-all" onClick={() => navigateTo(SCREENS.MAP)}>
                                        <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/-49.2733,-25.4284,13/800x400?access_token=pk_test')] bg-center bg-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                                        <div className="relative z-10 flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-transform group-hover:scale-110">
                                                <MapPin size={32} />
                                            </div>
                                            <p className="text-white font-black tracking-tight text-sm drop-shadow-md uppercase">Ver no Mapa Interativo</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'organizacoes' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[400px]">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                            <Building2 size={20} className="text-emerald-600" />
                                            Vínculos Organizacionais
                                        </h3>
                                    </div>

                                    {orgs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 px-6 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                                                <Users size={32} />
                                            </div>
                                            <p className="text-slate-800 font-black tracking-tight mb-2">Sem Organizações</p>
                                            <p className="text-slate-500 text-sm font-medium italic text-center max-w-xs">
                                                Você ainda não faz parte de nenhuma cooperativa ou associação vinculada a esta propriedade.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {orgs.map((membro) => (
                                                <div 
                                                    key={membro.organizacao_id}
                                                    className="flex items-center gap-4 p-5 rounded-3xl bg-white border border-slate-200 hover:border-emerald-200 transition-all group"
                                                >
                                                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                                        <Building2 size={24} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-black text-slate-800 truncate">{membro.organizacao?.nome}</p>
                                                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold uppercase tracking-tighter">
                                                                {membro.organizacao?.tipo}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-medium italic">
                                                            {membro.role.charAt(0).toUpperCase() + membro.role.slice(1)} desde {new Date(membro.data_filiacao).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                    <div className="hidden sm:block">
                                                        <CheckCircle2 size={20} className="text-emerald-500" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 flex items-start gap-4 shadow-sm italic">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shrink-0 shadow-sm">
                                            <Info size={20} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-blue-800 font-bold leading-tight">
                                                Gestão da Cooperativa
                                            </p>
                                            <p className="text-[11px] text-blue-700/80 font-medium leading-relaxed">
                                                A vinculação à organizações é gerenciada pela administração. Se precisar alterar seus vínculos, entre em contato com o suporte da cooperativa.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'seguranca' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="border-b border-slate-100 pb-4">
                                        <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                            <Shield size={20} className="text-emerald-600" />
                                            Segurança e IA
                                        </h3>
                                        <p className="text-slate-500 text-xs italic mt-1 font-medium">
                                            Defina os limites de segurança operacionais para as interações do assistente virtual da sua propriedade.
                                        </p>
                                    </div>

                                    {!isAuthorized && (
                                        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 flex items-start gap-4 shadow-sm italic">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shrink-0 shadow-sm">
                                                <Shield size={20} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-amber-800 font-bold leading-tight">
                                                    Acesso Restrito
                                                </p>
                                                <p className="text-[11px] text-amber-700/80 font-medium leading-relaxed">
                                                    Você não tem permissão para editar os limites de segurança desta propriedade. Apenas administradores ou o proprietário têm autorização de escrita.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label htmlFor="limite_transacao" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                Limite de Transação (R$)
                                            </label>
                                            <input
                                                type="number"
                                                id="limite_transacao"
                                                name="limite_transacao"
                                                value={limiteTransacao}
                                                onChange={(e) => setLimiteTransacao(parseFloat(e.target.value) || 0)}
                                                disabled={!isAuthorized || loadingLimites}
                                                required
                                                placeholder="Ex: 50000"
                                                className="w-full px-6 py-4.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 text-lg font-bold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                            <p className="text-slate-400 text-[10px] italic font-medium leading-relaxed">
                                                Valor máximo determinístico permitido por transação financeira. Exceder este limite disparará um aviso de segurança. (Padrão: R$ 50.000,00).
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <label htmlFor="limite_manejo" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                Limite de Manejo (kg ou L)
                                            </label>
                                            <input
                                                type="number"
                                                id="limite_manejo"
                                                name="limite_manejo"
                                                value={limiteManejo}
                                                onChange={(e) => setLimiteManejo(parseFloat(e.target.value) || 0)}
                                                disabled={!isAuthorized || loadingLimites}
                                                required
                                                placeholder="Ex: 5000"
                                                className="w-full px-6 py-4.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all bg-slate-50/30 text-lg font-bold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                            <p className="text-slate-400 text-[10px] italic font-medium leading-relaxed">
                                                Quantidade máxima determinística permitida por registro de insumo/manejo. Exceder este limite disparará um aviso de segurança. (Padrão: 5.000 kg/L).
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 flex items-start gap-4 shadow-sm italic">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                                            <Info size={20} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-emerald-800 font-bold leading-tight">
                                                Funcionamento dos Guardrails
                                            </p>
                                            <p className="text-[11px] text-emerald-700/80 font-medium leading-relaxed">
                                                Esses valores parametrizam o Avaliador Global em Go. Se nenhuma configuração customizada for definida aqui, os limites padrão de R$ 50.000,00 e 5.000 kg/L serão aplicados automaticamente.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'danger' && (
                                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                    {/* Premium Backup Section */}
                                    <div className="bg-slate-900 rounded-[2rem] border border-slate-700 p-8 flex flex-col items-center text-center relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 transition-transform group-hover:scale-125 duration-700">
                                            <CloudDownload size={120} className="text-white" />
                                        </div>
                                        
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 bg-emerald-500 text-[10px] font-black text-white rounded-md uppercase tracking-tighter shadow-lg shadow-emerald-500/20">Plano Safra</span>
                                            </div>
                                            <h3 className="text-xl font-black text-white tracking-tight mb-2 uppercase italic">Exportação de Segurança</h3>
                                            <p className="text-slate-400 text-sm font-medium mb-8 max-w-sm">
                                                Antes de excluir, descarregue todo o histórico de talhões, financeiro e diário de campo num ficheiro JSON padrão.
                                            </p>
                                            
                                            <button 
                                                type="button"
                                                disabled={backingUp}
                                                onClick={handleExportBackup}
                                                className={cn(
                                                    "w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-3 active:scale-95",
                                                    backingUp && "opacity-80 cursor-wait"
                                                )}
                                            >
                                                {backingUp ? (
                                                    <>
                                                        <Spinner size={20} className="animate-spin" />
                                                        Gerando Backup...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CloudDownload size={20} />
                                                        Exportar Backup Completo
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-red-50 rounded-[2rem] border-2 border-red-100 p-8 flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-6 shadow-sm ring-8 ring-red-50">
                                            <Trash2 size={40} />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2 uppercase italic">Aviso de Exclusão</h3>
                                        <p className="text-slate-600 text-sm font-medium mb-8 max-w-sm">
                                            A exclusão é irreversível. Todos os dados vinculados (talhões, histórico de manejo e financeiro) serão perdidos.
                                        </p>
                                        
                                        {!showDeleteConfirm ? (
                                            <button 
                                                type="button"
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95 flex items-center gap-2 group"
                                            >
                                                Excluir Propriedade Permanentemente
                                            </button>
                                        ) : (
                                            <div className="space-y-4 w-full max-w-sm">
                                                <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-4">Você tem certeza absoluta?</p>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setShowDeleteConfirm(false)}
                                                        className="flex-1 px-6 py-4 bg-slate-200 text-slate-700 rounded-2xl font-black hover:bg-slate-300 transition-all"
                                                    >
                                                        Não, Cancelar
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        disabled={deleting}
                                                        onClick={handleDeletePropriedade}
                                                        className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all shadow-xl shadow-red-600/30 flex items-center justify-center gap-2"
                                                    >
                                                        {deleting ? 'Excluindo...' : 'Sim, Excluir'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Info size={14} /> Nota Técnica
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                                            Se esta propriedade possui planos de manejo ativos enviados à cooperativa, a exclusão pode ser bloqueada para preservar o histórico de compliance. Em caso de dúvidas, consulte o administrador.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sticky Footer for Mobile / Static for Desktop */}
                        <div className={cn(
                            "p-6 md:p-8 bg-white md:bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex items-center justify-between",
                            "fixed bottom-0 left-0 w-full z-50 md:relative md:w-auto md:z-auto shadow-[0_-8px_30px_rgb(0,0,0,0.08)] md:shadow-none transition-all duration-300",
                            activeTab === 'danger' && "hidden md:flex" // Hide save button on mobile when in danger zone
                        )}>
                            <div className="hidden md:flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
                                <Info size={14} /> Dados Mestre Protegidos
                            </div>
                            <button
                                type="submit"
                                disabled={saving || (activeTab === 'seguranca' && !isAuthorized)}
                                className={cn(
                                    "w-full md:w-auto flex items-center justify-center gap-3 px-12 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black tracking-tight transition-all hover:shadow-2xl hover:shadow-emerald-500/40 disabled:opacity-50 active:scale-[0.98] group",
                                    saving && "animate-pulse",
                                    (activeTab === 'danger' || (activeTab === 'seguranca' && !isAuthorized)) && "opacity-20 pointer-events-none" // Disable save if in danger zone or unauthorized
                                )}
                            >
                                {saving ? (
                                    <>Sincronizando...</>
                                ) : (
                                    <>
                                        <Save size={20} className="group-hover:scale-110 transition-transform" />
                                        {activeTab === 'seguranca' ? 'Salvar Limites' : 'Salvar Dados Mestre'}
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

export default PropertyProfilePage;
