import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Propriedade } from '../domain/pmo/pmoTypes';
import { fetchAllPropriedades, updateActivePropriedade } from '../services/propriedadeService';
import { useAuthCore } from './AuthCoreContext';

interface AuthProfileContextType {
    profile: UserProfile | null;
    currentPropriedade: Propriedade | null;
    allPropriedades: Propriedade[];
    isAdmin: boolean;
    isLoadingProfile: boolean;
    propertyContextKey: string;
    refreshProfile: () => Promise<void>;
    switchPropriedade: (prop: Propriedade) => Promise<void>;
}

const AuthProfileContext = createContext<AuthProfileContextType | undefined>(undefined);

export function AuthProfileProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthCore();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [currentPropriedade, setCurrentPropriedade] = useState<Propriedade | null>(null);
    const [allPropriedades, setAllPropriedades] = useState<Propriedade[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    // Profile starts as loading since we need to check if a user session exists first
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    // Track last user fetched to ensure we don't show old data
    const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

    const propertyContextKey = currentPropriedade?.id
        ? String(currentPropriedade.id)
        : 'no-prop';

    const loadProfileData = useCallback(async (userId: string) => {
        setIsLoadingProfile(true);
        try {
            // Fetch profile with only needed columns (SEC-04 partial fix)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, nome, avatar_url, pmo_ativo_id, pmo_ativo:pmos(*), role, plan_tier, propriedade_ativa_id, telefone')
                .eq('id', userId)
                .single();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
                return;
            }

            setProfile(profileData as any);

            // Fetch properties
            const props = await fetchAllPropriedades(userId);
            setAllPropriedades(props);

            // Fetch isAdmin
            const { data: adminData } = await supabase.rpc('is_admin');
            setIsAdmin(!!adminData);

            // Set current property from profile or first if only one
            if (profileData?.propriedade_ativa_id) {
                const active = props.find(p => p.id === profileData.propriedade_ativa_id);
                if (active) setCurrentPropriedade(active);
            } else if (props.length === 1) {
                setCurrentPropriedade(props[0]);
                await updateActivePropriedade(userId, props[0].id);
            }

            setLastFetchedUserId(userId);
        } finally {
            setIsLoadingProfile(false);
        }
    }, []);

    useEffect(() => {
        if (user?.id) {
            // Se o usuário mudou, limpa dados antigos e garante carregamento
            if (user.id !== lastFetchedUserId) {
                setIsLoadingProfile(true);
                setProfile(null);
                setAllPropriedades([]);
                loadProfileData(user.id);
            }
        } else {
            setProfile(null);
            setCurrentPropriedade(null);
            setAllPropriedades([]);
            setIsAdmin(false);
            setLastFetchedUserId(null);
            setIsLoadingProfile(false);
        }
    }, [user?.id, loadProfileData, lastFetchedUserId]);

    const refreshProfile = useCallback(async () => {
        if (user?.id) await loadProfileData(user.id);
    }, [user?.id, loadProfileData]);

    const switchPropriedade = useCallback(async (prop: Propriedade) => {
        setCurrentPropriedade(prop);
        if (user?.id) {
            await updateActivePropriedade(user.id, prop.id);
        }
    }, [user?.id]);

    const value = React.useMemo(() => ({
        profile,
        currentPropriedade,
        allPropriedades,
        isAdmin,
        // Composite loading state: true if context is fetching OR if userId changed but we haven't fetched yet
        isLoadingProfile: isLoadingProfile || (!!user?.id && user.id !== lastFetchedUserId),
        propertyContextKey,
        refreshProfile,
        switchPropriedade
    }), [profile, currentPropriedade, allPropriedades, isAdmin, isLoadingProfile, user?.id, lastFetchedUserId, propertyContextKey, refreshProfile, switchPropriedade]);

    return (
        <AuthProfileContext.Provider value={value}>
            {children}
        </AuthProfileContext.Provider>
    );
}

export function useAuthProfile() {
    const context = useContext(AuthProfileContext);
    if (context === undefined) {
        throw new Error('useAuthProfile must be used within an AuthProfileProvider');
    }
    return context;
}
