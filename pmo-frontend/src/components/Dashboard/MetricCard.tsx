import React, { ReactNode } from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { Scale } from 'lucide-react';

interface MetricCardProps {
    icon?: ReactNode;
    value: string;
    unit: string;
    label: string;
    extraUnits?: string | null;
}

const MetricCard: React.FC<MetricCardProps> = ({
    icon,
    value,
    unit,
    label,
    extraUnits,
}) => {
    return (
        <Paper
            elevation={0}
            sx={{
                bgcolor: 'custom.bgSurface',
                border: '1px solid',
                borderColor: 'custom.borderSubtle',
                borderRadius: 2,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    borderColor: 'primary.light',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                },
            }}
        >
            {/* Icon container */}
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: 'custom.bgCanvas',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'custom.fgMuted',
                }}
            >
                {icon || <Scale size={16} />}
            </Box>

            {/* Value + Unit */}
            <Box>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 800,
                        color: 'custom.fgPrimary',
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                        fontFamily: '"Inter", "Roboto Mono", monospace',
                    }}
                >
                    {value}
                    <Typography
                        component="span"
                        sx={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'custom.fgMuted',
                            ml: 0.5,
                        }}
                    >
                        {unit}
                    </Typography>
                </Typography>

                {/* Extra units (e.g., "+ 30 maço") */}
                {extraUnits && (
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'custom.fgMuted',
                            display: 'block',
                            fontSize: '0.7rem',
                            mt: 0.25,
                        }}
                    >
                        + {extraUnits}
                    </Typography>
                )}
            </Box>

            {/* Label */}
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 600,
                    color: 'custom.fgSecondary',
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
            >
                {label}
            </Typography>
        </Paper>
    );
};

export default MetricCard;
