/**
 * @file PmoFormPage.tsx
 * @description View component for PMO (Plano de Manejo Orgânico) form.
 * 
 * ✅ REFACTORED: All logic extracted to usePmoFormLogic hook.
 * This file now contains ONLY visual/presentation logic.
 */

import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

// Hook with all business logic
import { usePmoFormLogic } from '../hooks/pmo/usePmoFormLogic';

// Validation functions (still needed for section config)
import * as validations from '../validation/pmoValidation';

// MUI Components
import {
    Box, Typography, Alert, TextField, useTheme, useMediaQuery, MobileStepper,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Paper, Snackbar, IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';

// Form Components
import DesktopStepperMUI from '../components/PmoForm/DesktopStepper_MUI';
import StepperNavigationMUI from '../components/PmoForm/StepperNavigation_MUI';
import MobileBottomNav from '../components/PmoForm/MobileBottomNav';
import SectionsModal from '../components/PmoForm/SectionsModal';
import PmoParaImpressao from '../components/PmoForm/PmoParaImpressao';

// Section Components
import DiarioDeCampo from '../components/DiarioDeCampo';
import Secao1MUI from '../components/PmoForm/Secao1_MUI';
import Secao2MUI from '../components/PmoForm/Secao2_MUI';
import Secao3MUI from '../components/PmoForm/Secao3_MUI';
import Secao4MUI from '../components/PmoForm/Secao4_MUI';
import Secao5MUI from '../components/PmoForm/Secao5_MUI';
import Secao6MUI from '../components/PmoForm/Secao6_MUI';
import Secao7MUI from '../components/PmoForm/Secao7_MUI';
import Secao8MUI from '../components/PmoForm/Secao8_MUI';
import Secao9MUI from '../components/PmoForm/Secao9_MUI';
import Secao10MUI from '../components/PmoForm/Secao10_MUI';
import Secao11MUI from '../components/PmoForm/Secao11_MUI';
import Secao12MUI from '../components/PmoForm/Secao12_MUI';
import Secao13MUI from '../components/PmoForm/Secao13_MUI';
import Secao14MUI from '../components/PmoForm/Secao14_MUI';
import Secao15MUI from '../components/PmoForm/Secao15_MUI';
import Secao16MUI from '../components/PmoForm/Secao16_MUI';
import Secao17MUI from '../components/PmoForm/Secao17_MUI';
import Secao18MUI from '../components/PmoForm/Secao18_MUI';

// ==================================================================
// ||                         TYPES                                ||
// ==================================================================

interface FormSection {
    id: number;
    key: string;
    Component: React.FC<any>;
    validate: (data: any) => boolean;
    label: string;
}

// ==================================================================
// ||                     MAIN COMPONENT                           ||
// ==================================================================

const PmoFormPage: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // ─────────────────────────────────────────────────────────────────
    // HOOK: All business logic comes from here
    // ─────────────────────────────────────────────────────────────────
    const {
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
        setNomeIdentificador,
        updateSection,
        goToStep,
        nextStep,
        prevStep,
        clearError,
        saveDraft,
        submitFinal
    } = usePmoFormLogic();

    // ─────────────────────────────────────────────────────────────────
    // LOCAL UI STATE (only visual, not business logic)
    // ─────────────────────────────────────────────────────────────────
    const [isSectionsModalOpen, setSectionsModalOpen] = useState(false);
    const [isConfirmExitOpen, setConfirmExitOpen] = useState(false);
    const [isPrintMode, setIsPrintMode] = useState(false);

    // ─────────────────────────────────────────────────────────────────
    // SECTION CONFIG (static, memoized)
    // ─────────────────────────────────────────────────────────────────
    const formSections: FormSection[] = useMemo(() => [
        { id: 1, key: 'secao_1_descricao_propriedade', Component: Secao1MUI, validate: validations.validateSecao1, label: 'Propriedade' },
        { id: 2, key: 'secao_2_atividades_produtivas_organicas', Component: Secao2MUI, validate: validations.validateSecao2, label: 'Atividades Orgânicas' },
        { id: 3, key: 'secao_3_atividades_produtivas_nao_organicas', Component: Secao3MUI, validate: validations.validateSecao3, label: 'Atividades Não-Orgânicas' },
        { id: 4, key: 'secao_4_animais_servico_subsistencia_companhia', Component: Secao4MUI, validate: validations.validateSecao4, label: 'Outros Animais' },
        { id: 5, key: 'secao_5_producao_terceirizada', Component: Secao5MUI, validate: validations.validateSecao5, label: 'Terceiros' },
        { id: 6, key: 'secao_6_aspectos_ambientais', Component: Secao6MUI, validate: validations.validateSecao6, label: 'Ambiental' },
        { id: 7, key: 'secao_7_aspectos_sociais', Component: Secao7MUI, validate: validations.validateSecao7, label: 'Social' },
        { id: 8, key: 'secao_8_insumos_equipamentos', Component: Secao8MUI, validate: validations.validateSecao8, label: 'Insumos' },
        { id: 9, key: 'secao_9_propagacao_vegetal', Component: Secao9MUI, validate: validations.validateSecao9, label: 'Propagação' },
        { id: 10, key: 'secao_10_fitossanidade', Component: Secao10MUI, validate: validations.validateSecao10, label: 'Fitossanidade' },
        { id: 11, key: 'secao_11_colheita', Component: Secao11MUI, validate: validations.validateSecao11, label: 'Colheita' },
        { id: 12, key: 'secao_12_pos_colheita', Component: Secao12MUI, validate: validations.validateSecao12, label: 'Pós-Colheita' },
        { id: 13, key: 'secao_13_producao_animal', Component: Secao13MUI, validate: validations.validateSecao13, label: 'Produção Animal' },
        { id: 14, key: 'secao_14_comercializacao', Component: Secao14MUI, validate: validations.validateSecao14, label: 'Comércio' },
        { id: 15, key: 'secao_15_rastreabilidade', Component: Secao15MUI, validate: validations.validateSecao15, label: 'Rastreio' },
        { id: 16, key: 'secao_16_sac', Component: Secao16MUI, validate: validations.validateSecao16, label: 'SAC' },
        { id: 17, key: 'secao_17_opiniao', Component: Secao17MUI, validate: validations.validateSecao17, label: 'Opinião' },
        { id: 18, key: 'secao_18_anexos', Component: Secao18MUI, validate: validations.validateSecao18, label: 'Anexos' },
        { id: 19, key: 'caderno_de_campo', Component: DiarioDeCampo, validate: () => true, label: 'Caderno de Campo' }
    ], []);

    const currentSectionConfig = formSections.find(sec => sec.id === currentStep);

    // ─────────────────────────────────────────────────────────────────
    // UI HANDLERS (simple, no business logic)
    // ─────────────────────────────────────────────────────────────────
    const handleAttemptExit = () => {
        if (isDirty) {
            setConfirmExitOpen(true);
        } else {
            navigate('/');
        }
    };

    const handleCancelExit = () => setConfirmExitOpen(false);

    const handleSaveDraft = async () => {
        const result = await saveDraft();
        if (result.success && result.pmoId) {
            // Navigation handled by hook
        }
    };

    const handleSubmitFinal = async () => {
        await submitFinal();
    };

    const handleSaveAndExit = async () => {
        await saveDraft();
        setConfirmExitOpen(false);
        navigate('/');
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER: Print Mode
    // ─────────────────────────────────────────────────────────────────
    if (isPrintMode) {
        return <PmoParaImpressao dadosPmo={formData} onClose={() => setIsPrintMode(false)} />;
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER: Loading State
    // ─────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Typography>Carregando...</Typography>
            </Box>
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER: Main Form
    // ─────────────────────────────────────────────────────────────────
    return (
        <Box key={editablePmoId || 'new-pmo'} sx={{ maxWidth: '1200px', mx: 'auto', p: { xs: 1, sm: 2, md: 3 }, pb: { xs: '80px', md: 3 } }}>
            {/* Header */}
            <Box sx={{ p: 2, mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, gap: 3 }}>
                <IconButton onClick={handleAttemptExit} sx={{ color: '#64748b', p: 0, '&:hover': { color: '#0f172a', bgcolor: 'transparent' } }}>
                    <ArrowBackIcon fontSize="medium" />
                </IconButton>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>
                        Planejamento
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mt: 0, letterSpacing: '-0.03em' }}>
                        {isEditMode ? 'Editando Plano' : 'Novo Plano'}
                    </Typography>
                </Box>
                <Button
                    startIcon={<PrintIcon />}
                    variant="outlined"
                    onClick={() => setIsPrintMode(true)}
                    sx={{ borderColor: '#e2e8f0', color: '#64748b', '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' } }}
                >
                    Visualizar Impressão
                </Button>
                <Box sx={{ width: { xs: '100%', md: '350px' } }}>
                    <TextField
                        required
                        fullWidth
                        placeholder="Nome da Propriedade / Ano"
                        label="Identificação"
                        value={nomeIdentificador}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNomeIdentificador(e.target.value)}
                        variant="outlined"
                        InputProps={{ sx: { bgcolor: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' } }}
                    />
                </Box>
            </Box>

            {/* Stepper */}
            <Box sx={{ width: '100%', mb: 4 }}>
                {isMobile ? (
                    <Paper sx={{ position: 'sticky', top: 0, zIndex: 100 }} elevation={2}>
                        <MobileStepper
                            variant="progress"
                            steps={totalSteps}
                            position="static"
                            activeStep={currentStep - 1}
                            sx={{ bgcolor: 'background.paper', flexGrow: 1, '.MuiMobileStepper-progress': { width: '100%' } }}
                            nextButton={<></>}
                            backButton={<></>}
                        />
                    </Paper>
                ) : (
                    <DesktopStepperMUI
                        sections={formSections}
                        currentStep={currentStep}
                        goToStep={goToStep}
                        sectionStatus={sectionStatus}
                    />
                )}
            </Box>

            {/* Form Content */}
            <div>
                <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSubmitFinal(); }}>
                    {currentSectionConfig && (
                        <currentSectionConfig.Component
                            key={currentSectionConfig.key}
                            data={formData[currentSectionConfig.key]}
                            formData={formData}
                            onSectionChange={(newData: any) => updateSection(currentSectionConfig.key, newData)}
                            errors={error ? { global: error } : {}}
                            pmoId={editablePmoId}
                        />
                    )}

                    {error && <Alert severity="error" sx={{ mt: 2 }} onClose={clearError}>{error}</Alert>}

                    {!isMobile && (
                        <StepperNavigationMUI
                            currentStep={currentStep}
                            totalSteps={totalSteps}
                            isLoading={isLoading || isSaving}
                            saveStatus={saveStatus}
                            onPrev={prevStep}
                            onSaveDraft={handleSaveDraft}
                            onNext={nextStep}
                            onFinalSubmit={handleSubmitFinal}
                            onGoToStart={handleAttemptExit}
                        />
                    )}
                </form>
            </div>

            {/* Mobile Bottom Nav */}
            {isMobile && (
                <MobileBottomNav
                    onNext={nextStep}
                    onPrev={prevStep}
                    onSaveDraft={handleSaveDraft}
                    onGoToSections={() => setSectionsModalOpen(true)}
                    isNextDisabled={isLoading || isSaving || currentStep === totalSteps}
                    isPrevDisabled={isLoading || isSaving || currentStep === 1}
                />
            )}

            {/* Sections Modal */}
            <SectionsModal
                open={isSectionsModalOpen}
                onClose={() => setSectionsModalOpen(false)}
                sections={formSections}
                currentStep={currentStep}
                onNavigate={(step: number) => { goToStep(step); setSectionsModalOpen(false); }}
                sectionStatus={sectionStatus}
            />

            {/* Confirm Exit Dialog */}
            <Dialog open={isConfirmExitOpen} onClose={handleCancelExit}>
                <DialogTitle>Sair da Edição?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Você tem alterações não salvas. Deseja salvá-las como rascunho antes de sair?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelExit}>Cancelar</Button>
                    <Button onClick={() => { setConfirmExitOpen(false); navigate('/'); }} color="error">
                        Sair sem Salvar
                    </Button>
                    <Button onClick={handleSaveAndExit} color="primary" autoFocus>
                        Salvar e Sair
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Save Status Snackbar */}
            <Snackbar
                open={!!saveStatus}
                autoHideDuration={4000}
                message={saveStatus}
            />
        </Box>
    );
};

export default PmoFormPage;
