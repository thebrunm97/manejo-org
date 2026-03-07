// src/context/AuthContext.tsx

import { createContext, useState, useContext, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
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
    const currentUserRef = useRef<string | null>(null);
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

    // 3. Admin RPC Check
    const checkAdminRPC = useCallback(async (): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('is_admin');
            return !!data && !error;
        } catch {
            return false;
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

        // Helper interno — fire-and-forget para não bloquear o callback síncrono do Supabase
        const handleSessionLoad = async (session: Session) => {
            currentUserRef.current = session.user.id;
            setAuthToken(session.access_token);
            setUser(session.user);
            // Libera a UI IMEDIATAMENTE — não espera o RPC
            if (mounted) setIsLoading(false);

            setIsLoadingRole(true);
            try {
                // Admin check e profile fetch em paralelo
                const [adminStatus] = await Promise.all([
                    checkAdminRPC(),
                    fetchProfile(session.user.id).then(p => { if (mounted && p) setProfile(p); }),
                ]);
                if (mounted) {
                    setIsAdmin(adminStatus);
                    console.log(`[AuthContext] Admin Status Set: ${adminStatus}`);
                }
            } catch (err) {
                console.error('[AuthContext] Erro ao carregar role/perfil:', err);
                if (mounted) setIsAdmin(false);
            } finally {
                // SEMPRE garante que o loading é desativado
                if (mounted) setIsLoadingRole(false);
            }
        };

        // NÃO usar callback async — Supabase V2 não aguarda a promise
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            console.log(`[AuthContext] Auth Change: ${event}`);

            if (event === 'SIGNED_OUT' || !session) {
                setAuthToken(null);
                setUser(null);
                setProfile(null);
                setIsAdmin(false);
                setIsLoadingRole(false);
                setIsLoading(false);
                currentUserRef.current = null;
                return;
            }

            if (event === 'TOKEN_REFRESHED') {
                console.log('[AuthContext] Token refreshed. Updating state.');
                setAuthToken(session.access_token);
                return;
            }

            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                // Previne re-load ao voltar de outra aba (foco na aba)
                if (event === 'SIGNED_IN' && currentUserRef.current === session.user.id) {
                    console.log('[AuthContext] Ignorando SIGNED_IN (foco na aba), utilizador já carregado.');
                    return;
                }
                // Fire-and-forget
                handleSessionLoad(session);
            }
        });

        // Fallback: garante que isLoading/isLoadingRole são desativados se não há sessão
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && mounted) {
                setIsLoading(false);
                setIsLoadingRole(false);
            }
        });

        return () => {
            mounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, [fetchProfile, checkAdminRPC]);

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
