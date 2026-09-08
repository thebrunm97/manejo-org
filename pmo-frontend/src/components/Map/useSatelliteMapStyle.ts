// src/components/Map/useSatelliteMapStyle.ts
import { useEffect, useState } from 'react';
import { getGoogleSatelliteSession } from '../../services/googleTilesSession';
import { ESRI_SATELLITE_STYLE } from './mapStyles';

export type SatelliteProvider = 'loading' | 'google' | 'esri';

interface SatelliteMapStyleResult {
    style: typeof ESRI_SATELLITE_STYLE | ReturnType<typeof buildGoogleStyle>;
    provider: SatelliteProvider;
    usingFallback: boolean;
}

function buildGoogleStyle(session: { session: string; tileWidth: number; tileHeight: number }, apiKey: string) {
    const tileUrl = `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session.session)}&key=${encodeURIComponent(apiKey)}`;
    return {
        version: 8 as const,
        sources: {
            'google-satellite': {
                type: 'raster' as const,
                tiles: [tileUrl],
                tileSize: session.tileWidth || 256,
                attribution: '© Google',
            },
        },
        layers: [
            {
                id: 'satellite',
                type: 'raster' as const,
                source: 'google-satellite',
                minzoom: 0,
                maxzoom: 20,
            },
        ],
    };
}

export function useSatelliteMapStyle(): SatelliteMapStyleResult {
    const [provider, setProvider] = useState<SatelliteProvider>('loading');
    const [style, setStyle] = useState<SatelliteMapStyleResult['style']>(ESRI_SATELLITE_STYLE);

    useEffect(() => {
        let cancelled = false;
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_TILES_KEY;

        if (!apiKey) {
            setProvider('esri');
            setStyle(ESRI_SATELLITE_STYLE);
            return;
        }

        getGoogleSatelliteSession().then((session) => {
            if (cancelled) return;
            if (session) {
                setStyle(buildGoogleStyle(session, apiKey));
                setProvider('google');
            } else {
                setStyle(ESRI_SATELLITE_STYLE);
                setProvider('esri');
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return { style, provider, usingFallback: provider === 'esri' };
}

export function maxZoomForProvider(provider: SatelliteProvider): number {
    return provider === 'google' ? 20 : 19;
}
