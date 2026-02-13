// src/pages/MapaPropriedade.tsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import AgricultureIcon from '@mui/icons-material/Agriculture';
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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!pmoId) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="error">
                    Nenhum Plano de Manejo Ativo encontrado.
                </Typography>
                <Typography variant="body2">
                    Por favor, selecione ou crie um plano no seu perfil.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: '800', mb: 2, color: '#1e293b' }}>
                Mapa da Propriedade
            </Typography>

            {/* Exibir o nome da fazenda para confirmar que carregou */}
            {nomePropriedade && (
                <div style={{ padding: '10px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold', marginBottom: '16px', borderRadius: '4px' }}>
                    Visualizando: {nomePropriedade}
                </div>
            )}

            <PropertyMap propriedadeId={propriedadeId} />
        </Box>
    );
};

export default MapaPropriedade;
