// src/components/PmoForm/SectionsModal.tsx

import React from 'react';
import {
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Slide,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

// Types
interface FormSection {
    id: number;
    key: string;
    label: string;
}

type SectionStatus = 'completo' | 'em-progresso' | 'pendente' | undefined;

interface SectionsModalProps {
    open: boolean;
    onClose: () => void;
    sections: FormSection[];
    currentStep: number;
    onNavigate: (step: number) => void;
    sectionStatus: Record<string, SectionStatus>;
}

interface StatusIconProps {
    status: SectionStatus;
}

// Efeito de transição para o modal
const Transition = React.forwardRef(function Transition(
    props: TransitionProps & { children: React.ReactElement },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

// Ícone de status baseado no progresso da seção
const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
    if (status === 'completo') {
        return <CheckCircleIcon color="success" />;
    }
    if (status === 'em-progresso') {
        return <EditIcon color="primary" />;
    }
    return <RadioButtonUncheckedIcon color="action" />;
};

const SectionsModal: React.FC<SectionsModalProps> = ({
    open,
    onClose,
    sections,
    currentStep,
    onNavigate,
    sectionStatus,
}) => {
    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            TransitionComponent={Transition}
        >
            <AppBar sx={{ position: 'relative' }}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
                    <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                        Seções do Plano
                    </Typography>
                </Toolbar>
            </AppBar>

            <List>
                {sections.map((section) => (
                    <ListItemButton
                        key={section.id}
                        selected={currentStep === section.id}
                        onClick={() => onNavigate(section.id)}
                    >
                        <ListItemIcon>
                            <StatusIcon status={sectionStatus[section.key]} />
                        </ListItemIcon>
                        <ListItemText
                            primary={`${section.id}. ${section.label}`}
                            primaryTypographyProps={{
                                fontWeight: currentStep === section.id ? 'bold' : 'normal',
                            }}
                        />
                    </ListItemButton>
                ))}
            </List>
        </Dialog>
    );
};

export default SectionsModal;
