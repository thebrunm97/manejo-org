/**
 * @file usePmoFormLogic.ts
 * @description Hook central para gerenciar lógica do formulário PMO.
 * 
 * Este hook é AGNÓSTICO DE PLATAFORMA - pode ser usado em:
 *   - React Web (atual)
 *   - React Native (futuro)
 * 
 * Ele NÃO deve conter:
 *   - JSX
 *   - Componentes Material UI
 *   - Estilos ou CSS
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';

// Domain Layer
import type {
    PMOFormData,
    PmoPayload,
    SaveResult,
    SectionStatusMap,
    PmoStatus
} from '../../domain/pmo/pmoTypes';
import {
    cleanFormDataForSubmission,
    extractCulturasAnuais,
    extractManejoInsumos
} from '../../domain/pmo/pmoTransformers';

// Service Layer
import {
    fetchPmoById,
    createPmo,
    updatePmo,
    syncCulturasAnuais,
    syncManejoInsumos
} from '../../services/pmoService';

// Utils
import { localDb, SYNC_QUEUE_STORE } from '../../utils/db';
import { initialFormData } from '../../utils/formData';
import { deepMerge } from '../../utils/deepMerge';

// ==================================================================
// ||                        TYPES                                 ||
// ==================================================================

export interface UsePmoFormLogicOptions {
    /** ID do PMO (undefined = novo PMO) */
    pmoId?: string;
    /** Tab inicial (ex: 19 = Caderno de Campo) */
    initialTab?: number;
}

export interface UsePmoFormLogicReturn {
    // ─────────────────────────────────────────────────────────────────
    // STATE (Read-only para View)
    // ─────────────────────────────────────────────────────────────────
    formData: PMOFormData;
    nomeIdentificador: string;
    currentStep: number;
    totalSteps: number;
    isLoading: boolean;
    isSaving: boolean;
    isDirty: boolean;
    isEditMode: boolean;
    saveStatus: string;
    error: string | null;
    sectionStatus: SectionStatusMap;
    editablePmoId: string | null;

    // ─────────────────────────────────────────────────────────────────
    // ACTIONS (Chamadas pela View)
    // ─────────────────────────────────────────────────────────────────
    setNomeIdentificador: (nome: string) => void;
    updateSection: (sectionKey: string, data: unknown) => void;
    goToStep: (step: number) => void;
    nextStep: () => void;
    prevStep: () => void;
    clearError: () => void;

    // ─────────────────────────────────────────────────────────────────
    // PERSISTENCE
    // ─────────────────────────────────────────────────────────────────
    saveDraft: () => Promise<SaveResult>;
    submitFinal: () => Promise<SaveResult>;
    syncPendingChanges: () => Promise<void>;
}

// ==================================================================
// ||                    CONSTANTS                                 ||
// ==================================================================

const TOTAL_STEPS = 19; // 18 seções + Caderno de Campo

// ==================================================================
// ||                    MAIN HOOK                                 ||
// ==================================================================

export function usePmoFormLogic(options: UsePmoFormLogicOptions = {}): UsePmoFormLogicReturn {
    const { pmoId: optionsPmoId, initialTab } = options;

    // Router hooks
    const navigate = useNavigate();
    const { pmoId: routePmoId } = useParams<{ pmoId: string }>();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Use route param if available, otherwise use options
    const pmoId = routePmoId || optionsPmoId;

    // ─────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState<PMOFormData>(initialFormData as PMOFormData);
    const [nomeIdentificador, setNomeIdentificadorState] = useState('');

    // Initialize state from URL params
    const [currentStep, setCurrentStep] = useState(() => {
        const stepParam = searchParams.get('step');
        if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= TOTAL_STEPS) {
                return stepNum;
            }
        }
        if (searchParams.get('aba') === 'caderno') {
            return 19;
        }
        return initialTab || 1;
    });

    const [editablePmoId, setEditablePmoId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [saveStatus, setSaveStatus] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sectionStatus] = useState<SectionStatusMap>({});

    // ─────────────────────────────────────────────────────────────────
    // DERIVED VALUES
    // ─────────────────────────────────────────────────────────────────
    const totalSteps = TOTAL_STEPS;

    // ─────────────────────────────────────────────────────────────────
    // OFFLINE SYNC
    // ─────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────
    // OFFLINE SYNC (REFACTORED: Now uses SYNC_QUEUE_STORE)
    // ─────────────────────────────────────────────────────────────────
    const syncPendingChanges = useCallback(async () => {
        // Redundância opcional: Força trigger no sync global
        // Mas o useSyncEngine já lida com 'online'.
    }, []);

    // ─────────────────────────────────────────────────────────────────
    // EFFECTS
    // ─────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────
    // EFFECTS
    // ─────────────────────────────────────────────────────────────────

    // Update URL when step changes
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const currentUrlStep = parseInt(params.get('step') || '0', 10);

        // Only update URL if it differs from state to avoid loops
        if (currentUrlStep !== currentStep) {
            params.set('step', currentStep.toString());
            // Use replace to avoid filling history stack with every step
            navigate({ search: params.toString() }, { replace: true });
        }
    }, [currentStep, navigate, location.search]);

    // Effect 2: Register online listener for sync
    useEffect(() => {
        window.addEventListener('online', syncPendingChanges);
        return () => window.removeEventListener('online', syncPendingChanges);
    }, [syncPendingChanges]);

    // Effect 3: Initialize edit mode based on pmoId
    useEffect(() => {
        setIsLoading(true);
        if (pmoId) {
            setIsEditMode(true);
            setEditablePmoId(pmoId);
        } else {
            setIsEditMode(false);
            setEditablePmoId(null);
            setFormData(initialFormData as PMOFormData);
            setNomeIdentificadorState('');
            setIsLoading(false);
        }
    }, [pmoId]);

    // Effect 4: Fetch PMO data when editablePmoId changes
    useEffect(() => {
        const fetchPmoData = async () => {
            if (!editablePmoId) return;

            await syncPendingChanges();

            try {
                // Check offline storage first
                const offlineData = await localDb.get(editablePmoId);
                if (offlineData) {
                    setFormData(deepMerge(initialFormData, offlineData.form_data));
                    setNomeIdentificadorState(offlineData.nome_identificador);
                } else {
                    // Fetch from server
                    const result = await fetchPmoById(editablePmoId);
                    if (!result.success) {
                        setError(result.error || `PMO ${editablePmoId} não encontrado.`);
                        setTimeout(() => navigate('/'), 3000);
                        return;
                    }

                    if (result.data) {
                        setFormData(deepMerge(initialFormData, result.data.form_data));
                        setNomeIdentificadorState(result.data.nome_identificador);
                    }
                }
            } catch (err) {
                setError('Não foi possível carregar os dados do plano.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPmoData();
    }, [editablePmoId, syncPendingChanges, navigate]);

    // ─────────────────────────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────────────────────────

    const setNomeIdentificador = useCallback((nome: string) => {
        setNomeIdentificadorState(nome);
        setIsDirty(true);
    }, []);

    const updateSection = useCallback((sectionKey: string, data: unknown) => {
        setFormData(prevData => ({ ...prevData, [sectionKey]: data }));
        setIsDirty(true);
    }, []);

    const goToStep = useCallback((step: number) => {
        if (step >= 1 && step <= totalSteps) {
            setCurrentStep(step);
        }
    }, [totalSteps]);

    const nextStep = useCallback(() => {
        goToStep(currentStep + 1);
    }, [currentStep, goToStep]);

    const prevStep = useCallback(() => {
        goToStep(currentStep - 1);
    }, [currentStep, goToStep]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // ─────────────────────────────────────────────────────────────────
    // PERSISTENCE
    // ─────────────────────────────────────────────────────────────────

    const saveInternal = useCallback(async (status: PmoStatus): Promise<SaveResult> => {
        // Prevent multiple simultaneous saves
        if (isSaving) {
            console.warn('[usePmoFormLogic] Save already in progress, ignoring duplicate call');
            return { success: false, error: 'Salvamento em andamento' };
        }

        // Set saving flag immediately to block concurrent calls
        setIsSaving(true);

        // Validation
        if (!nomeIdentificador.trim()) {
            setIsSaving(false);
            setError('O "Nome de Identificação do Plano" é obrigatório.');
            return { success: false, error: 'Nome identificador obrigatório' };
        }

        const cleanedData = cleanFormDataForSubmission(formData);
        const pmoIdToSave = editablePmoId || `offline_${Date.now()}`;

        // Set temporary ID if creating offline
        if (!editablePmoId && !navigator.onLine) {
            setEditablePmoId(pmoIdToSave);
        }

        const payload: PmoPayload = {
            id: pmoIdToSave,
            nome_identificador: nomeIdentificador,
            form_data: cleanedData,
            status
        };

        // ─────────────────────────────────────────────────────────────
        // ONLINE PATH
        // ─────────────────────────────────────────────────────────────
        // ─────────────────────────────────────────────────────────────
        // ONLINE PATH
        // ─────────────────────────────────────────────────────────────
        if (navigator.onLine) {
            setSaveStatus('Salvando na nuvem...');

            try {
                let result: SaveResult;
                let newPmoId = editablePmoId;

                // Create or Update
                if (isEditMode && editablePmoId && typeof editablePmoId === 'string' && !editablePmoId.startsWith('offline_')) {
                    result = await updatePmo(editablePmoId, {
                        nome_identificador: nomeIdentificador,
                        form_data: cleanedData,
                        status
                    });
                } else {
                    result = await createPmo({
                        nome_identificador: nomeIdentificador,
                        form_data: cleanedData,
                        status
                    });

                    if (result.success && result.pmoId) {
                        newPmoId = result.pmoId;

                        // Clean up offline entry if exists
                        if (typeof pmoIdToSave === 'string' && pmoIdToSave.startsWith('offline_')) {
                            await localDb.delete(pmoIdToSave, SYNC_QUEUE_STORE);
                        }

                        // Navigate to edit mode
                        if (!editablePmoId) {
                            navigate(`/pmo/${newPmoId}/editar`, { replace: true });
                            setEditablePmoId(newPmoId);
                            setIsEditMode(true);
                        }
                    }
                }

                if (!result.success) {
                    throw new Error(result.error);
                }

                // Sync related tables (non-blocking)
                if (newPmoId && typeof newPmoId === 'string' && !newPmoId.startsWith('offline_')) {
                    setSaveStatus('Sincronizando tabelas...');
                    try {
                        const culturas = extractCulturasAnuais(formData, newPmoId);
                        if (culturas.length > 0) await syncCulturasAnuais(newPmoId, culturas);
                    } catch (e) { }

                    try {
                        const insumos = extractManejoInsumos(formData, newPmoId);
                        if (insumos.length > 0) await syncManejoInsumos(newPmoId, insumos);
                    } catch (e) { }
                }

                setSaveStatus(status === 'RASCUNHO' ? 'Rascunho salvo com sucesso!' : 'Plano finalizado!');
                setIsDirty(false);

                if (status !== 'RASCUNHO') {
                    setTimeout(() => navigate('/'), 2000);
                }

                return { success: true, pmoId: newPmoId || undefined };

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
                console.error('Erro ao salvar:', err);

                // Fallback to offline queue
                setSaveStatus('Falha na nuvem. Agendando sincronização local...');
                await localDb.set({
                    id: pmoIdToSave,
                    type: 'PMODATA_SAVE',
                    payload: payload,
                    timestamp: new Date().toISOString(),
                    retries: 0,
                    status: 'pending'
                }, SYNC_QUEUE_STORE);
                setError(`Falha na conexão. Dados agendados para sync.`);

                return { success: false, error: errorMessage, isOffline: true };
            } finally {
                setIsSaving(false);
                setTimeout(() => setSaveStatus(''), 3000);
            }
        }

        // ─────────────────────────────────────────────────────────────
        // OFFLINE PATH
        // ─────────────────────────────────────────────────────────────
        setSaveStatus('Você está offline. Agendando sincronização local...');
        try {
            await localDb.set({
                id: pmoIdToSave,
                type: 'PMODATA_SAVE',
                payload: payload,
                timestamp: new Date().toISOString(),
                retries: 0,
                status: 'pending'
            }, SYNC_QUEUE_STORE);
            setIsDirty(false);
            setSaveStatus('Salvo localmente! Sincronização agendada.');
            return { success: true, isOffline: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar offline';
            setError(`Não foi possível salvar localmente. (${errorMessage})`);
            return { success: false, error: errorMessage };
        } finally {
            setTimeout(() => setSaveStatus(''), 3000);
        }
    }, [
        isSaving,
        nomeIdentificador,
        formData,
        editablePmoId,
        isEditMode,
        navigate
    ]);

    const saveDraft = useCallback(() => saveInternal('RASCUNHO'), [saveInternal]);
    const submitFinal = useCallback(() => saveInternal('CONCLUÍDO'), [saveInternal]);

    // ─────────────────────────────────────────────────────────────────
    // RETURN
    // ─────────────────────────────────────────────────────────────────
    return {
        // State
        formData,
        nomeIdentificador,
        currentStep,
        totalSteps,
        isLoading,
        isSaving,
        isDirty,
        isEditMode,
        saveStatus,
        error,
        sectionStatus,
        editablePmoId,

        // Actions
        setNomeIdentificador,
        updateSection,
        goToStep,
        nextStep,
        prevStep,
        clearError,

        // Persistence
        saveDraft,
        submitFinal,
        syncPendingChanges
    };
}

export default usePmoFormLogic;
