import React, { ReactNode } from 'react';
import { Box, Stack, Typography, Button, Paper, useTheme, alpha } from '@mui/material';
import { AddCircleOutline as AddIcon, Spa as SpaIcon } from '@mui/icons-material';
import AvCard from './AvCard';
import BotSuggestionsPanel from '../PmoForm/BotSuggestionsPanel';

interface SectionContainerProps {
    title: string;
    onAdd?: () => void;
    addButtonLabel?: string;
    isEmpty: boolean;
    emptyMessage: string;
    children: ReactNode;
    icon?: ReactNode;
    sectionId?: number;
    onApplySuggestion?: (data: any) => void;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
    title,
    onAdd,
    addButtonLabel = "Adicionar",
    isEmpty,
    emptyMessage,
    children,
    icon,
    sectionId,
    onApplySuggestion
}) => {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mb: 6 }}>
            {/* 0. Painel de Sugestões do Robô */}
            {sectionId && onApplySuggestion && (
                <BotSuggestionsPanel sectionId={sectionId} onApply={onApplySuggestion} />
            )}
            {/* Header Padronizado */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {title}
                </Typography>

                {!isEmpty && onAdd && (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onAdd}
                        sx={{ fontWeight: 600 }}
                    >
                        {addButtonLabel}
                    </Button>
                )}
            </Stack>

            {/* Conteúdo ou Empty State */}
            {isEmpty ? (
                <Paper
                    variant="outlined"
                    sx={{
                        textAlign: 'center',
                        py: 8, // 32px
                        px: 4,
                        bgcolor: 'background.subtle', // Uses new custom token
                        borderRadius: 2, // md (8px)
                        borderStyle: 'dashed',
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3
                    }}
                >
                    <Box sx={{ color: 'text.disabled' }}>
                        {icon || <SpaIcon sx={{ fontSize: 48 }} />}
                    </Box>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {emptyMessage}
                    </Typography>
                    {onAdd && (
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={onAdd}
                            sx={{ mt: 2 }}
                        >
                            {addButtonLabel}
                        </Button>
                    )}
                </Paper>
            ) : (
                <Box>
                    {children}
                </Box>
            )}
        </Box>
    );
};

export default SectionContainer;
