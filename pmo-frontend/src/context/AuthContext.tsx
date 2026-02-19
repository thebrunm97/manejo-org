// src/context/AuthContext.tsx

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, ReactNode } from 'react';
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

    // 1. Helper: Check Token Expiry
    const isTokenExpired = useCallback((session: Session | null): boolean => {
        if (!session?.expires_at) return false;
        // expires_at is a Unix timestamp (seconds since epoch)
        const expiresAt = session.expires_at * 1000; // Convert to milliseconds
        const now = Date.now();
        const bufferMs = 60 * 1000; // 1 minute buffer before actual expiry
        return now >= (expiresAt - bufferMs);
    }, []);

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

    // 3. Separate Admin Check (Critical Security) - SECURITY DEFINER RPC
    const checkAdminRPC = useCallback(async () => {
        const MAX_RETRIES = 2;

        for (let i = 0; i <= MAX_RETRIES; i++) {
            console.log(`[AuthContext] Checking Admin RPC (Attempt ${i + 1}/${MAX_RETRIES + 1})...`);

            try {
                // 5s timeout per attempt
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('RPC Timeout')), 5000);
                });

                const { data, error } = await Promise.race([
                    supabase.rpc('is_admin'),
                    timeoutPromise
                ]) as any;

                if (error) throw error;

                console.log('[AuthContext] RPC Success:', data);
                return !!data; // Success
            } catch (err) {
                console.warn(`[AuthContext] Attempt ${i + 1} failed:`, err);
                if (i < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                }
            }
        }

        console.error('[AuthContext] All RPC attempts failed. Defaulting to FALSE.');
        return false;
    }, []);

    // 4. Auth Actions
    const login = async (email: string, password: string) => {
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
    };

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setAuthToken(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsLoadingRole(false); // Não é admin se não está logado
        navigate('/login');
    }, [navigate]);

    const signUp = async (email: string, password: string, profileData?: ProfileData) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: profileData,
            }
        });
        if (error) throw error;
        return data;
    };

    const socialLogin = async (provider: Provider) => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) throw error;
    };

    const loginWithGoogle = useCallback(() => socialLogin('google'), []);
    const loginWithFacebook = useCallback(() => socialLogin('facebook'), []);

    const refreshProfile = useCallback(async () => {
        if (user) {
            const p = await fetchProfile(user.id);
            if (p) setProfile(p);
        }
    }, [user, fetchProfile]);

    // 5. Auth State Management Effect
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            console.log('[AuthContext] Initializing Auth...');
            setIsLoadingRole(true); // Garante que começa true

            try {
                // Check active session
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    if (isTokenExpired(session)) {
                        console.warn('⚠️ Token expirado detectado no inicio. Forçando logout...');
                        await supabase.auth.signOut();
                        if (mounted) {
                            setAuthToken(null);
                            setUser(null);
                            setProfile(null);
                            setIsAdmin(false);
                            setIsLoading(false);
                            setIsLoadingRole(false);
                        }
                        return;
                    }

                    if (mounted) {
                        setAuthToken(session.access_token);
                        setUser(session.user);

                        // CRITICAL: Wait for Admin Check
                        console.log('[AuthContext] Session found. Checking Admin...');
                        try {
                            const adminStatus = await checkAdminRPC(); // This waits!
                            if (mounted) {
                                setIsAdmin(adminStatus);
                                console.log(`[AuthContext] Admin Status Set: ${adminStatus}`);
                            }
                        } finally {
                            if (mounted) setIsLoadingRole(false); // Finaliza loadingRole
                        }

                        if (mounted) {
                            // Fetch Profile in Background (Doesn't block UI)
                            fetchProfile(session.user.id).then(p => {
                                if (mounted && p) setProfile(p);
                            });
                        }
                    }
                } else {
                    console.log('[AuthContext] No active session found.');
                    if (mounted) setIsLoadingRole(false); // Sem sessão, não está carregando role
                }
            } catch (error) {
                console.error("Auth check failed", error);
                if (mounted) setIsLoadingRole(false); // Erro, para loading
            } finally {
                if (mounted) {
                    console.log('[AuthContext] Loading finished.');
                    setIsLoading(false);
                }
            }
        };

        // Run check
        initAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            console.log(`[AuthContext] Auth Change: ${event}`);

            if (session) {
                // If we are already loaded and just refreshing token, don't full reset
                if (event === 'TOKEN_REFRESHED') {
                    console.log('[AuthContext] Token refreshed. Updating state.');
                    setAuthToken(session.access_token);
                    // We don't strictly need to re-check admin on every refresh unless we suspect revocation
                    return;
                }

                if (event === 'SIGNED_IN') {
                    // Start role check loading specifically for sign-in event
                    setIsLoadingRole(true);

                    setAuthToken(session.access_token);
                    setUser(session.user);

                    // If we just signed in, check admin again to be safe
                    try {
                        const adminStatus = await checkAdminRPC();
                        if (mounted) setIsAdmin(adminStatus);
                    } finally {
                        if (mounted) setIsLoadingRole(false); // Terminou check
                    }

                    fetchProfile(session.user.id).then(p => {
                        if (mounted && p) setProfile(p);
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                setAuthToken(null);
                setUser(null);
                setProfile(null);
                setIsAdmin(false);
                setIsLoadingRole(false);
                setIsLoading(false); // Ensure we aren't stuck loading
            }
        });

        return () => {
            mounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, [isTokenExpired, fetchProfile, checkAdminRPC]);

    // Value Memo (Using direct isAdmin state)
    const value = useMemo<AuthContextType>(() => ({
        authToken, user, profile, isLoading, isLoadingRole,
        login, logout, signUp, loginWithGoogle, loginWithFacebook, refreshProfile,
        isAdmin // Direct State (Verified by RPC)
    }), [authToken, user, profile, isLoading, isLoadingRole, isAdmin, login, logout, signUp, loginWithGoogle, loginWithFacebook, refreshProfile]);

    if (isLoading) {
        return (
            <div style={{ padding: 20, textAlign: 'center', backgroundColor: '#f0f0f0', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2>Carregando Autenticação...</h2>
                <p>Verifique o console se isso demorar.</p>
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
