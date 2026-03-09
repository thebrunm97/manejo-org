// src/App.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './routes/RouteGuard';
import DebugErrorBoundary from './components/DebugErrorBoundary';
import { useSyncEngine } from './hooks/offline/useSyncEngine';
import { Suspense, lazy } from 'react';

// Layout
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Páginas (Lazy Loaded)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PmoFormPage = lazy(() => import('./pages/PmoFormPage'));
const PmoDetailPage = lazy(() => import('./pages/PmoDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PlanosManejoList = lazy(() => import('./pages/PlanosManejoList'));
const MapaPropriedade = lazy(() => import('./pages/MapaPropriedade'));
const MinhasCulturas = lazy(() => import('./pages/MinhasCulturas'));
const DesignLab = lazy(() => import('./pages/DesignLab'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const KnowledgeMonitoringPage = lazy(() => import('./pages/admin/KnowledgeMonitoringPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));

const DiarioDeCampo = lazy(() => import('./components/DiarioDeCampo'));
import { AdminRoute } from './routes/AdminRoute';
import ReloadPrompt from './components/ReloadPrompt';

const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
    </div>
);

const App: React.FC = () => {
    // Global Sync Hook - Runs in background
    useSyncEngine();

    return (
        <Suspense fallback={<LoadingFallback />}>
            <Routes>

                {/* Rota de Debug (Visibilidade) - Acesso Livre (Híbrido) */}
                <Route path="/lab" element={<DesignLab />} />
                <Route path="/changelog" element={<ChangelogPage />} />


                {/* Landing Page - Acesso Híbrido (Logado ou Não) */}
                <Route path="/home" element={<LandingPage />} />
                <Route path="/" element={<Navigate to="/home" replace />} />

                {/* Rotas Públicas (Apenas Usuários NÃO Logados) */}
                <Route element={<RouteGuard isPrivate={false} />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/cadastro" element={<SignUpPage />} />
                </Route>

                {/* Rotas Protegidas (Apenas Usuários Logados) */}
                {/* 
               RouteGuard agora já fornece o DashboardLayout via Outlet.
            */}
                <Route element={<RouteGuard isPrivate={true} />}>

                    {/* Redirect Logic */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* PERFIL */}
                    <Route
                        path="/perfil"
                        element={
                            <DebugErrorBoundary name="ProfilePage">
                                <ProfilePage />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* VISÃO GERAL (HOME - Now /dashboard) */}
                    <Route
                        path="/dashboard"
                        element={
                            <DebugErrorBoundary name="DashboardPage">
                                <DashboardPage />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* PLANOS DE MANEJO (PMO_LIST) */}
                    <Route
                        path="/planos"
                        element={
                            <DebugErrorBoundary name="PlanosManejoList">
                                <PlanosManejoList />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* MAPA (MAP) */}
                    <Route
                        path="/mapa"
                        element={
                            <DebugErrorBoundary name="MapaPropriedade">
                                <MapaPropriedade />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* CADERNO DE CAMPO (NOTEBOOK) */}
                    <Route
                        path="/caderno"
                        element={
                            <DebugErrorBoundary name="DiarioDeCampo">
                                <DiarioDeCampo />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* MINHAS CULTURAS (CROPS) */}
                    <Route
                        path="/culturas"
                        element={
                            <DebugErrorBoundary name="MinhasCulturas">
                                <MinhasCulturas />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* --- Rotas PMO (Create/Edit/Detail) --- */}

                    {/* Novo Plano */}
                    <Route
                        path="/pmo/novo"
                        element={<PmoFormPage />}
                    />

                    {/* Editar Plano */}
                    <Route
                        path="/pmo/:pmoId/editar"
                        element={<PmoFormPage />}
                    />

                    {/* Detalhes do Plano */}
                    <Route
                        path="/pmo/:pmoId"
                        element={
                            <DebugErrorBoundary name="PmoDetailPage">
                                <PmoDetailPage />
                            </DebugErrorBoundary>
                        }
                    />



                </Route>

                {/* Rotas Admin (Protected by Role) */}
                <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/conhecimento" element={<KnowledgeMonitoringPage />} />
                </Route>

                {/* 404 - Página não encontrada */}
                <Route path="*" element={<h2>Página não encontrada</h2>} />
            </Routes>
            <ToastContainer position="bottom-right" theme="colored" pauseOnHover />
            <ReloadPrompt />
        </Suspense>
    );
};

export default App;
