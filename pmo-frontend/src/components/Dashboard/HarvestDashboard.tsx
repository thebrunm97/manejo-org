import React from 'react';
import {
  Box, Paper, Typography, Alert, Stack, Chip, Button, Avatar
} from '@mui/material';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import ScaleIcon from '@mui/icons-material/Scale';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import ScienceIcon from '@mui/icons-material/Science';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { HarvestSummary } from '../../services/dashboardService';
import { formatDateBR } from '../../utils/formatters';

// --- Activity type → visual config ---
const getActivityConfig = (tipo: string | undefined) => {
  switch ((tipo || '').toLowerCase()) {
    case 'plantio':
      return { label: 'Plantio', icon: <LocalFloristIcon />, bgcolor: '#E8F5E9', color: '#1B5E20' };
    case 'manejo':
      return { label: 'Manejo', icon: <ScienceIcon />, bgcolor: '#E3F2FD', color: '#0D47A1' };
    case 'colheita':
      return { label: 'Colheita', icon: <AgricultureIcon />, bgcolor: '#FFF3E0', color: '#E65100' };
    case 'insumo':
      return { label: 'Insumo', icon: <Inventory2Icon />, bgcolor: '#F3E5F5', color: '#6A1B9A' };
    default:
      return { label: tipo || 'Outro', icon: <DescriptionIcon />, bgcolor: '#F1F5F9', color: '#475569' };
  }
};

interface HarvestDashboardProps {
  harvestStats: HarvestSummary;
  recentActivity: any[]; // MVP: mantendo flexibilidade, mas idealmente criar tipo
}

const HarvestDashboard: React.FC<HarvestDashboardProps> = ({ harvestStats, recentActivity }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ flexGrow: 1, p: 2, bgcolor: '#fff', borderRadius: 2, boxShadow: 1 }}>
      <Typography variant="h6" gutterBottom component="div" sx={{ mb: 3, fontWeight: '800', color: '#1b5e20', letterSpacing: '-0.5px' }}>
        <AgricultureIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Monitoramento de Colheita
      </Typography>

      {/* Carousel de Resumo */}
      <Box
        sx={{
          display: 'flex',
          overflowX: 'auto',
          gap: 2,
          pb: 2,
          mb: 4,
          mx: -2,
          px: 2,
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { height: '6px' },
          '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#e2e8f0', borderRadius: '10px' },
          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#cbd5e1' }
        }}
      >
        {Object.entries(harvestStats).length === 0 ? (
          <Alert severity="info" sx={{ width: '100%', borderRadius: 3 }}>Nenhuma colheita registrada neste plano ainda.</Alert>
        ) : (
          Object.entries(harvestStats).map(([key, dados]) => (
            <Paper
              key={key}
              elevation={0}
              sx={{
                minWidth: '150px',
                aspectRatio: '1 / 0.9',
                flex: '0 0 auto',
                border: '1px solid #F0F0F0',
                borderRadius: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' }
              }}
            >
              <Avatar
                variant="rounded"
                sx={{ width: 48, height: 48, bgcolor: '#E8F5E9', color: '#1B5E20', borderRadius: 3, mb: 1 }}
              >
                <ScaleIcon fontSize="small" />
              </Avatar>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h4" sx={{ fontWeight: '800', color: '#1e293b', letterSpacing: '-1px', lineHeight: 1, mb: 0.5 }}>
                  {dados.total.toLocaleString('pt-BR')}
                  <Typography component="span" variant="body2" sx={{ fontWeight: '600', color: '#94a3b8', ml: 0.5 }}>
                    {dados.unidade}
                  </Typography>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dados.produto.toLowerCase()}
                </Typography>
              </Box>
            </Paper>
          ))
        )}
      </Box>

      {/* Lista de Atividades */}
      {(recentActivity || []).length > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 800 }}>
              Últimas Atividades
            </Typography>
            <Button size="small" variant="text" onClick={() => navigate('/caderno')} sx={{ textTransform: 'none', color: '#059669', fontWeight: 700, borderRadius: 2, px: 2 }}>
              Ver tudo
            </Button>
          </Box>

          <Stack spacing={2}>
            {(recentActivity || []).slice(0, 5).map((row) => {
              const cfg = getActivityConfig(row.tipo_atividade || row.tipo);
              return (
                <Paper
                  key={row.id}
                  elevation={0}
                  sx={{ p: 2, borderRadius: 4, border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 2, transition: 'background-color 0.2s', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: cfg.bgcolor, color: cfg.color, borderRadius: 3 }}>
                    {cfg.icon}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{cfg.label}</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.produto}
                      {row.talhao_canteiro && (
                        <Typography component="span" variant="body2" sx={{ color: '#94a3b8' }}>{' • '}{row.talhao_canteiro}</Typography>
                      )}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Chip
                      label={formatDateBR(row.data_registro, { day: '2-digit', month: 'short' }).replace('.', '')}
                      size="small"
                      variant="filled"
                      sx={{ height: 24, bgcolor: '#F1F5F9', color: '#475569', fontWeight: 700, borderRadius: 1, fontSize: '0.75rem' }}
                    />
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </>
      )}
    </Box>
  );
};

export default HarvestDashboard;