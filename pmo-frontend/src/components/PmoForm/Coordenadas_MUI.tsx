// src/components/PmoForm/Coordenadas_MUI.tsx
// Zero MUI — Tailwind + HTML nativo + lucide-react

import React, { useState, ChangeEvent } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface CoordenadasData {
    latitude?: string;
    longitude?: string;
    [key: string]: any;
}

interface CoordenadasMUIProps {
    data: CoordenadasData | null | undefined;
    onDataChange: (data: CoordenadasData) => void;
    errors?: Record<string, string>;
}

const CoordenadasMUI: React.FC<CoordenadasMUIProps> = ({ data, onDataChange, errors }) => {
    const [geoError, setGeoError] = useState<string>('');
    const [isFetching, setIsFetching] = useState<boolean>(false);

    const safeData = data || {};
    const safeErrors = errors || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onDataChange({ ...safeData, [e.target.name]: e.target.value });
    };

    const handleGetCoordinates = () => {
        if (!navigator.geolocation) {
            setGeoError('A Geolocalização não é suportada pelo seu navegador.');
            return;
        }

        setIsFetching(true);
        setGeoError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                onDataChange({
                    ...safeData,
                    latitude: latitude.toFixed(6),
                    longitude: longitude.toFixed(6),
                });
                setIsFetching(false);
            },
            (error) => {
                switch (error.code) {
                    case 1: setGeoError("Permissão para obter a localização foi negada."); break;
                    case 2: setGeoError("A informação de localização não está disponível."); break;
                    case 3: setGeoError("A requisição para obter a localização expirou."); break;
                    default: setGeoError("Ocorreu um erro desconhecido ao obter a localização."); break;
                }
                setIsFetching(false);
            }
        );
    };

    const inputClasses = (fieldName: string) =>
        `w-full rounded-md border shadow-sm px-3 py-2 text-sm outline-none
        ${safeErrors[fieldName]
            ? 'border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500'}`;

    return (
        <>
            {/* Botão de geolocalização */}
            <div className="flex justify-end mb-3">
                <button
                    type="button"
                    onClick={handleGetCoordinates}
                    disabled={isFetching}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300
                               text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-green-500 focus:ring-offset-1
                               disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                    {isFetching ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                    {isFetching ? 'Obtendo...' : 'Usar Localização'}
                </button>
            </div>

            {/* Grid de campos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">
                        Latitude <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="latitude"
                        name="latitude"
                        type="text"
                        value={safeData.latitude || ''}
                        onChange={handleChange}
                        required
                        className={inputClasses('latitude')}
                    />
                    {safeErrors.latitude && <p className="mt-1 text-xs text-red-500">{safeErrors.latitude}</p>}
                </div>
                <div>
                    <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">
                        Longitude <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="longitude"
                        name="longitude"
                        type="text"
                        value={safeData.longitude || ''}
                        onChange={handleChange}
                        required
                        className={inputClasses('longitude')}
                    />
                    {safeErrors.longitude && <p className="mt-1 text-xs text-red-500">{safeErrors.longitude}</p>}
                </div>
            </div>

            {/* Erro de geolocalização */}
            {geoError && (
                <p className="mt-2 text-xs text-red-500">{geoError}</p>
            )}
        </>
    );
};

export default CoordenadasMUI;
