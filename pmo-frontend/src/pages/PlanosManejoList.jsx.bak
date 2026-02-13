import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
  Container
} from '@mui/material';

// Ícones
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EditIcon from '@mui/icons-material/Edit';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

// Componente do Card (Reutilizado aqui para facilitar)
// Componente do Card (Reutilizado aqui para facilitar)
const PmoCard = ({ pmo, onDelete, onActivate, isActive }) => {
  const navigate = useNavigate();

  const statusConfig = {
    'RASCUNHO': { label: 'Rascunho', color: 'default', icon: <EditIcon fontSize="inherit" /> },
    'CONCLUÍDO': { label: 'Concluído', color: 'info', icon: <HourglassEmptyIcon fontSize="inherit" /> },
    'APROVADO': { label: 'Aprovado', color: 'success', icon: <CheckCircleIcon fontSize="inherit" /> },
    'REPROVADO': { label: 'Reprovado', color: 'error', icon: <ErrorIcon fontSize="inherit" /> },
  };
  const currentStatus = statusConfig[pmo.status] || statusConfig['RASCUNHO'];

  return (
    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
      <Card sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: isActive ? '2px solid #16a34a' : '1px solid #e2e8f0',
        boxShadow: isActive ? '0 4px 20px rgba(22, 163, 74, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
        position: 'relative',
        transition: 'all 0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }
      }}>
        <CardContent sx={{ flexGrow: 1, pt: isActive ? 4 : 2 }}>
          {isActive && (
            <Chip
              label="ATIVO NO ZAP"
              color="success"
              size="small"
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                fontWeight: 'bold',
                fontSize: '0.65rem',
                height: 20
              }}
            />
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, mt: isActive ? 1 : 0 }}>
            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isActive ? '#dcfce7' : '#f1f5f9', mr: 2, minWidth: 54, display: 'flex', justifyContent: 'center' }}>
              <DescriptionIcon sx={{ color: isActive ? '#16a34a' : '#64748b', fontSize: 30 }} />
            </Box>
            <Box sx={{ overflow: 'hidden', width: '100%' }}>
              <Typography variant="h6" component="h2" title={pmo.nome_identificador} sx={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.3, mb: 0.5 }}>
                {pmo.nome_identificador}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Versão: {pmo.version || '1'}
              </Typography>
            </Box>
          </Box>
          <Chip icon={currentStatus.icon} label={currentStatus.label} color={currentStatus.color} size="small" variant="outlined" />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Criado em: {new Date(pmo.created_at).toLocaleDateString('pt-BR')}
          </Typography>
        </CardContent>

        <Divider />

        <CardActions sx={{ justifyContent: 'space-between', p: 1.5, bgcolor: '#f8fafc' }}>
          <Box>
            <Tooltip title={isActive ? "Já está ativo" : "Ativar este plano no WhatsApp"}>
              <span>
                <IconButton size="small" color={isActive ? "success" : "default"} disabled={isActive} onClick={() => onActivate(pmo.id)}>
                  <PowerSettingsNewIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <Box>
            <Tooltip title="Abrir Caderno">
              <IconButton size="small" sx={{ color: '#0f172a' }} onClick={() => navigate(`/pmo/${pmo.id}/editar?aba=caderno`)}>
                <MenuBookIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar PMO">
              <IconButton size="small" color="primary" onClick={() => navigate(`/pmo/${pmo.id}/editar`)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" color="error" onClick={() => onDelete(pmo)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      </Card>
    </Grid>
  );
};

// ================= COMPONENTE DA PÁGINA =================
const PlanosManejoList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pmos, setPmos] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Busca dados (Similar ao Dashboard, mas focado)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Buscar Planos
        const { data: pmosData, error: pmosError } = await supabase
          .from('pmos')
          .select('*')
          .order('created_at', { ascending: false });
        if (pmosError) throw pmosError;
        setPmos(pmosData || []);

        // 2. Buscar Perfil (para saber qual está ativo)
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('pmo_ativo_id')
            .eq('id', user.id)
            .single();
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Erro ao carregar:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleActivate = async (pmoId) => {
    try {
      await supabase.from('profiles').update({ pmo_ativo_id: pmoId }).eq('id', user.id);
      setProfile({ ...profile, pmo_ativo_id: pmoId });
    } catch (error) {
      alert("Erro ao ativar plano");
    }
  };

  const handleDelete = async (pmo) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${pmo.nome_identificador}"?`)) return;
    try {
      await supabase.from('pmos').delete().eq('id', pmo.id);
      setPmos(pmos.filter(p => p.id !== pmo.id));
    } catch (error) {
      alert("Erro ao excluir");
    }
  };

  return (
    <Box sx={{
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      pb: 10
    }}>
      {/* Cabeçalho da Página */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' }, // Stack on mobile
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 4
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
            Gerenciar Planos
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Visualize, edite ou crie novos planos.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<AddIcon />}
          onClick={() => navigate('/pmo/novo')}
          sx={{
            px: 3, py: 1,
            fontWeight: 'bold',
            textTransform: 'none',
            borderRadius: 2,
            width: { xs: '100%', sm: 'auto' } // Full width on mobile
          }}
        >
          Novo Plano
        </Button>
      </Box>

      {/* Conteúdo */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress color="success" />
        </Box>
      ) : pmos.length > 0 ? (
        <Grid container spacing={3}>
          {(pmos || []).map(pmo => (
            <PmoCard
              key={pmo.id}
              pmo={pmo}
              isActive={profile?.pmo_ativo_id === pmo.id}
              onActivate={handleActivate}
              onDelete={handleDelete}
            />
          ))}
        </Grid>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 8,
            textAlign: 'center',
            bgcolor: 'white',
            border: '2px dashed #cbd5e1',
            borderRadius: 4
          }}
        >
          <DescriptionIcon sx={{ fontSize: 60, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nenhum Plano de Manejo Encontrado
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Comece criando o plano digital da sua propriedade para organizar a produção.
          </Typography>
          <Button variant="outlined" color="success" onClick={() => navigate('/pmo/novo')}>
            Criar Meu Primeiro Plano
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default PlanosManejoList;