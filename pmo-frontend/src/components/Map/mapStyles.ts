export const ESRI_SATELLITE_STYLE = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};
