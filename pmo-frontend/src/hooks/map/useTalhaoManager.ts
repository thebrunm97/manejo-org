/**
 * @file useTalhaoManager.ts
 * @description Hook de orquestração para gerenciar talhões no mapa.
 * Desacopla a lógica de negócio (cálculo, persistência) da camada visual (Leaflet).
 */

import { useState, useEffect, useCallback } from 'react';
import { talhaoService, Talhao } from '../../services/talhaoService';
import { calculatePolygonArea } from '../../domain/geo/geoUtils';
import { GeoPoint } from '../../domain/geo/geoTypes';

export function useTalhaoManager(pmoId?: string | null, propriedadeId?: number | null) {
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    // Carrega talhões
    const loadTalhoes = useCallback(async () => {
        // Se temos propriedadeId, usamos ela como fonte da verdade (Suporta Convencional e Paralela)
        // Se não, tentamos pmoId (Legacy)
        if (!propriedadeId && !pmoId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            let data: Talhao[] = [];
            if (propriedadeId) {
                data = await talhaoService.getTalhoesByPropriedade(propriedadeId);
            } else if (pmoId) {
                data = await talhaoService.fetchByPmo(pmoId);
            }
            setTalhoes(data);
        } catch (err) {
            console.error("Erro ao carregar talhões:", err);
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    }, [pmoId, propriedadeId]);

    useEffect(() => {
        loadTalhoes();
    }, [loadTalhoes]);

    const addTalhao = async (coords: GeoPoint[], defaultName?: string): Promise<Talhao | null> => {
        setError(null);
        try {
            // 1. Usa Domain para calcular área
            const area = calculatePolygonArea(coords);

            // 2. Prepara nome
            const nome = defaultName || `Talhão ${talhoes.length + 1}`;

            // 3. Usa Service para salvar
            const newTalhao = await talhaoService.create({
                propriedade_id: propriedadeId ?? undefined, // ← Garante compatibility com Omit<Talhao, 'id'>
                geometria: coords,
                nome,
                area_hectares: area,
                cor: '#16a34a',
                cultura: 'Diversos'
            });

            // Atualiza estado local (optimistic update like, but with confirmed data)
            setTalhoes(prev => [...prev, newTalhao]);
            return newTalhao;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao criar talhão';
            setError(msg);
            return null;
        }
    };

    const removeTalhao = async (id: string | number): Promise<boolean> => {
        try {
            await talhaoService.delete(id.toString());
            setTalhoes(prev => prev.filter(t => Number(t.id) !== Number(id)));
            return true;
        } catch (err) {
            console.error("Erro ao deletar talhão:", err);
            setError('Erro ao remover talhão');
            return false;
        }
    };

    return { talhoes, loading, error, addTalhao, removeTalhao, refresh: loadTalhoes };
}
