// src/api.ts
import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { storageService } from './services/storage';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api', // URL base da nossa API Django
});

// Interceptor para adicionar o token de acesso a todas as requisições
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const token = await storageService.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Interceptor para lidar com tokens expirados e fazer o refresh
api.interceptors.response.use(
    (response: AxiosResponse) => {
        return response; // Se a resposta for bem-sucedida, apenas a retorna
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        // Se o erro for 401 e não for uma tentativa de refresh
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true; // Marca como uma tentativa de retry

            try {
                const refreshToken = await storageService.getItem('refresh_token');
                const response = await axios.post('http://127.0.0.1:8000/api/token/refresh/', {
                    refresh: refreshToken,
                });

                const newAccessToken = response.data.access;
                await storageService.setItem('access_token', newAccessToken);

                api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                if (originalRequest.headers) {
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                }

                return api(originalRequest);

            } catch (refreshError) {
                console.error("Refresh token inválido ou expirado. Deslogando...", refreshError);
                await storageService.removeItem('access_token');
                await storageService.removeItem('refresh_token');

                // Dispara um evento customizado para notificar a aplicação que a autenticação falhou de vez.
                window.dispatchEvent(new Event('auth-error'));

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
