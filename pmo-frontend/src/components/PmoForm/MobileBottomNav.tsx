// src/components/PmoForm/MobileBottomNav.tsx

import React, { useState } from 'react';
import { AppBar, Toolbar, IconButton, Button, Menu, MenuItem, Box, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import GridViewIcon from '@mui/icons-material/GridView';
import DashboardIcon from '@mui/icons-material/Dashboard';

interface MobileBottomNavProps {
    onNext: () => void;
    onPrev: () => void;
    onSaveDraft: () => void;
    onGoToSections: () => void;
    onGoToDashboard?: () => void;
    isNextDisabled?: boolean;
    isPrevDisabled?: boolean;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onNext,
    onPrev,
    onSaveDraft,
    onGoToSections,
    onGoToDashboard,
    isNextDisabled = false,
    isPrevDisabled = false,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAction = (action: () => void) => {
        action();
        handleMenuClose();
    };

    return (
        <AppBar position="fixed" color="inherit" sx={{ top: 'auto', bottom: 0, borderTop: '1px solid #e0e0e0' }}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
                {/* Lado Esquerdo: Ações Secundárias */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Anterior">
                        <span>
                            <IconButton onClick={onPrev} disabled={isPrevDisabled} color="primary">
                                <ArrowBackIcon />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="Mais Opções">
                        <IconButton
                            aria-label="mais opções"
                            onClick={handleMenuClick}
                        >
                            <MoreVertIcon />
                        </IconButton>
                    </Tooltip>
                    <Menu
                        id="long-menu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleMenuClose}
                        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                        {onGoToDashboard && (
                            <MenuItem onClick={() => handleAction(onGoToDashboard)}>
                                <DashboardIcon sx={{ mr: 1.5 }} />
                                Voltar ao Painel
                            </MenuItem>
                        )}
                        <MenuItem onClick={() => handleAction(onGoToSections)}>
                            <GridViewIcon sx={{ mr: 1.5 }} />
                            Ver Seções
                        </MenuItem>
                        <MenuItem onClick={() => handleAction(onSaveDraft)}>
                            <SaveIcon sx={{ mr: 1.5 }} />
                            Salvar Rascunho
                        </MenuItem>
                    </Menu>
                </Box>

                {/* Lado Direito: Ação Primária */}
                <Button
                    variant="contained"
                    onClick={onNext}
                    disabled={isNextDisabled}
                    endIcon={<ArrowForwardIcon />}
                >
                    Próximo
                </Button>
            </Toolbar>
        </AppBar>
    );
};

export default MobileBottomNav;
