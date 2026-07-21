import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Leaf, MapPin, User, Calendar, ShieldCheck, Box } from 'lucide-react';

interface TraceabilityData {
    produto: string;
    data_operacao: string | null;
    fazenda_nome: string;
    municipio: string | null;
    estado: string | null;
    produtor_nome: string | null;
    cooperativa_nome: string | null;
    tipo_atividade: string;
}

const PublicTraceabilityPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<TraceabilityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRastreabilidade = async () => {
            if (!id) return;
            try {
                const { data: result, error: rpcError } = await supabase.rpc('get_rastreabilidade_publica', {
                    p_registro_id: id
                });

                if (rpcError) throw rpcError;
                if (!result) throw new Error('Registro não encontrado.');

                setData(result as TraceabilityData);
            } catch (err: any) {
                console.error(err);
                setError('Não foi possível carregar as informações deste produto. O código pode ser inválido.');
            } finally {
                setLoading(false);
            }
        };

        fetchRastreabilidade();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-xl shadow-sm text-center max-w-sm w-full">
                    <div className="bg-red-100 text-red-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Box size={32} />
                    </div>
                    <h2 className="text-xl font-semibold text-neutral-800 mb-2">Ops!</h2>
                    <p className="text-neutral-600">{error}</p>
                </div>
            </div>
        );
    }

    // Format date beautifully using native Intl
    const formattedDate = data.data_operacao 
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(data.data_operacao))
        : 'Data não informada';

    return (
        <div className="min-h-screen bg-neutral-50 font-sans text-neutral-800 flex justify-center">
            {/* Mobile Container */}
            <div className="w-full max-w-md bg-white shadow-xl min-h-screen flex flex-col relative overflow-hidden">
                
                {/* Header Background */}
                <div className="bg-emerald-600 pt-10 pb-20 px-6 rounded-b-[40px] shadow-md relative z-10">
                    <div className="flex items-center space-x-2 text-emerald-50 bg-emerald-700/50 w-fit px-3 py-1 rounded-full text-sm font-medium mb-6">
                        <ShieldCheck size={16} />
                        <span>Alimento Rastreado e Seguro</span>
                    </div>
                    
                    <h1 className="text-3xl font-bold text-white mb-1 leading-tight">
                        {data.produto || 'Produto Agrícola'}
                    </h1>
                    <p className="text-emerald-100 flex items-center text-sm">
                        <Leaf size={14} className="mr-1" /> Cultivo {data.tipo_atividade === 'Colheita' ? 'Colhido' : 'Registrado'}
                    </p>
                </div>

                {/* Content Area overlaying the header */}
                <div className="px-6 -mt-12 relative z-20 flex-grow pb-10">
                    
                    {/* Producer Card */}
                    <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-5 mb-6">
                        <div className="flex items-center space-x-4 mb-4">
                            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                <User size={28} />
                            </div>
                            <div>
                                <h3 className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Quem Produziu</h3>
                                <p className="text-lg font-bold text-neutral-800 leading-tight">
                                    {data.produtor_nome || 'Produtor Rural'}
                                </p>
                                {data.cooperativa_nome && (
                                    <p className="text-sm text-emerald-600 font-medium mt-0.5">
                                        {data.cooperativa_nome}
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        <hr className="border-neutral-100 my-4" />

                        <div className="flex items-start space-x-3">
                            <MapPin size={20} className="text-neutral-400 mt-0.5" />
                            <div>
                                <p className="font-semibold text-neutral-700">{data.fazenda_nome || 'Propriedade'}</p>
                                <p className="text-neutral-500 text-sm">
                                    {[data.municipio, data.estado].filter(Boolean).join(' - ')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <h3 className="text-lg font-bold text-neutral-800 mb-4 ml-1">Linha do Tempo</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5">
                        <div className="relative border-l-2 border-emerald-200 ml-3 pl-6 py-2 space-y-6">
                            
                            {/* Action Point */}
                            <div className="relative">
                                <div className="absolute -left-[33px] bg-emerald-100 border-4 border-white h-5 w-5 rounded-full mt-1"></div>
                                <div className="absolute -left-[27px] bg-emerald-500 h-2 w-2 rounded-full mt-2.5"></div>
                                
                                <h4 className="font-semibold text-neutral-800">
                                    {data.tipo_atividade || 'Operação'}
                                </h4>
                                <div className="flex items-center text-sm text-neutral-500 mt-1">
                                    <Calendar size={14} className="mr-1" />
                                    <span>{formattedDate}</span>
                                </div>
                            </div>
                            
                            <div className="relative opacity-60">
                                <div className="absolute -left-[33px] bg-neutral-200 border-4 border-white h-5 w-5 rounded-full mt-1"></div>
                                
                                <h4 className="font-semibold text-neutral-600">Origem Rastreada</h4>
                                <div className="flex items-center text-sm text-neutral-500 mt-1">
                                    <ShieldCheck size={14} className="mr-1" />
                                    <span>Sistema Manejo<span className="text-emerald-700 font-bold">Org</span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Brand */}
                <div className="text-center py-6 mt-auto">
                    <p className="text-xs text-neutral-400 font-medium">Tecnologia por</p>
                    <p className="text-sm font-bold text-emerald-700">Manejo<span className="text-agro-ouro">Org</span></p>
                </div>
            </div>
        </div>
    );
};

export default PublicTraceabilityPage;
