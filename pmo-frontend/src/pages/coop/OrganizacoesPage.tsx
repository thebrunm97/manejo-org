import React, { useEffect, useState } from 'react';
import { Plus, Building, Search, ArrowRight, Loader2 } from 'lucide-react';
import { getOrganizacoes, createOrganizacao } from '../../services/organizacaoService';
import { Organizacao, OrganizacaoTipo } from '../../domain/organizacao/orgTypes';
import { useAppNavigation } from '../../hooks/navigation/useAppNavigation';
import { toast } from 'react-toastify';

const OrganizacoesPage: React.FC = () => {
    const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Modal Form State
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgCnpj, setNewOrgCnpj] = useState('');
    const [newOrgTipo, setNewOrgTipo] = useState<OrganizacaoTipo>('cooperativa');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { goToCoopOrganizacaoDetails } = useAppNavigation();

    const loadOrganizacoes = async () => {
        setIsLoading(true);
        const res = await getOrganizacoes();
        if (res.success && res.data) {
            setOrganizacoes(res.data);
        } else {
            toast.error('Erro ao carregar organizações');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadOrganizacoes();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName) return;

        setIsSubmitting(true);
        const slug = newOrgName.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');

        const res = await createOrganizacao({
            nome: newOrgName,
            cnpj: newOrgCnpj || undefined,
            tipo: newOrgTipo,
            slug: slug
        });

        if (res.success) {
            toast.success('Organização criada com sucesso!');
            setIsModalOpen(false);
            setNewOrgName('');
            setNewOrgCnpj('');
            loadOrganizacoes();
        } else {
            toast.error('Erro ao criar: ' + res.error);
        }
        setIsSubmitting(false);
    };

    const filteredOrgs = organizacoes.filter(org => 
        org.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.cnpj?.includes(searchTerm)
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Carregando Cooperativas...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building className="w-7 h-7 text-emerald-600" />
                        Minhas Organizações
                    </h1>
                    <p className="text-slate-500">Gestão de Cooperativas, Associações e Grupos SPG</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
                >
                    <Plus className="w-5 h-5" />
                    Nova Organização
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
            </div>

            {/* Grid Area */}
            {filteredOrgs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOrgs.map((org) => (
                        <div
                            key={org.id}
                            onClick={() => goToCoopOrganizacaoDetails(org.slug || org.id.toString())}
                            className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Building className="w-16 h-16" />
                            </div>
                            
                            <div className="relative z-10">
                                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 mb-3">
                                    {org.tipo}
                                </span>
                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">
                                    {org.nome}
                                </h3>
                                <p className="text-sm text-slate-400 mb-4 font-mono">
                                    {org.cnpj || 'Sem CNPJ'}
                                </p>
                                
                                <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 pt-4 border-t border-slate-50 mt-auto">
                                    <span>Ver detalhes e membros</span>
                                    <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-600 mb-1">Nenhuma organização encontrada</h3>
                    <p className="text-slate-400">Tente buscar por outro termo ou crie uma nova organização.</p>
                </div>
            )}

            {/* Modal de Criação */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden scale-in-center">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">Nova Organização</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 flex flex-col gap-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Nome da Organização</label>
                                <input
                                    required
                                    type="text"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    placeholder="Ex: Cooperativa Agroecológica"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">CNPJ (Opcional)</label>
                                <input
                                    type="text"
                                    value={newOrgCnpj}
                                    onChange={(e) => setNewOrgCnpj(e.target.value)}
                                    placeholder="00.000.000/0000-00"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Tipo</label>
                                <select
                                    value={newOrgTipo}
                                    onChange={(e) => setNewOrgTipo(e.target.value as OrganizacaoTipo)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="cooperativa">Cooperativa</option>
                                    <option value="associacao">Associação</option>
                                    <option value="spg">SPG (Sist. Partic. Garantia)</option>
                                    <option value="grupo_informal">Grupo Informal</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 text-slate-500 font-semibold hover:bg-slate-100 rounded-2xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Agora'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizacoesPage;
