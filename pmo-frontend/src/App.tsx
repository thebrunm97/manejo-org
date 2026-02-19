// src/App.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './routes/RouteGuard';
import { SCREENS } from './routes/routeNames'; // Imported as requested, useful for future refactoring or route matching
import DebugErrorBoundary from './components/DebugErrorBoundary';
import { useCadernoSync } from './hooks/offline/useCadernoSync';

// Layout
import DashboardLayout from './components/DashboardLayout';

// Páginas
import DashboardPage from './pages/DashboardPage';
import PmoFormPage from './pages/PmoFormPage';
import PmoDetailPage from './pages/PmoDetailPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import LandingPage from './pages/LandingPage';
import DiarioDeCampo from './components/DiarioDeCampo';
import PlanosManejoList from './pages/PlanosManejoList';
import MapaPropriedade from './pages/MapaPropriedade';
import MinhasCulturas from './pages/MinhasCulturas';
import DesignLab from './pages/DesignLab';
import { AdminRoute } from './routes/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import ChangelogPage from './pages/ChangelogPage';


const App: React.FC = () => {
    // Global Sync Hook - Runs in background
    useCadernoSync();

    return (
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
            </Route>

            {/* 404 - Página não encontrada */}
            <Route path="*" element={<h2>Página não encontrada</h2>} />
        </Routes>
    );
};

export default App;
