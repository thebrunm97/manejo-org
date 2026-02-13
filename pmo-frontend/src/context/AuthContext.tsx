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
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        navigate(DASHBOARD_PATH);
        return data;
    };

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setAuthToken(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
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

        const checkUser = async () => {
            try {
                // Check active session
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    if (isTokenExpired(session)) {
                        console.warn('⚠️ Token expirado detectado. Forçando logout...');
                        await supabase.auth.signOut();
                        if (mounted) {
                            setAuthToken(null);
                            setUser(null);
                            setProfile(null);
                            setIsAdmin(false);
                            setIsLoading(false);
                        }
                        return;
                    }

                    if (mounted) {
                        // 1. Set basic auth state immediately
                        setAuthToken(session.access_token);
                        setUser(session.user);

                        // 2. CRITICAL: Check Admin Status BEFORE unblocking UI
                        const adminStatus = await checkAdminRPC();
                        if (mounted) setIsAdmin(adminStatus);

                        // 3. Unblock UI now that we know Role and User
                        if (mounted) setIsLoading(false);

                        // 4. Fetch Profile in Background
                        fetchProfile(session.user.id).then(p => {
                            if (mounted && p) {
                                console.log('AuthContext: Profile loaded (Role Synced).');
                                setProfile(p);
                            }
                        }).catch(err => {
                            console.error('AuthContext: Background profile fetch failed', err);
                        });

                        return;
                    }
                }
            } catch (error) {
                console.error("Auth check failed", error);
            }

            // Fallback: If no session or error, finish loading
            if (mounted) setIsLoading(false);
        };

        // Run check
        checkUser();

        // Safety Timeout (Increased to 10s)
        const timeoutId = setTimeout(() => {
            if (mounted && isLoading) {
                console.warn('AuthContext: Timeout. Unblocking.');
                setIsLoading(false);
            }
        }, 10000);

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (session) {
                if (isTokenExpired(session)) {
                    await supabase.auth.signOut();
                    setAuthToken(null);
                    setUser(null);
                    setProfile(null);
                    setIsAdmin(false);
                    navigate('/login', { replace: true });
                    return;
                }

                setAuthToken(session.access_token);
                setUser(session.user);

                // On any auth event (SIGNED_IN, TOKEN_REFRESHED, etc.), re-check admin
                console.log(`[AuthContext] onAuthStateChange: event=${event}, re-checking admin...`);
                const adminStatus = await checkAdminRPC();
                if (mounted) setIsAdmin(adminStatus);

                fetchProfile(session.user.id).then(p => {
                    if (mounted && p) setProfile(p);
                });

                if (event === 'SIGNED_IN') {
                    if (window.location.hash && window.location.hash.includes('access_token')) {
                        window.history.replaceState(null, '', window.location.pathname);
                        if (window.location.pathname !== DASHBOARD_PATH) {
                            navigate(DASHBOARD_PATH, { replace: true });
                        }
                    }
                }

            } else if (event === 'SIGNED_OUT') {
                setAuthToken(null);
                setUser(null);
                setProfile(null);
                setIsAdmin(false);
            }
        });

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            authListener?.subscription.unsubscribe();
        };
    }, [navigate, isTokenExpired, fetchProfile, checkAdminRPC]);

    // Value Memo (Using direct isAdmin state)
    const value = useMemo<AuthContextType>(() => ({
        authToken, user, profile, isLoading,
        login, logout, signUp, loginWithGoogle, loginWithFacebook, refreshProfile,
        isAdmin // Direct State (Verified by RPC)
    }), [authToken, user, profile, isLoading, isAdmin, login, logout, signUp, loginWithGoogle, loginWithFacebook, refreshProfile]);

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
