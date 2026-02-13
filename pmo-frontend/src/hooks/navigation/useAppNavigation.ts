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
        else {
            path = ROUTE_PATHS[screen] || '/';
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
        currentPath: location.pathname
    };
}
