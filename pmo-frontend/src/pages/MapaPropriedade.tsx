// src/pages/MapaPropriedade.tsx

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getPmoDetails } from '../services/pmoService';
import { fetchUserProperties } from '../services/profileService';
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

                    const result = await getPmoDetails(profile.pmo_ativo_id);

                    if (result.success && result.data?.propriedade_id) {
                        setPropriedadeId(result.data.propriedade_id);
                        setNomePropriedade(result.data.nomePropriedade || '');
                    } else {
                        console.warn('[MapaPropriedade] PMO sem propriedade vinculada. Tentando fallback...');
                        const userProps = await fetchUserProperties(user.id);
                        if (userProps.success && userProps.data && userProps.data.length > 0) {
                            const firstProp = userProps.data[0];
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
            <div className="flex flex-col items-center justify-center h-screen w-full bg-white">
                <Loader2 className="animate-spin text-green-600 mb-2" size={40} />
                <span className="text-sm font-medium text-slate-500">Carregando mapa...</span>
            </div>
        );
    }

    if (!pmoId) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-white p-8 text-center">
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
        <div className="flex h-screen w-full overflow-hidden">
            <PropertyMap
                propriedadeId={propriedadeId}
                nomePropriedade={nomePropriedade}
            />
        </div>
    );
};

export default MapaPropriedade;
