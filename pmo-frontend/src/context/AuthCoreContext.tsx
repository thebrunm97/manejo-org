import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface AuthCoreContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    signIn: (email: string, pass: string) => Promise<{ error: any }>;
    signUp: (email: string, pass: string, metadata: any) => Promise<{ error: any }>;
    loginWithGoogle: () => Promise<void>;
    loginWithFacebook: () => Promise<void>;
}

const AuthCoreContext = createContext<AuthCoreContextType | undefined>(undefined);

export function AuthCoreProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, pass: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        return { error };
    }, []);

    const signUp = useCallback(async (email: string, pass: string, metadata: any) => {
        const { error } = await supabase.auth.signUp({ 
            email, 
            password: pass,
            options: { data: metadata }
        });
        return { error };
    }, []);

    const loginWithGoogle = useCallback(async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google' });
    }, []);

    const loginWithFacebook = useCallback(async () => {
        await supabase.auth.signInWithOAuth({ provider: 'facebook' });
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    const value = React.useMemo(() => ({
        user,
        session,
        isLoading,
        signOut,
        signIn,
        signUp,
        loginWithGoogle,
        loginWithFacebook
    }), [user, session, isLoading, signOut, signIn, signUp, loginWithGoogle, loginWithFacebook]);

    return (
        <AuthCoreContext.Provider value={value}>
            {children}
        </AuthCoreContext.Provider>
    );
}

export function useAuthCore() {
    const context = useContext(AuthCoreContext);
    if (context === undefined) {
        throw new Error('useAuthCore must be used within an AuthCoreProvider');
    }
    return context;
}
