// src/components/PmoForm/DesktopStepper_MUI.tsx

import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import StepIconMUI from './StepIcon_MUI';

// Types
interface FormSection {
    id: number;
    key: string;
    label: string;
    Component: React.ComponentType<any>;
    validate: (data: any) => boolean;
}

type SectionStatus = 'completo' | 'em-progresso' | 'pendente' | undefined;

interface DesktopStepperMUIProps {
    sections: FormSection[];
    currentStep: number;
    goToStep: (step: number) => void;
    sectionStatus: Record<string, SectionStatus>;
}

const DesktopStepperMUI: React.FC<DesktopStepperMUIProps> = ({
    sections,
    currentStep,
    goToStep,
    sectionStatus
}) => {
    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        goToStep(newValue);
    };

    return (
        <Box sx={{ width: '100%', bgcolor: 'background.paper', p: 1, borderRadius: 2, boxShadow: 1 }}>
            <Tabs
                value={currentStep}
                onChange={handleChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label="Navegação das seções do formulário"
                sx={{
                    '& .MuiTabs-indicator': {
                        display: 'none',
                    },
                    '& .MuiTabs-scrollButtons': {
                        color: 'primary.main',
                    },
                }}
            >
                {sections.map((section) => (
                    <Tab
                        key={section.id}
                        value={section.id}
                        icon={
                            <StepIconMUI
                                completed={sectionStatus[section.key] === 'completo'}
                                active={currentStep === section.id}
                                icon={section.id}
                            />
                        }
                        label={section.label}
                        sx={{
                            minWidth: '120px',
                            textTransform: 'none',
                            fontWeight: 500,
                            flexShrink: 0,
                        }}
                    />
                ))}
            </Tabs>
        </Box>
    );
};

export default DesktopStepperMUI;
