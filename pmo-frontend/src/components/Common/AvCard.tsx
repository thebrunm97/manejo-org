import React, { ReactNode } from 'react';
import { Card, Box, Typography, Divider, useTheme } from '@mui/material';

interface AvCardProps {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
    noPadding?: boolean;
    className?: string;
}

const AvCard: React.FC<AvCardProps> = ({
    title,
    action,
    children,
    noPadding = false,
    className
}) => {
    const theme = useTheme();

    return (
        <Card
            className={className}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                // Radius and Border logic is handled by MuiCard theme overrides
                // but we can enforce or override specific things here if needed.
                height: '100%',
            }}
        >
            {(title || action) && (
                <>
                    <Box
                        sx={{
                            p: 3, // 12px (scale 4) -> No, wait. Spacing 4. p: 3 = 12px? No.
                            // Default spacing(4) = 16px. So p: 3 = 12px if spacing=4. 
                            // Let's use theme.spacing(4) = 16px. 
                            // To get 16px with spacing=4, we need p={4}.
                            // Wait, standard MUI is spacing(2) = 16px for 8px base.
                            // If base is 4px. to get 16px padding we need spacing(4).
                            // Or p: 4.
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minHeight: '56px'
                        }}
                    >
                        {title && (
                            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                                {title}
                            </Typography>
                        )}
                        {action && (
                            <Box>
                                {action}
                            </Box>
                        )}
                    </Box>
                    <Divider />
                </>
            )}

            <Box
                sx={{
                    p: noPadding ? 0 : 4, // 16px padding
                    flexGrow: 1
                }}
            >
                {children}
            </Box>
        </Card>
    );
};

export default AvCard;
