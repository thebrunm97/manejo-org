import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Building, Users, UserPlus, Trash2, ArrowLeft, Loader2, Search, MapPin, Scale, TrendingUp, Plus, ClipboardList } from 'lucide-react';
import { getMembros, addMembro, removeMembro, getOrganizacaoBySlug } from '../../services/organizacaoService';
import { fetchAllPropriedades } from '../../services/propriedadeService'; // Reaproveitando busca global
import { Organizacao } from '../../domain/organizacao/orgTypes';
import { Propriedade } from '../../domain/pmo/pmoTypes';
import { useAppNavigation } from '../../hooks/navigation/useAppNavigation';
import { SCREENS } from '../../routes/routeNames';
import { toast } from 'react-toastify';

const OrganizacaoDetailsPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const { goBack, navigateTo } = useAppNavigation();

    const [organizacao, setOrganizacao] = useState<Organizacao | null>(null);
    const [membros, setMembros] = useState<any[]>([]);
    const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // Member Linking State
    const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
    const [availablePropriedades, setAvailablePropriedades] = useState<Propriedade[]>([]);
    const [propSearchTerm, setPropSearchTerm] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [propToUnlink, setPropToUnlink] = useState<number | null>(null);

    const loadData = async () => {
        if (!slug) return;
        setIsLoading(true);
        
        try {
            const orgRes = await getOrganizacaoBySlug(slug);
            if (orgRes.success && orgRes.data) {
                setOrganizacao(orgRes.data);
                
                // Buscamos membros usando o ID real
                const membrosRes = await getMembros(orgRes.data.id);
                if (membrosRes.success) {
                    const listaMembros = membrosRes.data || [];
                    setMembros(listaMembros);

                    // Buscar nomes dos perfis
                    const userIds = listaMembros
                        .map((m: any) => m.propriedades?.user_id)
                        .filter(Boolean);
                    
                    if (userIds.length > 0) {
                        const { data: profs } = await supabase
                            .from('profiles')
                            .select('id, nome')
                            .in('id', userIds);
                        
                        if (profs) {
                            const map: Record<string, string> = {};
                            profs.forEach(p => map[p.id] = p.nome);
                            setProfilesMap(map);
                        }
                    }
                }
            } else {
                toast.error('Organização não encontrada');
            }
        } catch (err) {
            toast.error('Erro ao carregar dados');
        }
        
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [slug]);

    const loadPropriedades = async () => {
        // Obter todas as propriedades (contexto administrativo pode precisar de ajuste global, mas para MVP usamos as do user se ele for o gestor)
        // Em um CRM real, buscaríamos propriedades via RPC global se for Super Admin, ou apenas as acessíveis.
        // Simulando busca do Juarez (User ID fixo ou logado)
        // Aqui assumimos que o gestor pode ver as propriedades para vincular
        const res = await fetchAllPropriedades(''); // Passando vazio para buscar (pode precisar de ajuste no RLS)
        setAvailablePropriedades(res || []);
    };

    useEffect(() => {
        if (isLinkingModalOpen) {
            loadPropriedades();
        }
    }, [isLinkingModalOpen]);

    const handleLinkPropriedade = async (propId: number) => {
        if (!organizacao) return;
        setIsLinking(true);
        const res = await addMembro(organizacao.id, propId);
        if (res.success) {
            toast.success('Propriedade vinculada com sucesso!');
            setIsLinkingModalOpen(false);
            loadData();
        } else {
            toast.error('Erro ao vincular: Já é membro ou erro técnico.');
        }
        setIsLinking(false);
    };

    const confirmUnlink = (propId: number) => {
        setPropToUnlink(propId);
    };

    const executeUnlink = async () => {
        if (!organizacao || !propToUnlink) return;
        
        const res = await removeMembro(organizacao.id, propToUnlink);
        if (res.success) {
            toast.success('Vínculo removido');
            loadData();
        } else {
            toast.error('Erro ao desvincular');
        }
        setPropToUnlink(null);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Carregando detalhes da organização...</p>
            </div>
        );
    }

    if (!organizacao) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500">Organização não encontrada.</p>
                <button onClick={goBack} className="mt-4 text-emerald-600 font-semibold">Voltar</button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="mb-8">
                <button 
                    onClick={goBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para lista
                </button>
                
                <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                            <Building className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 mb-2">
                                {organizacao.tipo}
                            </span>
                            <h1 className="text-3xl font-bold text-slate-800">{organizacao.nome}</h1>
                            <p className="text-slate-400 font-mono text-sm mt-1">{organizacao.cnpj || 'CNPJ não informado'}</p>
                        </div>
                    </div>
                    
                        <button
                            onClick={() => slug && navigateTo(SCREENS.COOP_DASHBOARD, { slug })}
                            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-3 rounded-2xl font-bold transition-all group"
                        >
                            <TrendingUp className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                            Painel de Controle
                        </button>

                        <button
                            onClick={() => slug && navigateTo(SCREENS.COOP_DEMANDAS, { slug })}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-md group"
                        >
                            <ClipboardList className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                            Gerenciar Demandas
                        </button>
                        
                        <button
                            onClick={() => setIsLinkingModalOpen(true)}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-md"
                        >
                            <UserPlus className="w-5 h-5" />
                            Vincular Propriedade
                        </button>
                </div>
            </div>

            {/* Members Section */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <Users className="w-6 h-6 text-emerald-600" />
                    <h2 className="text-xl font-bold text-slate-800">Propriedades Associadas</h2>
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">
                        {membros.length} propriedades
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {membros.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Propriedade</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Dono</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Área Total</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {membros.map((membro: any) => {
                                    const prop = membro.propriedades;
                                    
                                    return (
                                        <tr key={membro.propriedade_id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                                        <MapPin className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-bold text-slate-700">{prop?.nome || 'Sem Nome'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-slate-500 font-medium">{profilesMap[prop?.user_id] || 'Não identificado'}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-slate-700">{prop?.area_total_ha || 0} ha</span>
                                                    <Scale className="w-3 h-3 text-emerald-200" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <button
                                                    onClick={() => confirmUnlink(membro.propriedade_id)}
                                                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Remover propriedade"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-16 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Users className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-400 mb-2">Nenhuma propriedade vinculada</h3>
                            <button
                                onClick={() => setIsLinkingModalOpen(true)}
                                className="text-emerald-600 font-bold hover:underline"
                            >
                                Vincular agora
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Vínculo de Propriedade */}
            {isLinkingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Vincular Propriedade</h2>
                                <p className="text-xs text-slate-400 uppercase tracking-tighter font-bold">Base de Propriedades Disponíveis</p>
                            </div>
                            <button onClick={() => setIsLinkingModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="relative mb-6">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Burcar por nome da propriedade..."
                                    value={propSearchTerm}
                                    onChange={(e) => setPropSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2 p-1">
                                {availablePropriedades
                                    .filter(p => !membros.some(m => m.propriedade_id === p.id))
                                    .filter(p => p.nome.toLowerCase().includes(propSearchTerm.toLowerCase()))
                                    .map(prop => (
                                        <button
                                            key={prop.id}
                                            onClick={() => handleLinkPropriedade(prop.id)}
                                            disabled={isLinking}
                                            className="flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                                    <MapPin className="w-5 h-5 text-emerald-600" />
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="font-bold text-slate-700 group-hover:text-emerald-700">{prop.nome}</h4>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">{prop.area_total_ha} hectares</span>
                                                </div>
                                            </div>
                                            <UserPlus className="w-5 h-5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))
                                }
                                {availablePropriedades.length === 0 && (
                                    <div className="text-center py-8 text-slate-400">Nenhuma propriedade disponível no sistema.</div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setIsLinkingModalOpen(false)}
                                className="px-6 py-2 text-slate-500 font-bold"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Desvínculo */}
            {propToUnlink !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center scale-in-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Desvincular Propriedade</h3>
                        <p className="text-slate-500 mb-6 text-sm">Deseja realmente desvincular esta propriedade da organização? Esta ação pode ser desfeita vinculando-a novamente depois.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setPropToUnlink(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors w-full"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeUnlink}
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors w-full"
                            >
                                Desvincular
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizacaoDetailsPage;
