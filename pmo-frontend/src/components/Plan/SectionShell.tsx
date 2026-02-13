import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import BotSuggestionsPanel from '../PmoForm/BotSuggestionsPanel';

/**
 * Props for the SectionShell component
 */
export interface SectionShellProps {
    /** Section label (e.g., "Seção 1") - displayed above the title */
    sectionLabel?: string;
    /** Main section title (e.g., "Descrição da Propriedade") */
    title: string;
    /** Optional subtitle below the main title */
    subtitle?: string;
    /** Section content */
    children: React.ReactNode;
    /** Optional: ID of the section to filter suggestions (e.g. 8 for inputs) */
    sectionId?: number;
    /** Optional: Callback to apply a suggestion (receives data and removal callback) */
    onApplySuggestion?: (data: any, onRemove?: () => void) => void;
}

/**
 * SectionShell - A reusable section container for the Plan editor.
 * 
 * Renders a card-style container with:
 * - Optional section label (uppercase, muted)
 * - Title (18px, bold)
 * - Optional subtitle
 * - Paper container with subtle border for content
 * 
 * Uses theme tokens: custom.bgSurface, custom.borderSubtle, custom.fgPrimary, custom.fgMuted
 * 
 * @example
 * ```tsx
 * <SectionShell
 *   sectionLabel="Seção 1"
 *   title="Descrição da Propriedade"
 *   subtitle="Informações gerais sobre a propriedade"
 * >
 *   <TextField ... />
 * </SectionShell>
 * ```
 */
export function SectionShell({
    sectionLabel,
    title,
    subtitle,
    children,
    sectionId,
    onApplySuggestion
}: SectionShellProps) {
    return (
        <Box sx={{ mb: 4 }}>
            {/* Section header */}
            <Box sx={{ mb: 2 }}>
                {sectionLabel && (
                    <Typography
                        component="span"
                        sx={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'custom.fgMuted',
                            mb: 0.5,
                        }}
                    >
                        {sectionLabel}
                    </Typography>
                )}
                <Typography
                    component="h2"
                    sx={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'custom.fgPrimary',
                        lineHeight: 1.4,
                    }}
                >
                    {title}
                </Typography>
                {subtitle && (
                    <Typography
                        sx={{
                            fontSize: '14px',
                            color: 'custom.fgMuted',
                            mt: 0.5,
                        }}
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>

            {/* AI Suggestions Panel */}
            {sectionId && onApplySuggestion && (
                <Box sx={{ mb: 2 }}>
                    <BotSuggestionsPanel sectionId={sectionId} onApply={onApplySuggestion} />
                </Box>
            )}

            {/* Content container */}
            <Paper
                sx={{
                    borderRadius: 3, // 12px (theme spacing: 3 * 4 = 12)
                    border: '1px solid',
                    borderColor: 'custom.borderSubtle',
                    bgcolor: 'custom.bgSurface',
                    p: 3,
                }}
            >
                {children}
            </Paper>
        </Box>
    );
}

export default SectionShell;
