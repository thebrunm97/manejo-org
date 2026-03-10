import L from 'leaflet';

if (typeof window !== 'undefined') {
    window.L = L;
}

import 'leaflet-draw';

// Leaflet-draw attaches itself to the L object.
// We return the L object as the default export to satisfy react-leaflet-draw.
export default L;
