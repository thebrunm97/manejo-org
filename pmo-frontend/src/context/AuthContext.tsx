import { ReactNode } from 'react';
import { AuthCoreProvider, useAuthCore } from './AuthCoreContext';
import { AuthProfileProvider, useAuthProfile } from './AuthProfileContext';
import { User, Session } from '@supabase/supabase-js';
import { UserProfile, Propriedade } from '../domain/pmo/pmoTypes';

export interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isLoadingRole: boolean;
    signOut: () => Promise<void>;
    logout: () => Promise<void>;
    signIn: (email: string, pass: string) => Promise<{ error: any }>;
    login: (email: string, pass: string) => Promise<{ error: any }>;
    signUp: (email: string, pass: string, metadata: any) => Promise<{ error: any }>;
    loginWithGoogle: () => Promise<void>;
    loginWithFacebook: () => Promise<void>;
    
    // Profile & Property Context
    profile: UserProfile | null;
    currentPropriedade: Propriedade | null;
    allPropriedades: Propriedade[];
    isAdmin: boolean;
    isLoadingProfile: boolean;
    propertyContextKey: string;
    refreshProfile: () => Promise<void>;
    switchPropriedade: (prop: Propriedade) => Promise<void>;
    
    // Legacy mapping
    role?: string;
    pmoAtivoId?: string;
}

// Legacy hook for compatibility (composite of core and profile)
export const useAuth = (): AuthContextType => {
    const core = useAuthCore();
    const profile = useAuthProfile();
    
    return {
        ...core,
        ...profile,
        // Match expected property names in legacy codebase
        isLoading: core.isLoading || profile.isLoadingProfile,
        isLoadingRole: profile.isLoadingProfile,
        role: profile.profile?.role || undefined,
        pmoAtivoId: profile.profile?.pmo_ativo_id || undefined,
        // Methods
        signOut: core.signOut,
        logout: core.signOut,
        signIn: core.signIn,
        login: core.signIn,
        signUp: core.signUp,
        loginWithGoogle: core.loginWithGoogle,
        loginWithFacebook: core.loginWithFacebook
    };
};

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <AuthCoreProvider>
            <AuthProfileProvider>
                {children}
            </AuthProfileProvider>
        </AuthCoreProvider>
    );
}

// Export specific hooks for prioritized usage (PERF-01 recommendation)
export { useAuthCore, useAuthProfile };
