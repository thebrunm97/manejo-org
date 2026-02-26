// src/context/AuthContext.tsx

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Session, Provider } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../domain/pmo/pmoTypes';

// Types
interface ProfileData {
    [key: string]: any;
}

interface AuthContextType {
    authToken: string | null;
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    isLoadingRole: boolean; // Novo estado exportado
    login: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
    logout: () => Promise<void>;
    signUp: (email: string, password: string, profileData?: ProfileData) => Promise<{ user: User | null; session: Session | null }>;
    loginWithGoogle: () => Promise<void>;
    loginWithFacebook: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    isAdmin: boolean;
}

interface AuthProviderProps {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        console.error('useAuth FAILED: Context is null. AuthProvider missing or multiple contexts?');
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isAdmin, setIsAdmin] = useState(false); // Direct state, not derived
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingRole, setIsLoadingRole] = useState(true); // Inicializa como true
    const navigate = useNavigate();
    const DASHBOARD_PATH = '/dashboard';



    // 2. Separate Profile Fetch (Display Data)
    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*') // Just standard data
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }
            return data as UserProfile;
        } catch (err) {
            console.error('Unexpected error fetching profile:', err);
            return null;
        }
    }, []);


    // 4. Auth Actions
    const login = useCallback(async (email: string, password: string) => {
        setIsLoadingRole(true); // Inicia verificação ao logar
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            setIsLoadingRole(false); // Falha no login, encerra
            throw error;
        }
        navigate(DASHBOARD_PATH);
        return data;
    }, [navigate]);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setAuthToken(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsLoadingRole(false); // Não é admin se não está logado
        navigate('/login');
    }, [navigate]);

    const signUp = useCallback(async (email: string, password: string, profileData?: ProfileData) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: profileData,
            }
        });
        if (error) throw error;
        return data;
    }, []);

    const socialLogin = useCallback(async (provider: Provider) => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) throw error;
    }, []);

    const loginWithGoogle = useCallback(() => socialLogin('google'), [socialLogin]);
    const loginWithFacebook = useCallback(() => socialLogin('facebook'), [socialLogin]);

    const refreshProfile = useCallback(async () => {
        if (user) {
            const p = await fetchProfile(user.id);
            if (p) setProfile(p);
        }
    }, [user, fetchProfile]);

    // 5. Auth State Management Effect
    useEffect(() => {
        let mounted = true;

        // Função que verifica a sessão E a role, só libertando a UI no final
        const loadSessionAndRole = async (session: Session | null) => {
            if (!session) {
                if (mounted) {
                    setAuthToken(null);
                    setUser(null);
                    setProfile(null);
                    setIsAdmin(false);
                    setIsLoadingRole(false);
                    setIsLoading(false);
                }
                return;
            }

            try {
                // Bloqueia a UI explicitamente até o DB responder
                const { data, error } = await supabase.rpc('is_admin');
                if (mounted) {
                    setIsAdmin(!!data && !error);
                }

                // Profile fetch
                const profileData = await fetchProfile(session.user.id);
                if (mounted && profileData) {
                    setProfile(profileData);
                }

            } catch (error) {
                console.error("Erro ao carregar permissões ou perfil:", error);
                if (mounted) setIsAdmin(false);
            } finally {
                // SÓ LIBERTA A UI AQUI, depois de ter 100% certeza de tudo!
                if (mounted) {
                    setIsLoadingRole(false);
                    setIsLoading(false);
                }
            }
        };

        // O onAuthStateChange do Supabase V2 dispara 'INITIAL_SESSION' automaticamente no load (F5)
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return;
                console.log(`[AuthContext] Auth Change: ${event}`);

                setAuthToken(session?.access_token ?? null);
                setUser(session?.user ?? null);

                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setIsLoading(true);     // Previne que a UI renderize sem saber a role
                    setIsLoadingRole(true); // Indica carregamento do painel admin
                    loadSessionAndRole(session);
                } else if (event === 'SIGNED_OUT') {
                    setAuthToken(null);
                    setUser(null);
                    setProfile(null);
                    setIsAdmin(false);
                    setIsLoadingRole(false);
                    setIsLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, [fetchProfile]);

    // Value Memo (Using direct isAdmin state)
    const value = useMemo<AuthContextType>(() => ({
        authToken, user, profile, isLoading, isLoadingRole,
        login, logout, signUp, loginWithGoogle, loginWithFacebook, refreshProfile,
        isAdmin // Direct State (Verified by RPC)
    }), [authToken, user, profile, isLoading, isLoadingRole, isAdmin, login, logout, signUp, loginWithGoogle, loginWithFacebook, refreshProfile]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium text-slate-500 animate-pulse">Carregando...</p>
            </div>
        );
    }

    console.log('AuthProvider: Rendering Provider with value:', value ? 'OK' : 'NULL');

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
