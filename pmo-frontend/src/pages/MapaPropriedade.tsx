// src/pages/MapaPropriedade.tsx

import React, { useState, useEffect } from 'react';
import { Tractor, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getPmoDetails, fetchUserProperties } from '../services/pmoService';
import PropertyMap from '../components/PropertyMap/PropertyMap';

const MapaPropriedade: React.FC = () => {
    const { user } = useAuth();
    const [pmoId, setPmoId] = useState<string | null>(null);
    const [propriedadeId, setPropriedadeId] = useState<number | null>(null);
    const [nomePropriedade, setNomePropriedade] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                if (!user) {
                    setLoading(false);
                    return;
                }

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('pmo_ativo_id')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error("Erro ao carregar perfil:", profileError);
                }

                if (profile?.pmo_ativo_id) {
                    setPmoId(profile.pmo_ativo_id);

                    // Busca contexto completo
                    const result = await getPmoDetails(profile.pmo_ativo_id);

                    if (result.success && result.data?.propriedade_id) {
                        setPropriedadeId(result.data.propriedade_id);
                        setNomePropriedade(result.data.nomePropriedade || '');
                        console.log('📍 Contexto de Mapa:', result.data.nomePropriedade);
                    } else {
                        // Fallback logic preserved from previous fix
                        console.warn('[MapaPropriedade] PMO sem propriedade vinculada. Tentando fallback...');
                        const userProps = await fetchUserProperties(user.id);
                        if (userProps.success && userProps.data && userProps.data.length > 0) {
                            const firstProp = userProps.data[0];
                            console.log('📍 Contexto de Mapa (Fallback):', firstProp.nome);
                            setPropriedadeId(firstProp.id);
                            setNomePropriedade(firstProp.nome);
                        } else {
                            console.error('[MapaPropriedade] Falha crítica: Nenhuma propriedade encontrada.');
                        }
                    }
                }
            } catch (err) {
                console.error("Erro inesperado:", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [user]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[100vh]">
                <Loader2 className="animate-spin text-green-600 mb-2" size={40} />
                <span className="text-sm font-medium text-slate-500">Carregando mapa...</span>
            </div>
        );
    }

    if (!pmoId) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center">
                <AlertTriangle className="text-red-500 mb-4" size={48} />
                <h6 className="text-xl font-bold text-red-600 mb-2">
                    Nenhum Plano de Manejo Ativo encontrado.
                </h6>
                <p className="text-slate-500">
                    Por favor, selecione ou crie um plano no seu perfil.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-green-100 rounded-xl text-green-700">
                    <Tractor size={28} />
                </div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                    Mapa da Propriedade
                </h1>
            </div>

            {/* Exibir o nome da fazenda para confirmar que carregou */}
            {nomePropriedade && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold mb-6 rounded-xl flex items-center gap-3 shadow-sm shadow-emerald-600/5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Visualizando: {nomePropriedade}
                </div>
            )}

            <div className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100">
                <PropertyMap propriedadeId={propriedadeId} />
            </div>
        </div>
    );
};

export default MapaPropriedade;
