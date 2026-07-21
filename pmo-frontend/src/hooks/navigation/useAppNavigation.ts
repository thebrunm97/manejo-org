import { useNavigate, useLocation, useParams, generatePath } from 'react-router-dom';
import { SCREENS, RootStackParamList } from '../../routes/routeNames';

const ROUTE_PATHS: Partial<Record<keyof RootStackParamList, string>> = {
    [SCREENS.LAB]: '/lab',
    [SCREENS.LOGIN]: '/login',
    [SCREENS.SIGNUP]: '/cadastro',
    [SCREENS.HOME]: '/dashboard', // Updated per Architect Request
    [SCREENS.PMO_LIST]: '/planos',
    [SCREENS.MAP]: '/mapa',
    [SCREENS.NOTEBOOK]: '/caderno',
    [SCREENS.CROPS]: '/culturas',
    [SCREENS.ADMIN]: '/admin',
    [SCREENS.CHANGELOG]: '/changelog',
    [SCREENS.PROFILE]: '/perfil',
    [SCREENS.PROPERTY_PROFILE]: '/propriedade',
    [SCREENS.HUB]: '/hub',
    [SCREENS.KNOWLEDGE_MONITORING]: '/admin/conhecimento',
    [SCREENS.LIVE_CHAT_MONITOR]: '/admin/chat',
    [SCREENS.TRACEABILITY]: '/trace/:codigoLote',
    [SCREENS.COOP_ORGANIZACOES]: '/coop/organizacoes',
    [SCREENS.COOP_ORGANIZACAO_DETAILS]: '/coop/organizacao/:slug',
    [SCREENS.COOP_DASHBOARD]: '/coop/organizacao/:slug/dashboard',
    [SCREENS.COOP_DEMANDAS]: '/coop/organizacao/:slug/demandas',
    [SCREENS.FINANCEIRO]: '/financeiro',
    [SCREENS.MURAL]: '/mural',
};


export function useAppNavigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();

    function navigateTo<T extends keyof RootStackParamList>(
        screen: T,
        routeParams?: RootStackParamList[T]
    ) {
        let path = '';

        if (screen === SCREENS.PMO_DETAIL) {
            const pmoId = (routeParams as any)?.pmoId;
            path = generatePath('/pmo/:pmoId', { pmoId });
        }
        else if (screen === SCREENS.PMO_EDITOR) {
            const pmoId = (routeParams as any)?.pmoId;
            if (pmoId && pmoId !== 'novo') {
                path = generatePath('/pmo/:pmoId/editar', { pmoId });
            } else {
                path = '/pmo/novo';
            }
        }
        else if (screen === SCREENS.TRACEABILITY) {
            const codigoLote = (routeParams as any)?.codigoLote;
            path = generatePath('/trace/:codigoLote', { codigoLote });
        }
        else if (screen === SCREENS.COOP_ORGANIZACAO_DETAILS) {
            const slug = (routeParams as any)?.slug;
            path = generatePath('/coop/organizacao/:slug', { slug });
        }
        else if (screen === SCREENS.COOP_DASHBOARD) {
            const slug = (routeParams as any)?.slug;
            path = generatePath('/coop/organizacao/:slug/dashboard', { slug });
        }
        else if (screen === SCREENS.COOP_DEMANDAS) {
            const slug = (routeParams as any)?.slug;
            path = generatePath('/coop/organizacao/:slug/demandas', { slug });
        }
        else {
            path = ROUTE_PATHS[screen] || '/';
            if (!ROUTE_PATHS[screen]) {
                console.warn(`[Navigation] Rota não mapeada: ${screen}. Verifique useAppNavigation.ts`);
            }
        }

        navigate(path);
    }

    function goBack() { navigate(-1); }
    function getParam(key: string): string | undefined { return params[key]; }

    return {
        navigateTo,
        goBack,
        getParam,
        goHome: () => navigateTo(SCREENS.HOME),
        goToLogin: () => navigateTo(SCREENS.LOGIN),
        goToSignUp: () => navigateTo(SCREENS.SIGNUP),
        goToLab: () => navigateTo(SCREENS.LAB),
        goToPmoDetail: (pmoId: string) => navigateTo(SCREENS.PMO_DETAIL, { pmoId }),
        goToPmoEdit: (pmoId: string) => navigateTo(SCREENS.PMO_EDITOR, { pmoId }),
        goToNewPmo: () => navigateTo(SCREENS.PMO_EDITOR),
        goToCoopOrganizacoes: () => navigateTo(SCREENS.COOP_ORGANIZACOES),
        goToCoopOrganizacaoDetails: (slug: string) => navigateTo(SCREENS.COOP_ORGANIZACAO_DETAILS, { slug }),
        goToCoopDemandas: (slug: string) => navigateTo(SCREENS.COOP_DEMANDAS, { slug }),
        goToFinanceiro: () => navigateTo(SCREENS.FINANCEIRO),
        currentPath: location.pathname
    };
}
