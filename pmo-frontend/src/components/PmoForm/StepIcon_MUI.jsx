// src/components/PmoForm/StepIcon_MUI.jsx (Corrigido)

import React from 'react';
import { Box } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';

function StepIconMUI(props) {
  const { active, completed, className, icon } = props;

  // Estilos base para o círculo
  const baseSx = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    borderRadius: '50%',
    color: '#fff',
  };

  return (
    <Box
      // <<< CORREÇÃO: A linha 'ownerState' foi removida daqui >>>
      className={className}
      sx={{
        ...baseSx,
        // Estilo condicional baseado no estado do passo
        bgcolor: theme => {
          if (active) {
            return theme.palette.primary.main; // Azul para o passo ativo
          }
          if (completed) {
            return theme.palette.success.main; // Verde para os passos completos
          }
          return theme.palette.grey[400]; // Cinza para os inativos
        },
        // Adiciona um brilho sutil ao passo ativo
        boxShadow: active ? '0 0 10px 0 rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* Mostra o ícone correto baseado no estado */}
      {completed ? (
        <CheckIcon sx={{ fontSize: 18 }} />
      ) : active ? (
        <EditIcon sx={{ fontSize: 18 }} />
      ) : (
        icon
      )}
    </Box>
  );
}

export default StepIconMUI;