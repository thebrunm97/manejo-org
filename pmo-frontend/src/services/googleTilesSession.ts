// src/services/googleTilesSession.ts
// Cliente para o Google Maps Platform "Map Tiles API" (sessão de tiles de satélite).
// Docs: https://developers.google.com/maps/documentation/tile/session_tokens

export interface GoogleTilesSession {
    session: string;
    expiry: string;
    tileWidth: number;
    tileHeight: number;
    imageFormat: string;
}

const STORAGE_KEY = 'google-tiles-session-v1';
const CREATE_SESSION_URL = 'https://tile.googleapis.com/v1/createSession';

let inFlight: Promise<GoogleTilesSession | null> | null = null;

const isExpired = (session: GoogleTilesSession): boolean => {
    const expiryMs = Number(session.expiry) * 1000;
    if (!Number.isFinite(expiryMs)) return true;
    // Renova um pouco antes de expirar de fato.
    return Date.now() > expiryMs - 5 * 60 * 1000;
};

const readCached = (): GoogleTilesSession | null => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as GoogleTilesSession;
        if (isExpired(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
};

const writeCached = (session: GoogleTilesSession) => {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        /* sessionStorage indisponível (modo privado etc.) — segue sem cache */
    }
};

async function createSession(apiKey: string): Promise<GoogleTilesSession | null> {
    try {
        const response = await fetch(`${CREATE_SESSION_URL}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mapType: 'satellite',
                language: 'pt-BR',
                region: 'BR',
            }),
        });

        if (!response.ok) {
            console.error('[googleTilesSession] createSession falhou:', response.status, await response.text().catch(() => ''));
            return null;
        }

        const data = await response.json();
        if (!data?.session) return null;

        const session: GoogleTilesSession = {
            session: data.session,
            expiry: data.expiry,
            tileWidth: data.tileWidth ?? 256,
            tileHeight: data.tileHeight ?? 256,
            imageFormat: data.imageFormat ?? 'png',
        };
        writeCached(session);
        return session;
    } catch (err) {
        console.error('[googleTilesSession] Erro ao criar sessão de tiles:', err);
        return null;
    }
}

export function getGoogleSatelliteSession(): Promise<GoogleTilesSession | null> {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_TILES_KEY;
    if (!apiKey) return Promise.resolve(null);

    const cached = readCached();
    if (cached) return Promise.resolve(cached);

    if (!inFlight) {
        inFlight = createSession(apiKey).finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
}
