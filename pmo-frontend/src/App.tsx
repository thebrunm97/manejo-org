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
const LiveChatMonitor = lazy(() => import('./pages/admin/LiveChatMonitor'));
const PropertyProfilePage = lazy(() => import('./pages/PropertyProfilePage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const TraceabilityPage = lazy(() => import('./pages/public/TraceabilityPage'));
const PublicTraceabilityPage = lazy(() => import('./pages/PublicTraceabilityPage'));
const OrganizacoesPage = lazy(() => import('./pages/coop/OrganizacoesPage'));
const OrganizacaoDetailsPage = lazy(() => import('./pages/coop/OrganizacaoDetailsPage'));
const FinanceiroPage = lazy(() => import('./pages/FinanceiroPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const CoopDashboardPage = lazy(() => import('./pages/coop/CoopDashboardPage'));
const CoopDemandasPage = lazy(() => import('./pages/coop/CoopDemandasPage'));
const MuralDemandas = lazy(() => import('./pages/MuralDemandas'));


const DiarioDeCampo = lazy(() => import('./components/DiarioDeCampo'));
const FarmHubPage = lazy(() => import('./pages/FarmHubPage'));
import { AdminRoute } from './routes/AdminRoute';
import { GestaoRoute } from './routes/GestaoRoute';
import { ModalityGuard } from './routes/ModalityGuard';
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
                <Route path="/trace/:codigoLote" element={<TraceabilityPage />} />
                <Route path="/t/:id" element={<PublicTraceabilityPage />} />


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

                    {/* Hub de Seleção Multi-Fazenda */}
                    <Route
                        path="/hub"
                        element={
                            <DebugErrorBoundary name="FarmHubPage">
                                <FarmHubPage />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* Onboarding Wizard */}
                    <Route
                        path="/onboarding"
                        element={
                            <DebugErrorBoundary name="OnboardingPage">
                                <OnboardingPage />
                            </DebugErrorBoundary>
                        }
                    />

                    <Route
                        path="/financeiro"
                        element={
                            <DebugErrorBoundary name="FinanceiroPage">
                                <FinanceiroPage />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* Redirect Logic */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    <Route
                        path="/perfil"
                        element={
                            <DebugErrorBoundary name="ProfilePage">
                                <ProfilePage />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* CONFIGURAÇÕES DA PROPRIEDADE */}
                    <Route
                        path="/propriedade"
                        element={
                            <DebugErrorBoundary name="PropertyProfilePage">
                                <PropertyProfilePage />
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

                    <Route
                        path="/mural"
                        element={
                            <DebugErrorBoundary name="MuralDemandas">
                                <MuralDemandas />
                            </DebugErrorBoundary>
                        }
                    />

                    {/* --- Rotas Restritas à Modalidade Orgânica/Paralela --- */}
                    <Route element={<ModalityGuard />}>
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

                    <Route
                        path="/mural"
                        element={
                            <DebugErrorBoundary name="MuralDemandas">
                                <MuralDemandas />
                            </DebugErrorBoundary>
                        }
                    />

                </Route>

                {/* Rotas de Gestão (Cooperativas/Associações) */}
                <Route element={<GestaoRoute />}>
                    <Route 
                        path="/coop/organizacoes" 
                        element={
                            <DebugErrorBoundary name="OrganizacoesPage">
                                <OrganizacoesPage />
                            </DebugErrorBoundary>
                        } 
                    />
                    <Route 
                        path="/coop/organizacao/:slug" 
                        element={
                            <DebugErrorBoundary name="OrganizacaoDetailsPage">
                                <OrganizacaoDetailsPage />
                            </DebugErrorBoundary>
                        } 
                    />
                    <Route 
                        path="/coop/organizacao/:slug/dashboard" 
                        element={
                            <DebugErrorBoundary name="CoopDashboardPage">
                                <CoopDashboardPage />
                            </DebugErrorBoundary>
                        } 
                    />
                    <Route 
                        path="/coop/organizacao/:slug/demandas" 
                        element={
                            <DebugErrorBoundary name="CoopDemandasPage">
                                <CoopDemandasPage />
                            </DebugErrorBoundary>
                        } 
                    />
                </Route>

                {/* Rotas Admin (Protected by Role) */}
                <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/chat" element={<LiveChatMonitor />} />
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
