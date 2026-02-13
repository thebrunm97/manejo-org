export const SCREENS = {
    LAB: 'LAB',
    LOGIN: 'LOGIN',
    SIGNUP: 'SIGNUP',
    HOME: 'HOME',
    PMO_LIST: 'PMO_LIST',
    MAP: 'MAP',
    PMO_EDITOR: 'PMO_EDITOR', // /pmo/novo OU /pmo/:pmoId/editar
    PMO_DETAIL: 'PMO_DETAIL', // /pmo/:pmoId
    NOTEBOOK: 'NOTEBOOK',
    CROPS: 'CROPS',
    ADMIN: 'ADMIN', // New protected route
    CHANGELOG: 'CHANGELOG',
} as const;


export type RouteName = keyof typeof SCREENS;

export type RootStackParamList = {
    [SCREENS.LAB]: undefined;
    [SCREENS.LOGIN]: undefined;
    [SCREENS.SIGNUP]: undefined;
    [SCREENS.HOME]: undefined;
    [SCREENS.PMO_LIST]: undefined;
    [SCREENS.MAP]: undefined;
    [SCREENS.PMO_EDITOR]: { pmoId?: string };
    [SCREENS.PMO_DETAIL]: { pmoId: string };
    [SCREENS.NOTEBOOK]: undefined;
    [SCREENS.CROPS]: undefined;
    [SCREENS.ADMIN]: undefined;
    [SCREENS.CHANGELOG]: undefined;
};

