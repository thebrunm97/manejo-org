export const SCREENS = {
    LAB: 'LAB',
    LOGIN: 'LOGIN',
    SIGNUP: 'SIGNUP',
    HOME: 'HOME',
    HUB: 'HUB',
    PMO_LIST: 'PMO_LIST',
    MAP: 'MAP',
    PMO_EDITOR: 'PMO_EDITOR',
    PMO_DETAIL: 'PMO_DETAIL',
    NOTEBOOK: 'NOTEBOOK',
    CROPS: 'CROPS',
    ADMIN: 'ADMIN',
    CHANGELOG: 'CHANGELOG',
    PROFILE: 'PROFILE',
    PROPERTY_PROFILE: 'PROPERTY_PROFILE',
    KNOWLEDGE_MONITORING: 'KNOWLEDGE_MONITORING',
    TRACEABILITY: 'TRACEABILITY',
    PUBLIC_TRACEABILITY: 'PUBLIC_TRACEABILITY',
    COOP_ORGANIZACOES: 'COOP_ORGANIZACOES',
    COOP_ORGANIZACAO_DETAILS: 'COOP_ORGANIZACAO_DETAILS',
    FINANCEIRO: 'FINANCEIRO',
    ONBOARDING: 'ONBOARDING',
    COOP_DASHBOARD: 'COOP_DASHBOARD',
    COOP_DEMANDAS: 'COOP_DEMANDAS',
    MURAL: 'MURAL',
    LIVE_CHAT_MONITOR: 'LIVE_CHAT_MONITOR',
} as const;


export type RouteName = keyof typeof SCREENS;

export type RootStackParamList = {
    [SCREENS.LAB]: undefined;
    [SCREENS.LOGIN]: undefined;
    [SCREENS.SIGNUP]: undefined;
    [SCREENS.HOME]: undefined;
    [SCREENS.HUB]: undefined;
    [SCREENS.PMO_LIST]: undefined;
    [SCREENS.MAP]: undefined;
    [SCREENS.PMO_EDITOR]: { pmoId?: string };
    [SCREENS.PMO_DETAIL]: { pmoId: string };
    [SCREENS.NOTEBOOK]: undefined;
    [SCREENS.CROPS]: undefined;
    [SCREENS.ADMIN]: undefined;
    [SCREENS.CHANGELOG]: undefined;
    [SCREENS.PROFILE]: undefined;
    [SCREENS.PROPERTY_PROFILE]: undefined;
    [SCREENS.KNOWLEDGE_MONITORING]: undefined;
    [SCREENS.LIVE_CHAT_MONITOR]: undefined;
    [SCREENS.TRACEABILITY]: { codigoLote: string };
    [SCREENS.PUBLIC_TRACEABILITY]: { id: string };
    [SCREENS.COOP_ORGANIZACOES]: undefined;
    [SCREENS.COOP_ORGANIZACAO_DETAILS]: { slug: string };
    [SCREENS.FINANCEIRO]: undefined;
    [SCREENS.ONBOARDING]: undefined;
    [SCREENS.COOP_DASHBOARD]: { slug: string };
    [SCREENS.COOP_DEMANDAS]: { slug: string };
    [SCREENS.MURAL]: undefined;
};


