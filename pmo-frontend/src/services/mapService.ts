import { goApiFetch } from './goApiClient';

export type SatelliteTileResponse = {
  farmId: string;
  layer: "rgb" | "ndvi";
  period: { start: string; end: string; };
  tiles: string[];
  tileSize: 256;
  bounds: [number, number, number, number];
  opacity: number;
  metadata: {
    collection: string;
    imageCount: number;
    cloudThreshold: number;
    composite: string;
    generatedAt: string;
    expiresAt: string;
  };
};

const getMockSatelliteTiles = (
  farmId: string,
  layer: "rgb" | "ndvi",
  period: string,
): SatelliteTileResponse => {
  const tiles = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

  return {
    farmId,
    layer,
    period: {
      start: `${period}-01`,
      end: `${period}-28`, 
    },
    tiles,
    tileSize: 256,
    bounds: [-180, -85.051129, 180, 85.051129], 
    opacity: layer === "ndvi" ? 0.7 : 0.75,
    metadata: {
      collection: "MOCK — COPERNICUS/S2_SR_HARMONIZED",
      imageCount: Math.floor(Math.random() * 5) + 1,
      cloudThreshold: 20,
      composite: "median",
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    },
  };
};

export async function getSatelliteTiles(
  farmId: string,
  layer: "rgb" | "ndvi",
  period: string,
): Promise<SatelliteTileResponse> {
  if (import.meta.env.VITE_USE_GEE_MOCK === "true") {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return getMockSatelliteTiles(farmId, layer, period);
  }

  const response = await goApiFetch(
    `/api/v1/maps/tiles?farmId=${encodeURIComponent(farmId)}&layer=${layer}&date=${period}`
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar a camada de monitoramento.");
  }

  const data = await response.json();
  
  return {
    farmId,
    layer,
    period: {
      start: `${period}-01`,
      end: `${period}-28`, 
    },
    tiles: [data.urlFormat],
    tileSize: 256,
    bounds: [-180, -85.051129, 180, 85.051129], 
    opacity: layer === "ndvi" ? 0.7 : 0.75,
    metadata: {
      collection: "COPERNICUS/S2_SR_HARMONIZED",
      imageCount: 0,
      cloudThreshold: 20,
      composite: "median",
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    },
  };
}

// --- Estatística zonal (NDVI médio por talhão) ---

export type ZonalStatus = "ok" | "sem_imagem" | "erro";

export type ZonalTalhaoResult = {
  id: string;
  /** Média de NDVI (-1 a 1). Nulo quando status != "ok". */
  ndvi: number | null;
  /** Pixels válidos usados na média. Zero significa nuvem, não vegetação fraca. */
  pixels: number;
  status: ZonalStatus;
  detail?: string;
};

export type ZonalResponse = {
  date: string;
  period: { start: string; end: string };
  results: ZonalTalhaoResult[];
};

export type ZonalTalhaoInput = {
  id: string;
  geometry: { type: string; coordinates: number[][][] };
};

/**
 * Calcula o NDVI médio dentro de cada talhão para o período informado.
 *
 * O cálculo é sob demanda: cada talhão vira uma consulta ao Earth Engine, então
 * a resposta leva alguns segundos e a chamada só deve acontecer quando o usuário
 * pede a camada NDVI — nunca no carregamento do mapa.
 */
export async function getZonalNDVI(
  talhoes: ZonalTalhaoInput[],
  period: string,
): Promise<ZonalResponse> {
  const response = await goApiFetch(`/api/v1/maps/zonal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: period, talhoes }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível calcular o NDVI por talhão.");
  }

  return response.json();
}
